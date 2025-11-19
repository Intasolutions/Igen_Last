import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, Alert, FormHelperText, Stack, Box, Typography
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import API from '../../api/axios';

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

const toYMD = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
};

// margin helpers
const MARGIN_RE = /\s*\|?\s*Margin:\s*([0-9]+(?:\.[0-9]{1,2})?)/i;
const parseMarginFromRemarks = (remarks) => {
  const text = String(remarks || '');
  const m = text.match(MARGIN_RE);
  if (!m) return { margin: '', cleanedRemarks: text };
  return { margin: m[1] || '', cleanedRemarks: text.replace(MARGIN_RE, '').trim() };
};

// normalize: strip trailing %; return '' if empty
const normalizeMargin = (m) => {
  if (m == null) return '';
  let s = String(m).trim();
  if (!s) return '';
  if (s.endsWith('%')) s = s.slice(0, -1).trim();
  return s;
};

// include margin key only when it has a real value
const marginPatch = (value) => {
  const v = normalizeMargin(value);
  return v !== '' ? { margin: v } : {};
};

/**
 * Props:
 * - open
 * - onClose
 * - child: {
 *     classification_id, transaction_type_id, cost_centre_id, entity_id,
 *     asset_id, contract_id, value_date, remarks
 *   }
 * - onDone
 * - direction (optional): 'Credit' | 'Debit' → filters transaction types if provided
 */
