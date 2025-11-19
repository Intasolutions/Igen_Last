import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, Typography, Stack, MenuItem,
  FormControl, InputLabel, Select, CircularProgress, Box, FormHelperText
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import API from '../../api/axios';

// ---------- utils ----------
const fmtMoney = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const toQ2 = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '0.00';
  return n.toFixed(2);
};

const toYMD = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
};

const extractApiError = (e) => {
  const d = e?.response?.data;
  if (!d) return 'Request failed.';
  if (typeof d === 'string') return d;
  if (d.detail) return d.detail;
  if (Array.isArray(d.non_field_errors) && d.non_field_errors[0]) return d.non_field_errors[0];
  const firstKey = Object.keys(d || {})[0];
  if (firstKey && Array.isArray(d[firstKey]) && d[firstKey][0]) return `${firstKey}: ${d[firstKey][0]}`;
  return 'Request failed.';
};

/** Parse "Margin: <amount>" out of remarks and return { remarks, margin } */
const parseMarginFromRemarks = (remarks) => {
  if (!remarks) return { remarks: '', margin: '' };
  const match = String(remarks).match(/Margin:\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (!match) return { remarks: String(remarks), margin: '' };
  const cleaned = String(remarks)
    .replace(/\s*\|?\s*Margin:\s*[0-9]+(?:\.[0-9]{1,2})?/i, '')
    .trim();
  return { remarks: cleaned, margin: match[1] };
};

/** Strip trailing % and whitespace; return '' if empty */
const normalizeMargin = (m) => {
  if (m == null) return '';
  let s = String(m).trim();
  if (!s) return '';
  if (s.endsWith('%')) s = s.slice(0, -1).trim();
  return s;
};

/** Build payload patch for margin: include only when applicable and non-empty */
const marginPatch = (applicable, value) => {
  const v = normalizeMargin(value);
  return (applicable && v !== '') ? { margin: v } : {};
};

// ---------- component ----------
const SingleClassifyDialog = ({ open, onClose, txn, onDone, editMode = false, initial = null }) => {
  const isChild = Boolean(txn?.is_split_child);
  const parentSigned = Number(txn?.signed_amount || 0);
  const txDirection = useMemo(() => (parentSigned >= 0 ? 'Credit' : 'Debit'), [parentSigned]);

  const expectedNum = useMemo(() => {
    if (isChild) return Number(txn?.child?.amount || 0);
    return Math.abs(Number(txn?.signed_amount || 0));
  }, [isChild, txn]);

  const expected = useMemo(() => toQ2(expectedNum), [expectedNum]);

  const defaultDate = useMemo(() => {
    if (isChild) return toYMD(txn?.child?.value_date || txn?.transaction_date || txn?.date || '');
    const fallback = (initial?.value_date) || txn?.transaction_date || txn?.date || '';
    return toYMD(fallback);
  }, [isChild, txn, initial]);

  const [ttypes, setTtypes] = useState([]);          // full list (direction filtered)
  const [centres, setCentres] = useState([]);
  const [entities, setEntities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contracts, setContracts] = useState([]);    // full list
  const [loadingDDL, setLoadingDDL] = useState(false);
  const [ddlErr, setDdlErr] = useState('');
  const [form, setForm] = useState({
    transaction_type_id: '',
    cost_centre_id: '',
    entity_id: '',
    asset_id: '',
    contract_id: '',
    amount: '',
    value_date: '',
    remarks: '',
    margin: '',            // NEW
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const inFlightRef = useRef(null);

  // helper: detect flag name variants from API
  const isMarginApplicable = useCallback(
    (t) => Boolean(t?.margin_applicable ?? t?.is_margin_applicable ?? t?.has_margin ?? false),
    []
  );

  // Derived (cost centre–filtered) lists
  const filteredTtypes = useMemo(() => {
    const ccid = form.cost_centre_id;
    if (!ccid) return [];
    return (ttypes || []).filter(t => String(t.cost_centre) === String(ccid));
  }, [ttypes, form.cost_centre_id]);

  const filteredContracts = useMemo(() => {
    const ccid = form.cost_centre_id;
    if (!ccid) return [];
    return (contracts || []).filter(c => String(c.cost_centre) === String(ccid));
  }, [contracts, form.cost_centre_id]);

  // currently selected tx-type object (from filtered list)
  const selectedTtype = useMemo(() => {
    if (!form.cost_centre_id || !form.transaction_type_id) return null;
    return filteredTtypes.find(t => t.transaction_type_id === form.transaction_type_id) || null;
  }, [filteredTtypes, form.cost_centre_id, form.transaction_type_id]);

  const showMargin = useMemo(() => isMarginApplicable(selectedTtype), [selectedTtype, isMarginApplicable]);

  // If cost centre changes, clear selections that no longer belong to it
  useEffect(() => {
    if (!form.cost_centre_id) return;
    // don’t clear while loading — otherwise we nuke the selection before lists arrive
    if (loadingDDL) return;
    if (!ttypes.length && !contracts.length) return;

    setForm(prev => {
      const patch = {};
      if (prev.transaction_type_id && !filteredTtypes.some(t => t.transaction_type_id === prev.transaction_type_id)) {
        patch.transaction_type_id = '';
        patch.margin = ''; // clear margin if tx-type reset
      }
      if (prev.contract_id && !filteredContracts.some(c => c.id === prev.contract_id)) {
        patch.contract_id = '';
      }
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
  }, [
    form.cost_centre_id,
    filteredTtypes,
    filteredContracts,
    loadingDDL,
    ttypes.length,
    contracts.length,
  ]);

  // hydrate & fetch DDL
  useEffect(() => {
    if (!(open && txn)) return;

    // ----- Seed form (parse Margin from remarks; prefer cleaned/parsed if present) -----
    if (isChild) {
      const baseRemarks = txn?.child?.cleaned_remarks ?? txn?.child?.remarks ?? '';
      const parsed = txn?.child?.parsed_margin ?? null;
      const fromText = parseMarginFromRemarks(baseRemarks);
      setForm((f) => ({
        ...f,
        amount: expected,
        value_date: defaultDate,
        remarks: fromText.remarks || 'Re-classify split child',
        margin: String(parsed ?? fromText.margin ?? ''),
      }));
    } else {
      const baseRemarks = initial?.cleaned_remarks ?? initial?.remarks ?? '';
      const parsed = initial?.parsed_margin ?? null;
      const fromText = parseMarginFromRemarks(baseRemarks);
      setForm((f) => ({
        ...f,
        transaction_type_id: initial?.transaction_type_id ?? '',
        cost_centre_id:      initial?.cost_centre_id ?? '',
        entity_id:           initial?.entity_id ?? '',
        asset_id:            initial?.asset_id ?? '',
        contract_id:         initial?.contract_id ?? '',
        amount:              expected,
        value_date:          defaultDate,
        remarks:             fromText.remarks || 'Direct classification',
        margin:              String(parsed ?? fromText.margin ?? ''),
      }));
    }

    setErr('');
    setSubmitted(false);
    setDdlErr('');

    if (!localStorage.getItem('access') && !localStorage.getItem('refresh')) {
      setDdlErr('You are not logged in.');
      return;
    }

    inFlightRef.current?.abort?.();
    const ac = new AbortController();
    inFlightRef.current = ac;

    (async () => {
      try {
        setLoadingDDL(true);

        const [tt, cc, en] = await Promise.all([
          API.get('transaction-types/?status=Active', { signal: ac.signal }),
          API.get('cost-centres/?is_active=true', { signal: ac.signal }),
          API.get('entities/', { signal: ac.signal }),
        ]);

        let assetRows = [];
        try {
          const asResp = await API.get('assets/assets/', { signal: ac.signal });
          assetRows = Array.isArray(asResp?.data?.results)
            ? asResp.data.results
            : Array.isArray(asResp?.data)
            ? asResp.data
            : [];
        } catch {}

        let contractRows = [];
        try {
          const coResp = await API.get('/contracts/', { signal: ac.signal });
          contractRows = Array.isArray(coResp?.data?.results)
            ? coResp.data.results
            : Array.isArray(coResp?.data)
            ? coResp.data
            : [];
        } catch {}

        const ttypeRows = (tt?.data || []).filter(
          (t) => (t.status?.toLowerCase?.() === 'active') && (t.direction === txDirection)
        );
        const centreRows = (cc?.data || []).filter((c) => c.is_active !== false);
        const entityRows = (en?.data || []).filter((e) => (e.status ?? 'Active').toLowerCase() === 'active');

        setTtypes(ttypeRows);
        setCentres(centreRows);
        setEntities(entityRows);

        setAssets(assetRows.filter((a) => a.is_active !== false).map(a => ({ ...a, id: Number(a.id) })));
        setContracts(contractRows.filter((c) => c.is_active !== false).map(c => ({ ...c, id: Number(c.id) })));

      } catch (e) {
        const canceled = e?.name === 'CanceledError' || e?.message === 'canceled' || e?.code === 'ERR_CANCELED';
        if (!canceled) setDdlErr(extractApiError(e));
      } finally {
        if (inFlightRef.current === ac) setLoadingDDL(false);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [open, txn, expected, txDirection, defaultDate, isChild, initial]);

  // reset on close
  useEffect(() => {
    if (open) return;
    setForm({
      transaction_type_id: '',
      cost_centre_id: '',
      entity_id: '',
      asset_id: '',
      contract_id: '',
      amount: '',
      value_date: '',
      remarks: '',
      margin: '',
    });
    setTtypes([]); setCentres([]); setEntities([]); setAssets([]); setContracts([]);
    setDdlErr(''); setErr(''); setSubmitted(false);
  }, [open]);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const validRequired = useMemo(() => ({
    transaction_type_id: Boolean(form.transaction_type_id),
    cost_centre_id: Boolean(form.cost_centre_id),
    entity_id: Boolean(form.entity_id),
  }), [form.transaction_type_id, form.cost_centre_id, form.entity_id]);

  const allRequiredOk = useMemo(
    () =>
      validRequired.transaction_type_id &&
      validRequired.cost_centre_id &&
      validRequired.entity_id,
    [validRequired.transaction_type_id, validRequired.cost_centre_id, validRequired.entity_id]
  );

  const submit = async () => {
    if (!txn) return;
    setSubmitted(true);
    setErr('');

    const amountStr = expected;

    if (!allRequiredOk) {
      setErr('Please fill all required fields.');
      return;
    }
    if (toQ2(form.amount || expected) !== amountStr) {
      setErr(`Amount must equal ₹${fmtMoney(expected)}.`);
      return;
    }

    setSaving(true);
    try {
      if (isChild) {
        const payload = {
          classification_id: txn.child?.classification_id,
          transaction_type_id: form.transaction_type_id || null,
          cost_centre_id: form.cost_centre_id || null,
          entity_id: form.entity_id || null,
          asset_id: form.asset_id || null,
          contract_id: form.contract_id || null,
          value_date: form.value_date || defaultDate || null,
          remarks: form.remarks || '',
          ...marginPatch(showMargin, form.margin),   // << only include margin when non-empty
        };
        await API.post('tx-classify/reclassify/', payload);
      } else {
        const payload = {
          bank_transaction_id: txn.id,
          transaction_type_id: form.transaction_type_id || null,
          cost_centre_id: form.cost_centre_id || null,
          entity_id: form.entity_id || null,
          asset_id: form.asset_id || null,
          contract_id: form.contract_id || null,
          amount: amountStr,
          value_date: form.value_date || defaultDate || null,
          remarks: form.remarks || '',
          ...marginPatch(showMargin, form.margin),   // << only include margin when non-empty
        };
        await API.post('tx-classify/classify/', payload);
      }
      onDone && onDone();
      onClose && onClose();
    } catch (e) {
      setErr(extractApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const renderSelect = (
    label,
    value,
    onChange,
    items,
    getValue,
    getLabel,
    required = false,
    showError = false
  ) => (
    <FormControl size="small" fullWidth required={required} error={showError} className="transition-all duration-300 hover:shadow-lg">
      <InputLabel className="text-gray-700 font-medium">{label}</InputLabel>
      <Select
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={loadingDDL || saving}
        className="bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 shadow-sm"
        MenuProps={{
          PaperProps: {
            className: "rounded-xl shadow-lg max-h-80",
          },
        }}
      >
        {items.map((it) => (
          <MenuItem
            key={String(getValue(it))}
            value={getValue(it)}
            className="hover:bg-indigo-50 text-gray-800 py-2"
          >
            {getLabel(it)}
          </MenuItem>
        ))}
      </Select>
      {showError && <FormHelperText className="text-red-500 font-medium">Required</FormHelperText>}
    </FormControl>
  );

  const handleClose = (_e, reason) => {
    if (saving && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
    onClose && onClose();
  };

  const heading = isChild
    ? 'Re-classify Split Child'
    : (editMode ? 'Edit Classification' : 'Classify Transaction');

  const shownAmount = isChild ? txn?.child?.amount : txn?.signed_amount;
  const shownDate = isChild ? (txn?.child?.value_date || defaultDate) : defaultDate;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 3,
          backgroundColor: '#fafafa',
          boxShadow: 10,
          overflowY: 'hidden'
        }
      }}
    >
      <DialogTitle className="font-semibold text-2xl text-gray-900 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 py-4 px-6">
        {heading}
      </DialogTitle>
      <DialogContent
        className="bg-gray-50 px-6 py-6 mt-6"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && allRequiredOk && !saving && !loadingDDL) submit();
        }}
      >
        {txn && (
          <Box className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Typography className="text-sm font-medium text-gray-700">
              <strong>Narration:</strong> {txn.narration}
            </Typography>
            <Typography className="text-sm font-medium text-gray-700">
              <strong>Amount:</strong> ₹{fmtMoney(shownAmount)} ({txDirection})
            </Typography>
            <Typography className="text-sm font-medium text-gray-700">
              <strong>Date:</strong> {toYMD(shownDate)}
            </Typography>
          </Box>
        )}

        {ddlErr && (
          <Alert
            severity="warning"
            className="mb-4 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-200"
          >
            {ddlErr}
          </Alert>
        )}
        {err && (
          <Alert
            severity="error"
            className="mb-4 rounded-xl bg-red-50 text-red-800 border border-red-200"
          >
            {err}
          </Alert>
        )}

        {loadingDDL ? (
          <Box className="flex justify-center py-8">
            <CircularProgress className="text-indigo-500" />
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Cost Centre & Entity FIRST */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {renderSelect(
                'Cost Centre',
                form.cost_centre_id,
                (v) => setField('cost_centre_id', v),
                centres,
                (c) => c.cost_centre_id,
                (c) => `${c.name}${c.transaction_direction ? ` — ${c.transaction_direction}` : ''}`,
                true,
                submitted && !validRequired.cost_centre_id
              )}

              {/* Entity — now searchable via Autocomplete */}
              <FormControl size="small" fullWidth required error={submitted && !validRequired.entity_id}>
                <Autocomplete
                  options={entities || []}
                  getOptionLabel={(e) => `${e.name}${e.entity_type ? ` — ${e.entity_type}` : ''}`}
                  value={(entities || []).find(e => String(e.id) === String(form.entity_id)) || null}
                  onChange={(_e, val) => setField('entity_id', val ? val.id : '')}
                  loading={loadingDDL}
                  disabled={loadingDDL || saving}
                  isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                  renderInput={(params) => (
                    <TextField {...params} label="Entity" size="small" placeholder="Search entity…" />
                  )}
                />
                {submitted && !validRequired.entity_id && <FormHelperText className="text-red-500 font-medium">Required</FormHelperText>}
              </FormControl>
            </Stack>

            {/* Transaction Type */}
            {renderSelect(
              'Transaction Type',
              form.transaction_type_id,
              (v) => {
                const next = filteredTtypes.find(t => t.transaction_type_id === v);
                setField('transaction_type_id', v);
                if (!isMarginApplicable(next)) setField('margin', '');
              },
              form.cost_centre_id ? filteredTtypes : [],
              (t) => t.transaction_type_id,
              (t) => `${t.name} — ${t.direction}`,
              true,
              submitted && !validRequired.transaction_type_id
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {renderSelect(
                'Asset',
                form.asset_id,
                (v) => setField('asset_id', v),
                assets,
                (a) => a.id,
                (a) => `${a.name}${a.tag_id ? ` — ${a.tag_id}` : ''}`,
                false,
                false
              )}
              {renderSelect(
                'Contract',
                form.contract_id,
                (v) => setField('contract_id', v),
                form.cost_centre_id ? filteredContracts : [],
                (c) => c.id,
                (c) => `${c.vendor_name || 'Contract'}${c.cost_centre_name ? ` — ${c.cost_centre_name}` : ''}`,
                false,
                false
              )}
            </Stack>

            {/* Amount, Value Date, and CONDITIONAL Margin */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Amount"
                size="small"
                value={expected}
                helperText={`Must equal ₹${fmtMoney(expected)}`}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Value Date"
                type="date"
                size="small"
                value={form.value_date}
                onChange={(e) => setField('value_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                disabled={saving}
              />
              {showMargin && (
                <TextField
                  label="Margin"
                  size="small"
                  value={form.margin}
                  onChange={(e) => setField('margin', e.target.value)}
                  placeholder="e.g., 2.5 or 1000"
                  helperText="Shown because this Transaction Type is margin applicable"
                />
              )}
            </Stack>

            <TextField
              label="Remarks"
              size="small"
              value={form.remarks}
              onChange={(e) => setField('remarks', e.target.value)}
              multiline
              minRows={2}
              disabled={saving}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving || loadingDDL || !allRequiredOk} variant="contained">
          {saving
            ? 'Saving…'
            : isChild
              ? 'Save Re-classification'
              : (editMode ? 'Save Edit' : 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SingleClassifyDialog;
