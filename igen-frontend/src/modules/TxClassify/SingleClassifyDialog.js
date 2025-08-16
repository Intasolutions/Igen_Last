import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, Typography, Stack, MenuItem,
  FormControl, InputLabel, Select, CircularProgress, Box, FormHelperText
} from '@mui/material';
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

// ---------- component ----------
const SingleClassifyDialog = ({ open, onClose, txn, onDone }) => {
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
    return toYMD(txn?.transaction_date || txn?.date || '');
  }, [isChild, txn]);

  const [ttypes, setTtypes] = useState([]);
  const [centres, setCentres] = useState([]);
  const [entities, setEntities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contracts, setContracts] = useState([]);
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
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const inFlightRef = useRef(null);

  useEffect(() => {
    if (!(open && txn)) return;

    setForm((f) => ({
      ...f,
      amount: expected,
      value_date: defaultDate,
      remarks: f.remarks || (isChild ? 'Re-classify split child' : 'Direct classification'),
    }));
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
        const [tt, cc, en, as, co] = await Promise.all([
          API.get('transaction-types/?status=Active', { signal: ac.signal }),
          API.get('cost-centres/?is_active=true', { signal: ac.signal }),
          API.get('entities/', { signal: ac.signal }),
          API.get('assets/', { signal: ac.signal }),
          API.get('contracts/', { signal: ac.signal }),
        ]);

        const ttypeRows = (tt?.data || []).filter(
          (t) => (t.status?.toLowerCase?.() === 'active') && (t.direction === txDirection)
        );
        const centreRows = (cc?.data || []).filter((c) => c.is_active !== false);
        const entityRows = (en?.data || []).filter((e) => (e.status ?? 'Active').toLowerCase() === 'active');
        const assetRows = (as?.data || []).filter((a) => a.is_active !== false);
        const contractRows = (co?.data || []).filter((c) => c.is_active !== false);

        setTtypes(ttypeRows);
        setCentres(centreRows);
        setEntities(entityRows);
        setAssets(assetRows);
        setContracts(contractRows);
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
  }, [open, txn, expected, txDirection, defaultDate, isChild]);

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
    if (toQ2(form.amount) !== amountStr) {
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
        value={value}
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

  const heading = isChild ? 'Re-classify Split Child' : 'Classify Transaction';
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
            {renderSelect(
              'Transaction Type',
              form.transaction_type_id,
              (v) => setField('transaction_type_id', v),
              ttypes,
              (t) => t.transaction_type_id,
              (t) => `${t.name} — ${t.direction}`,
              true,
              submitted && !validRequired.transaction_type_id
            )}
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
              {renderSelect(
                'Entity',
                form.entity_id,
                (v) => setField('entity_id', v),
                entities,
                (e) => e.id,
                (e) => `${e.name}${e.entity_type ? ` — ${e.entity_type}` : ''}`,
                true,
                submitted && !validRequired.entity_id
              )}
            </Stack>
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
                contracts,
                (c) => c.id,
                (c) => `${c.vendor_name || 'Contract'}${c.cost_centre_name ? ` — ${c.cost_centre_name}` : ''}`,
                false,
                false
              )}
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Amount"
                size="small"
                value={expected}
                helperText={`Must equal ₹${fmtMoney(expected)}`}
                InputProps={{ readOnly: true }}
                className="bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 shadow-sm"
                InputLabelProps={{ className: 'text-gray-700 font-medium' }}
              />
              <TextField
                label="Value Date"
                type="date"
                size="small"
                value={form.value_date}
                onChange={(e) => setField('value_date', e.target.value)}
                InputLabelProps={{ shrink: true, className: 'text-gray-700 font-medium' }}
                disabled={saving}
                className="bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
            </Stack>
            <TextField
              label="Remarks"
              size="small"
              value={form.remarks}
              onChange={(e) => setField('remarks', e.target.value)}
              multiline
              minRows={2}
              disabled={saving}
              className="bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 shadow-sm"
              InputLabelProps={{ className: 'text-gray-700 font-medium' }}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
        <Button
          onClick={onClose}
          disabled={saving}
          className="text-gray-600 hover:bg-gray-100 bg-white border border-gray-200 rounded-xl px-4 py-2 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={saving || loadingDDL || !allRequiredOk}
          sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              backgroundColor: '#2196f3',
              boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#1976d2',
                boxShadow: '0 6px 16px rgba(33, 150, 243, 0.5)',
              },
            }}
        >
          {saving ? 'Saving…' : isChild ? 'Save Re-classification' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SingleClassifyDialog;