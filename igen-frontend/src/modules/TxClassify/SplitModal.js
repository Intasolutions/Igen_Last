import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, IconButton, Stack, Typography, Alert, Box,
  FormControl, InputLabel, Select, MenuItem, CircularProgress, FormHelperText, Chip
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../../api/axios';

// ---------- utils ----------
const fmtMoney = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const q2 = (v) => {
  const n = Number(String(v ?? 0).replace(/,/g, '').trim() || 0);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
};
const toQ2String = (v) => q2(v).toFixed(2);

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

// --- margin helpers (match backend logic) ---
const MARGIN_RE = /\s*\|?\s*Margin:\s*([0-9]+(?:\.[0-9]{1,2})?)/i;

/** Pull margin value (string) from remarks and return { margin, cleanedRemarks } */
const parseMarginFromRemarks = (remarks) => {
  const text = String(remarks || '');
  const m = text.match(MARGIN_RE);
  if (!m) return { margin: '', cleanedRemarks: text };
  // strip JUST the first margin note occurrence (backend writes one per audit)
  const cleaned = text.replace(MARGIN_RE, '').trim();
  return { margin: m[1] || '', cleanedRemarks: cleaned };
};

// normalize: strip trailing %; return '' if empty
const normalizeMargin = (m) => {
  if (m == null) return '';
  let s = String(m).trim();
  if (!s) return '';
  if (s.endsWith('%')) s = s.slice(0, -1).trim();
  return s;
};

// ---------- row factory ----------
const makeRow = (defaultDate = '', defaultRemarks = '') => ({
  transaction_type_id: '',
  cost_centre_id: '',
  entity_id: '',
  asset_id: '',
  contract_id: '',
  amount: '',
  value_date: defaultDate,
  remarks: defaultRemarks,
  margin: '', // NEW
});