const EditChildDialog = ({ open, onClose, child, onDone, direction = null }) => {
  const [ttypes, setTtypes] = useState([]);      // full list (maybe direction-filtered)
  const [centres, setCentres] = useState([]);
  const [entities, setEntities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contracts, setContracts] = useState([]); // full list
  const [loadingDDL, setLoadingDDL] = useState(false);
  const [ddlErr, setDdlErr] = useState('');

  const [form, setForm] = useState({
    transaction_type_id: '',
    cost_centre_id: '',
    entity_id: '',
    asset_id: '',
    contract_id: '',
    value_date: '',
    remarks: '',
    margin: '', // NEW
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const inFlightRef = useRef(null);

  // for UX: show quick header info if available
  const headerDate = useMemo(() => toYMD(child?.value_date || ''), [child?.value_date]);

  // Derived (cost-centre–filtered) lists for types/contracts
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

  // If cost centre changes, clear selections that no longer belong to it
  useEffect(() => {
    if (!form.cost_centre_id) return;
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
  }, [form.cost_centre_id, filteredTtypes, filteredContracts]);

  useEffect(() => {
    if (!open) return;

    // seed form from incoming child object & parse margin from remarks
    const parsed = parseMarginFromRemarks(child?.remarks || '');
    setForm({
      transaction_type_id: child?.transaction_type_id ?? '',
      cost_centre_id: child?.cost_centre_id ?? '',
      entity_id: child?.entity_id ?? '',
      asset_id: child?.asset_id ?? '',
      contract_id: child?.contract_id ?? '',
      value_date: toYMD(child?.value_date || ''),
      remarks: parsed.cleanedRemarks,
      margin: parsed.margin, // seed parsed margin
    });

    setErr('');
    setDdlErr('');

    inFlightRef.current?.abort?.();
    const ac = new AbortController();
    inFlightRef.current = ac;

    (async () => {
      try {
        setLoadingDDL(true);
        const results = await Promise.allSettled([
          API.get('transaction-types/?status=Active', { signal: ac.signal }),
          API.get('cost-centres/?is_active=true', { signal: ac.signal }),
          API.get('entities/', { signal: ac.signal }),
          API.get('assets/assets/', { signal: ac.signal }),
          API.get('/contracts/', { signal: ac.signal }), // keep leading slash for consistency
        ]);

        const [tt, cc, en, as, co] = results;

        // transaction types (direction + active)
        if (tt.status === 'fulfilled') {
          let data = tt.value?.data || [];
          if (Array.isArray(tt.value?.data?.results)) data = tt.value.data.results;
          data = data.filter(t => (t.status || '').toLowerCase() === 'active');
          if (direction) data = data.filter(t => t.direction === direction);
          setTtypes(data);
        }

        if (cc.status === 'fulfilled') {
          let data = cc.value?.data || [];
          if (Array.isArray(cc.value?.data?.results)) data = cc.value.data.results;
          setCentres((Array.isArray(data) ? data : []).filter(c => c.is_active !== false));
        }

        if (en.status === 'fulfilled') {
          let data = en.value?.data || [];
          if (Array.isArray(en.value?.data?.results)) data = en.value.data.results;
          setEntities((Array.isArray(data) ? data : []).filter(e => (e.status ?? 'Active').toLowerCase() === 'active'));
        }

        // assets (normalize ids to Number to avoid select mismatch)
        if (as.status === 'fulfilled') {
          let data = as.value?.data || [];
          if (Array.isArray(as.value?.data?.results)) data = as.value.data.results;
          const clean = (Array.isArray(data) ? data : []).filter(a => a.is_active !== false)
            .map(a => ({ ...a, id: Number(a.id) }));
          setAssets(clean);
        }

        // contracts (normalize ids to Number)
        if (co.status === 'fulfilled') {
          let data = co.value?.data || [];
          if (Array.isArray(co.value?.data?.results)) data = co.value.data.results;
          const clean = (Array.isArray(data) ? data : []).filter(c => c.is_active !== false)
            .map(c => ({ ...c, id: Number(c.id) }));
          setContracts(clean);
        }

        if (results.every(r => r.status === 'rejected')) {
          const firstErr = results.find(r => r.status === 'rejected')?.reason;
          setDdlErr(extractApiError(firstErr) || 'Failed to load lists.');
        } else if (results.some(r => r.status === 'rejected') && !ddlErr) {
          setDdlErr('Some lists could not be loaded. Others are available.');
        }
      } catch (e) {
        const canceled = e?.name === 'CanceledError' || e?.message === 'canceled' || e?.code === 'ERR_CANCELED';
        if (!canceled) setDdlErr(extractApiError(e));
      } finally {
        if (inFlightRef.current === ac) setLoadingDDL(false);
      }
    })();

    return () => ac.abort();
  }, [open, child, direction]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) return;
    // reset on close
    setTtypes([]); setCentres([]); setEntities([]); setAssets([]); setContracts([]);
    setForm({
      transaction_type_id: '',
      cost_centre_id: '',
      entity_id: '',
      asset_id: '',
      contract_id: '',
      value_date: '',
      remarks: '',
      margin: '',
    });
    setSubmitting(false);
    setErr('');
    setDdlErr('');
  }, [open]);

  // Figure out if the selected transaction type is margin applicable OR if remarks had margin
  const needsMargin = useMemo(() => {
    const list = form.cost_centre_id ? filteredTtypes : ttypes;
    const tt = (list || []).find(t => t.transaction_type_id === form.transaction_type_id);
    return Boolean(tt?.margin_applicable) || normalizeMargin(form.margin) !== '';
  }, [form.transaction_type_id, form.cost_centre_id, filteredTtypes, ttypes, form.margin]);

  const requiredOk = !!form.transaction_type_id && !!form.cost_centre_id && !!form.entity_id;

  const renderSelect = (label, value, onChange, items, getValue, getLabel, required = false, error = false) => (
    <FormControl size="small" fullWidth required={required} error={error}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={loadingDDL || submitting}
      >
        <MenuItem value="">
          <em>Select {label}</em>
        </MenuItem>
        {items.map((it) => (
          <MenuItem key={String(getValue(it))} value={getValue(it)}>
            {getLabel(it)}
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>Required</FormHelperText>}
    </FormControl>
  );

  const submit = async () => {
    setErr('');
    if (!child?.classification_id) {
      setErr('Missing classification id.');
      return;
    }
    if (!requiredOk) {
      setErr('Please complete required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        classification_id: child.classification_id,
        transaction_type_id: form.transaction_type_id,
        cost_centre_id: form.cost_centre_id,
        entity_id: form.entity_id,
        asset_id: form.asset_id || null,
        contract_id: form.contract_id || null,
        value_date: form.value_date || null,
        remarks: form.remarks || null,
        ...marginPatch(form.margin), // << only include margin when non-empty
      };
      await API.post('tx-classify/reclassify/', payload);
      onDone && onDone();
      onClose && onClose();
    } catch (e) {
      setErr(extractApiError(e) || 'Edit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle>Edit Child Classification</DialogTitle>
      <DialogContent dividers>
        {/* Header summary (optional) */}
        {(child?.remarks || headerDate) && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {headerDate && (<><strong>Date:</strong> {headerDate}</>)}{child?.remarks ? ` — ${child.remarks}` : ''}
            </Typography>
          </Box>
        )}

        {ddlErr && <Alert severity="warning" sx={{ mb: 2 }}>{ddlErr}</Alert>}
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {loadingDDL ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* Cost Centre FIRST, to drive filters */}
            {renderSelect(
              'Cost Centre',
              form.cost_centre_id,
              (v) => setForm(prev => ({ ...prev, cost_centre_id: v })),
              centres,
              (c) => c.cost_centre_id,
              (c) => `${c.name}${c.transaction_direction ? ` — ${c.transaction_direction}` : ''}`,
              true,
              !form.cost_centre_id
            )}

            {/* Transaction Type filtered by Cost Centre */}
            {renderSelect(
              'Transaction Type',
              form.transaction_type_id,
              (v) => {
                const tt = filteredTtypes.find(t => t.transaction_type_id === v);
                setForm(prev => ({
                  ...prev,
                  transaction_type_id: v,
                  ...(tt?.margin_applicable ? {} : { margin: '' }), // clear margin if new type not applicable
                }));
              },
              form.cost_centre_id ? filteredTtypes : [],
              (t) => t.transaction_type_id,
              (t) => `${t.name}${t.direction ? ` — ${t.direction}` : ''}`,
              true,
              !form.transaction_type_id
            )}

            {/* NEW: show Margin when selected type is margin-applicable OR remarks had margin */}
            {needsMargin && (
              <TextField
                label="Margin"
                size="small"
                value={form.margin}
                onChange={(e) => setForm(prev => ({ ...prev, margin: e.target.value }))}
                placeholder="e.g., 2.5 or 1000"
                helperText="Shown because type allows margin or previous remarks contained a margin"
              />
            )}

            {/* Entity becomes SEARCHABLE with Autocomplete */}
            <FormControl size="small" fullWidth required error={!form.entity_id}>
              <Autocomplete
                options={entities || []}
                getOptionLabel={(e) => `${e.name}${e.entity_type ? ` — ${e.entity_type}` : ''}`}
                value={(entities || []).find(e => String(e.id) === String(form.entity_id)) || null}
                onChange={(_e, val) => setForm(prev => ({ ...prev, entity_id: val ? val.id : '' }))}
                loading={loadingDDL}
                disabled={loadingDDL || submitting}
                isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                renderInput={(params) => (
                  <TextField {...params} label="Entity" size="small" placeholder="Search entity…" />
                )}
              />
              {!form.entity_id && <FormHelperText>Required</FormHelperText>}
            </FormControl>

            {renderSelect(
              'Asset',
              form.asset_id,
              (v) => setForm(prev => ({ ...prev, asset_id: v })),
              assets,
              (a) => a.id,
              (a) => `${a.name}${a.tag_id ? ` — ${a.tag_id}` : ''}`
            )}

            {/* Contract filtered by Cost Centre */}
            {renderSelect(
              'Contract',
              form.contract_id,
              (v) => setForm(prev => ({ ...prev, contract_id: v })),
              form.cost_centre_id ? filteredContracts : [],
              (c) => c.id,
              (c) => `${c.vendor_name || 'Contract'}${c.cost_centre_name ? ` — ${c.cost_centre_name}` : ''}`
            )}

            <TextField
              label="Value Date"
              type="date"
              size="small"
              value={form.value_date || ''}
              onChange={(e) => setForm(prev => ({ ...prev, value_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Remarks"
              size="small"
              value={form.remarks || ''}
              onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={submit} disabled={submitting || loadingDDL || !requiredOk} variant="contained">
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditChildDialog;