const SplitModal = ({ open, onClose, txn, onDone, initialRows = null, editMode = false }) => {
  const isResplit = Boolean(!editMode && txn?.is_split_child && txn?.child?.classification_id);

  const expected = useMemo(() => {
    if (isResplit) return q2(txn?.child?.amount);
    return q2(Math.abs(Number(txn?.signed_amount || 0)));
  }, [txn, isResplit]);

  const txDirection = useMemo(
    () => (Number(txn?.signed_amount || 0) >= 0 ? 'Credit' : 'Debit'),
    [txn]
  );

  const baseDate = useMemo(() => {
    if (isResplit) return toYMD(txn?.child?.value_date || txn?.transaction_date || txn?.date || '');
    return toYMD(txn?.transaction_date || txn?.date || '');
  }, [txn, isResplit]);

  // Full lists (already filtered by direction for transaction types)
  const [ttypes, setTtypes] = useState([]);
  const [centres, setCentres] = useState([]);
  const [entities, setEntities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loadingDDL, setLoadingDDL] = useState(false);
  const [ddlErr, setDdlErr] = useState('');

  const [rows, setRows] = useState([makeRow(baseDate, isResplit ? 'Re-split' : (editMode ? 'Edit' : ''))]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inFlightRef = useRef(null);

  // Filter helpers per-row based on Cost Centre selection
  const filteredTtypesFor = (ccid) =>
    ccid ? (ttypes || []).filter((t) => String(t.cost_centre) === String(ccid)) : [];

  const filteredContractsFor = (ccid) =>
    ccid ? (contracts || []).filter((c) => String(c.cost_centre) === String(ccid)) : [];

  // Normalize incoming initial rows for edit mode
  const normalizeRow = (r) => {
    // Prefer explicit parsed values if present on the row (supports API that already sends them)
    const explicitMargin = r.margin ?? r.parsed_margin ?? '';
    const explicitRemarks = r.cleaned_remarks ?? r.remarks ?? (editMode ? 'Edit' : '');

    let margin = '';
    let remarks = explicitRemarks;

    if (String(explicitMargin).trim() !== '') {
      margin = String(explicitMargin);
    } else {
      // Fall back to parsing "Margin: x" out of remarks (what your current table provides)
      const parsed = parseMarginFromRemarks(explicitRemarks);
      margin = parsed.margin;
      remarks = parsed.cleanedRemarks;
    }

    return {
      transaction_type_id: r.transaction_type_id ?? r.transaction_type?.id ?? '',
      cost_centre_id: r.cost_centre_id ?? r.cost_centre?.id ?? '',
      entity_id: r.entity_id ?? r.entity?.id ?? '',
      asset_id: r.asset_id ?? r.asset?.id ?? '',
      contract_id: r.contract_id ?? r.contract?.id ?? '',
      amount: String(r.amount ?? ''),
      value_date: r.value_date ? toYMD(r.value_date) : baseDate,
      remarks,
      margin, // NEW (parsed or explicit)
    };
  };

  // Seed rows on open & fetch DDLs
  useEffect(() => {
    if (!open) return;
    setErr('');
    setDdlErr('');
    setSubmitted(false);

    if (editMode && Array.isArray(initialRows) && initialRows.length) {
      // Editing an existing split: normalize each row and pull out margin from remarks
      setRows(initialRows.map(normalizeRow));
    } else {
      // New split or re-split: start with a blank row
      setRows([makeRow(baseDate, isResplit ? 'Re-split' : '')]);
    }

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
        const results = await Promise.allSettled([
          API.get('transaction-types/?status=Active', { signal: ac.signal }),
          API.get('cost-centres/?is_active=true', { signal: ac.signal }),
          API.get('entities/', { signal: ac.signal }),
          API.get('assets/assets/', { signal: ac.signal }),
          API.get('contracts/', { signal: ac.signal }),
        ]);
        const [tt, cc, en, as, co] = results;

        if (tt.status === 'fulfilled') {
          setTtypes((tt.value?.data || []).filter(
            (t) => (t.status?.toLowerCase?.() === 'active') && (t.direction === txDirection)
          ));
        }
        if (cc.status === 'fulfilled') setCentres((cc.value?.data || []).filter((c) => c.is_active !== false));
        if (en.status === 'fulfilled') setEntities((en.value?.data || []).filter((e) => (e.status ?? 'Active').toLowerCase() === 'active'));
        if (as.status === 'fulfilled') {
          const arows = Array.isArray(as.value?.data?.results) ? as.value.data.results
            : Array.isArray(as.value?.data) ? as.value.data : [];
          setAssets(arows.filter((a) => a.is_active !== false).map(a => ({ ...a, id: Number(a.id) })));
        }
        if (co.status === 'fulfilled') {
          const crows = Array.isArray(co.value?.data?.results) ? co.value.data.results
            : Array.isArray(co.value?.data) ? co.value.data : [];
          setContracts(crows.filter((c) => c.is_active !== false).map(c => ({ ...c, id: Number(c.id) })));
        }

        if (results.every(r => r.status === 'rejected')) {
          setDdlErr('Failed to load lists.');
        } else if (results.some(r => r.status === 'rejected') && !ddlErr) {
          setDdlErr('Some lists could not be loaded. Others are available.');
        }
      } catch (e) {
        if (e?.name !== 'CanceledError') setDdlErr(extractApiError(e));
      } finally {
        if (inFlightRef.current === ac) setLoadingDDL(false);
      }
    })();

    return () => ac.abort();
  }, [open, txDirection, baseDate, editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => q2(rows.reduce((acc, r) => acc + q2(r.amount), 0)), [rows]);
  const balanced = total === expected;

  const rowValidity = useMemo(() => rows.map((r) => ({
    transaction_type_id: !!r.transaction_type_id,
    cost_centre_id: !!r.cost_centre_id,
    entity_id: !!r.entity_id,
    amount: q2(r.amount) > 0,
    // NOTE: not making margin required here; backend can enforce if needed.
  })), [rows]);

  const allRowsValid = rowValidity.every((v) => v.transaction_type_id && v.cost_centre_id && v.entity_id && v.amount);

  const setRow = (i, patch) => setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(prev => [...prev, makeRow(baseDate, isResplit ? 'Re-split' : (editMode ? 'Edit' : ''))]);
  const delRow = (i) => setRows(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  // When a row's Cost Centre changes, clear invalid TxType/Contract selections (and margin)
  const onRowCostCentreChange = (idx, newCcId) => {
    const ft = filteredTtypesFor(newCcId);
    const fc = filteredContractsFor(newCcId);
    const patch = { cost_centre_id: newCcId };

    const current = rows[idx] || {};
    if (current.transaction_type_id && !ft.some(t => t.transaction_type_id === current.transaction_type_id)) {
      patch.transaction_type_id = '';
      patch.margin = ''; // clear margin because tx type reset
    }
    if (current.contract_id && !fc.some(c => c.id === current.contract_id)) {
      patch.contract_id = '';
    }
    setRow(idx, patch);
  };

  const renderSelect = (label, value, onChange, items, getValue, getLabel, required = false, error = false) => (
    <FormControl size="small" fullWidth required={required} error={error}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
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

  const onAmountBlur = (idx) => setRow(idx, { amount: toQ2String(rows[idx].amount || 0) });

  const submit = async () => {
    if (!txn) return;
    setSubmitted(true);
    setErr('');

    if (!allRowsValid) {
      setErr('Please complete all required fields and ensure each amount is greater than 0.00.');
      return;
    }
    if (!balanced) {
      setErr(`Split total must equal ${isResplit ? "selected child's" : 'transaction'} amount ₹${fmtMoney(expected)}.`);
      return;
    }

    setSubmitting(true);
    try {
      if (isResplit) {
        const payload = {
          classification_id: txn?.child?.classification_id,
          rows: rows.map((r) => {
            const list = filteredTtypesFor(r.cost_centre_id);
            const selected = (list || []).find(t => t.transaction_type_id === r.transaction_type_id);
            const m = normalizeMargin(r.margin);

            // Build row without spreading r to avoid sending margin:'' accidentally
            const base = {
              transaction_type_id: r.transaction_type_id,
              cost_centre_id: r.cost_centre_id,
              entity_id: r.entity_id,
              asset_id: r.asset_id || null,
              contract_id: r.contract_id || null,
              amount: toQ2String(r.amount),
              value_date: r.value_date || baseDate || null,
              remarks: r.remarks || '',
            };

            return {
              ...base,
              ...(selected?.margin_applicable && m !== '' ? { margin: m } : {}),
            };
          }),
        };
        await API.post('tx-classify/resplit/', payload);
      } else {
        const payload = {
          bank_transaction_id: txn.id,
          rows: rows.map((r) => {
            const list = filteredTtypesFor(r.cost_centre_id);
            const selected = (list || []).find(t => t.transaction_type_id === r.transaction_type_id);
            const m = normalizeMargin(r.margin);

            const base = {
              transaction_type_id: r.transaction_type_id,
              cost_centre_id: r.cost_centre_id,
              entity_id: r.entity_id,
              asset_id: r.asset_id || null,
              contract_id: r.contract_id || null,
              amount: toQ2String(r.amount),
              value_date: r.value_date || baseDate || null,
              remarks: r.remarks || '',
            };

            return {
              ...base,
              ...(selected?.margin_applicable && m !== '' ? { margin: m } : {}),
            };
          }),
        };
        await API.post('tx-classify/split/', payload);
      }
      onDone && onDone();
      onClose && onClose();
    } catch (e) {
      setErr(extractApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle = editMode ? 'Edit Split' : (isResplit ? 'Re-split Classification' : 'Split Transaction');
  const primaryCta = submitting ? 'Saving…' : (editMode ? 'Save Edit' : (isResplit ? 'Save Re-split' : 'Save Split'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 3,
          backgroundColor: '#fafafa',
          boxShadow: 10,
          overflowY: 'hidden'
        }
      }}>
      <DialogTitle className="font-bold text-xl">{dialogTitle}</DialogTitle>
      <DialogContent>
        {txn && (
          <Box className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Typography><strong>Narration:</strong> {txn.narration}</Typography>
            <Typography><strong>Date:</strong> {baseDate}</Typography>
          </Box>
        )}

        {ddlErr && <Alert severity="warning">{ddlErr}</Alert>}
        {err && <Alert severity="error">{err}</Alert>}

        {loadingDDL ? <CircularProgress /> : (
          <Stack spacing={3}>
            <AnimatePresence>
              {rows.map((r, idx) => {
                const v = rowValidity[idx] || {};
                const listTtypes = filteredTtypesFor(r.cost_centre_id);
                const listContracts = filteredContractsFor(r.cost_centre_id);

                // Determine margin applicability for this row
                const selectedTtype = (listTtypes || []).find(t => t.transaction_type_id === r.transaction_type_id);
                const showMargin = Boolean(selectedTtype?.margin_applicable);

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Box className="p-4 rounded-xl shadow bg-white">
                      <Stack spacing={2}>
                        {/* Cost Centre & Entity FIRST */}
                        <Box className="grid grid-cols-2 gap-3">
                          {renderSelect(
                            'Cost Centre',
                            r.cost_centre_id,
                            (val) => onRowCostCentreChange(idx, val),
                            centres,
                            (c) => c.cost_centre_id,
                            (c) => c.name,
                            true,
                            submitted && !v.cost_centre_id
                          )}

                          {/* Entity — searchable via Autocomplete */}
                          <FormControl size="small" fullWidth required error={submitted && !v.entity_id}>
                            <Autocomplete
                              options={entities || []}
                              getOptionLabel={(e) => `${e.name}${e.entity_type ? ` — ${e.entity_type}` : ''}`}
                              value={(entities || []).find(e => String(e.id) === String(r.entity_id)) || null}
                              onChange={(_e, val) => setRow(idx, { entity_id: val ? val.id : '' })}
                              loading={loadingDDL}
                              disabled={loadingDDL || submitting}
                              isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                              renderInput={(params) => (
                                <TextField {...params} label="Entity" size="small" placeholder="Search entity…" />
                              )}
                            />
                            {submitted && !v.entity_id && <FormHelperText>Required</FormHelperText>}
                          </FormControl>
                        </Box>

                        {/* Transaction Type AFTER Cost Centre (filtered by CC) & Asset */}
                        <Box className="grid grid-cols-2 gap-3">
                          {renderSelect(
                            'Transaction Type',
                            r.transaction_type_id,
                            (val) => {
                              // When tx type changes, if new type isn't margin-applicable, clear margin
                              const tt = (listTtypes || []).find(t => t.transaction_type_id === val);
                              const patch = { transaction_type_id: val };
                              if (!(tt?.margin_applicable)) patch.margin = '';
                              setRow(idx, patch);
                            },
                            r.cost_centre_id ? listTtypes : [],
                            (t) => t.transaction_type_id,
                            (t) => `${t.name} — ${t.direction}`,
                            true,
                            submitted && !v.transaction_type_id
                          )}
                          {renderSelect(
                            'Asset',
                            r.asset_id,
                            (val) => setRow(idx, { asset_id: val }),
                            assets,
                            (a) => a.id,
                            (a) => a.name
                          )}
                        </Box>

                        {/* Contract (filtered by CC) & Amount (+ optional Margin) */}
                        <Box className={`grid gap-3 ${showMargin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          {renderSelect(
                            'Contract',
                            r.contract_id,
                            (val) => setRow(idx, { contract_id: val }),
                            r.cost_centre_id ? listContracts : [],
                            (c) => c.id,
                            (c) => c.vendor_name || 'Contract'
                          )}
                          <TextField
                            label="Amount"
                            size="small"
                            value={r.amount}
                            onChange={(e) => setRow(idx, { amount: e.target.value })}
                            onBlur={() => onAmountBlur(idx)}
                            error={submitted && !v.amount}
                            helperText={submitted && !v.amount ? 'Amount > 0' : ''}
                          />
                          {showMargin && (
                            <TextField
                              label="Margin"
                              size="small"
                              value={r.margin}
                              onChange={(e) => setRow(idx, { margin: e.target.value })}
                              placeholder="e.g., 2.5 or 1000"
                              helperText="Shown because this Transaction Type is margin applicable"
                            />
                          )}
                        </Box>

                        <Box className="grid grid-cols-[1fr_2fr_auto] gap-3 items-center">
                          <TextField
                            label="Value Date"
                            type="date"
                            size="small"
                            value={r.value_date}
                            onChange={(e) => setRow(idx, { value_date: e.target.value })}
                            InputLabelProps={{ shrink: true }}
                          />
                          <TextField
                            label="Remarks"
                            size="small"
                            value={r.remarks}
                            onChange={(e) => setRow(idx, { remarks: e.target.value })}
                          />
                          <IconButton onClick={() => delRow(idx)} disabled={rows.length <= 1}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Stack>
                    </Box>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <Box className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <Button startIcon={<AddIcon />} onClick={addRow} disabled={submitting}>
                Add Row
              </Button>
              <Stack direction="row" spacing={2}>
                <Chip label={`Rows: ${rows.length}`} />
                <Chip label={`Total: ₹${fmtMoney(total)}`} color={balanced ? 'success' : 'warning'} />
                <Chip label={`Expected: ₹${fmtMoney(expected)}`} />
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button onClick={submit} disabled={submitting || !balanced || loadingDDL || !allRowsValid} variant="contained">
          {primaryCta}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SplitModal;
