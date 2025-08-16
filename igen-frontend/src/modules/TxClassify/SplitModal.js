import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, IconButton, Stack, Typography, Alert, Box,
  FormControl, InputLabel, Select, MenuItem, CircularProgress, FormHelperText, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
});

const SplitModal = ({ open, onClose, txn, onDone }) => {
  const isResplit = Boolean(txn?.is_split_child && txn?.child?.classification_id);
  const expected = useMemo(() => {
    if (isResplit) return q2(txn?.child?.amount);
    return q2(Math.abs(Number(txn?.signed_amount || 0)));
  }, [txn, isResplit]);

  const txDirection = useMemo(
    () => (Number(txn?.signed_amount || 0) >= 0 ? 'Credit' : 'Debit'),
    [txn]
  );

  const defaultDate = useMemo(() => {
    if (isResplit) return toYMD(txn?.child?.value_date || txn?.transaction_date || txn?.date || '');
    return toYMD(txn?.transaction_date || txn?.date || '');
  }, [txn, isResplit]);

  const defaultRemarks = isResplit ? 'Re-split' : '';

  const [ttypes, setTtypes] = useState([]);
  const [centres, setCentres] = useState([]);
  const [entities, setEntities] = useState([]);
  const [assets, setAssets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loadingDDL, setLoadingDDL] = useState(false);
  const [ddlErr, setDdlErr] = useState('');
  const [rows, setRows] = useState([makeRow(defaultDate, defaultRemarks)]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inFlightRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setRows([makeRow(defaultDate, defaultRemarks)]);
    setErr('');
    setDdlErr('');
    setSubmitted(false);

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
        
        setTtypes(ttypeRows);
        setCentres((cc?.data || []).filter((c) => c.is_active !== false));
        setEntities((en?.data || []).filter((e) => (e.status ?? 'Active').toLowerCase() === 'active'));
        setAssets((as?.data || []).filter((a) => a.is_active !== false));
        setContracts((co?.data || []).filter((c) => c.is_active !== false));
      } catch (e) {
        const canceled = e?.name === 'CanceledError' || e?.message === 'canceled' || e?.code === 'ERR_CANCELED';
        if (!canceled) setDdlErr(extractApiError(e));
      } finally {
        if (inFlightRef.current === ac) setLoadingDDL(false);
      }
    })();

    return () => ac.abort();
  }, [open, txDirection, defaultDate, defaultRemarks]);

  const total = useMemo(
    () => q2(rows.reduce((acc, r) => acc + q2(r.amount), 0)),
    [rows]
  );
  const balanced = total === expected;

  const rowValidity = useMemo(() => rows.map((r) => ({
    transaction_type_id: !!r.transaction_type_id,
    cost_centre_id: !!r.cost_centre_id,
    entity_id: !!r.entity_id,
    amount: q2(r.amount) > 0,
  })), [rows]);

  const allRowsValid = rowValidity.every(
    (v) => v.transaction_type_id && v.cost_centre_id && v.entity_id && v.amount
  );

  const setRow = (i, patch) => setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows(prev => [...prev, makeRow(defaultDate, defaultRemarks)]);
  const delRow = (i) => setRows(prev => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const renderSelect = (label, value, onChange, items, getValue, getLabel, required = false, error = false) => (
    <FormControl size="small" fullWidth required={required} error={error} className="transition-all duration-200 hover:shadow-md">
      <InputLabel className="text-gray-600">{label}</InputLabel>
      <Select
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loadingDDL || submitting}
        className="bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
      >
        <MenuItem value="">
          <em className="text-gray-400">Select {label}</em>
        </MenuItem>
        {items.map((it) => (
          <MenuItem key={String(getValue(it))} value={getValue(it)} className="hover:bg-gray-50">
            {getLabel(it)}
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText className="text-red-500">Required</FormHelperText>}
    </FormControl>
  );

  const onAmountBlur = (idx) => {
    const v = toQ2String(rows[idx].amount || 0);
    setRow(idx, { amount: v });
  };

  const submit = async () => {
    if (!txn) return;
    setSubmitted(true);
    setErr('');

    if (!allRowsValid) {
      setErr('Please complete all required fields and ensure each amount is greater than 0.00.');
      return;
    }
    if (!balanced) {
      const expLbl = `₹${fmtMoney(expected)}`;
      setErr(`Split total must equal ${isResplit ? "selected child's amount" : 'transaction amount'} ${expLbl}.`);
      return;
    }

    setSubmitting(true);
    try {
      if (isResplit) {
        const classificationId = txn?.child?.classification_id;
        const payload = {
          classification_id: classificationId,
          rows: rows.map((r, i) => ({
            transaction_type_id: r.transaction_type_id || null,
            cost_centre_id: r.cost_centre_id || null,
            entity_id: r.entity_id || null,
            asset_id: r.asset_id || null,
            contract_id: r.contract_id || null,
            amount: toQ2String(r.amount),
            value_date: r.value_date || defaultDate || null,
            remarks: r.remarks || `Re-split part ${i + 1}/${rows.length}`,
          })),
        };
        await API.post('tx-classify/resplit/', payload);
      } else {
        if (!txn?.id) return;
        const payload = {
          bank_transaction_id: txn.id,
          rows: rows.map((r, i) => ({
            transaction_type_id: r.transaction_type_id || null,
            cost_centre_id: r.cost_centre_id || null,
            entity_id: r.entity_id || null,
            asset_id: r.asset_id || null,
            contract_id: r.contract_id || null,
            amount: toQ2String(r.amount),
            value_date: r.value_date || defaultDate || null,
            remarks: r.remarks || `Split part ${i + 1}/${rows.length}`,
          })),
        };
        await API.post('tx-classify/split/', payload);
      }
      onDone && onDone();
      onClose && onClose();
    } catch (e) {
      setErr(extractApiError(e) || 'Split failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = isResplit ? 'Re-split Classification' : 'Split Transaction';
  const headerAmount = isResplit ? txn?.child?.amount : txn?.signed_amount;

  const handleClose = (_e, reason) => {
    if (submitting && (reason === 'backdropClick' || reason === 'escapeKeyDown')) return;
    onClose && onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        className: "rounded-2xl shadow-xl bg-white overflow-hidden transition-all duration-300"
      }}
    >
      <DialogTitle className="font-bold text-2xl text-gray-800 border-b border-gray-200 py-4 px-6">
        {title}
      </DialogTitle>

      <DialogContent className="bg-gray-50 px-6 pt-6 pb-4">
        {txn && (
          <Box className="mt-4 mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm flex items-center justify-between">
            <Typography className="text-sm text-gray-600 flex-1">
              <strong>Narration:</strong> {txn.narration}
            </Typography>
            <Box className="flex items-center gap-2">
              {txDirection === 'Credit' ? (
                <ArrowUpwardIcon className="text-green-500" />
              ) : (
                <ArrowDownwardIcon className="text-red-500" />
              )}
              <Typography className="text-sm text-gray-600">
                <strong>{isResplit ? 'Child Amount' : 'Txn Amount'}:</strong> ₹{fmtMoney(headerAmount)}
              </Typography>
            </Box>
            <Typography className="text-sm text-gray-600">
              <strong>Date:</strong> {defaultDate}
            </Typography>
          </Box>
        )}

        {ddlErr && (
          <Alert severity="warning" className="mb-4 rounded-lg">{ddlErr}</Alert>
        )}
        {err && (
          <Alert severity="error" className="mb-4 rounded-lg">{err}</Alert>
        )}

        {loadingDDL ? (
          <Box className="flex justify-center py-8">
            <CircularProgress className="text-blue-500" />
          </Box>
        ) : (
          <Stack spacing={3}>
            {rows.map((r, idx) => {
              const v = rowValidity[idx] || {};
              return (
                <Box
                  key={idx}
                  className={`grid grid-cols-[repeat(6,1fr)_120px_140px_160px_48px] gap-3 p-4 rounded-xl ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } shadow-sm hover:shadow-md transition-shadow duration-200`}
                >
                  {renderSelect(
                    'Transaction Type',
                    r.transaction_type_id,
                    (val) => setRow(idx, { transaction_type_id: val }),
                    ttypes,
                    (t) => t.transaction_type_id,
                    (t) => `${t.name} — ${t.direction}`,
                    true,
                    submitted && !v.transaction_type_id
                  )}
                  {renderSelect(
                    'Cost Centre',
                    r.cost_centre_id,
                    (val) => setRow(idx, { cost_centre_id: val }),
                    centres,
                    (c) => c.cost_centre_id,
                    (c) => `${c.name}${c.transaction_direction ? ` — ${c.transaction_direction}` : ''}`,
                    true,
                    submitted && !v.cost_centre_id
                  )}
                  {renderSelect(
                    'Entity',
                    r.entity_id,
                    (val) => setRow(idx, { entity_id: val }),
                    entities,
                    (e) => e.id,
                    (e) => `${e.name}${e.entity_type ? ` — ${e.entity_type}` : ''}`,
                    true,
                    submitted && !v.entity_id
                  )}
                  {renderSelect(
                    'Asset',
                    r.asset_id,
                    (val) => setRow(idx, { asset_id: val }),
                    assets,
                    (a) => a.id,
                    (a) => `${a.name}${a.tag_id ? ` — ${a.tag_id}` : ''}`
                  )}
                  {renderSelect(
                    'Contract',
                    r.contract_id,
                    (val) => setRow(idx, { contract_id: val }),
                    contracts,
                    (c) => c.id,
                    (c) => `${c.vendor_name || 'Contract'}${c.cost_centre_name ? ` — ${c.cost_centre_name}` : ''}`
                  )}
                  <TextField
                    label="Amount"
                    size="small"
                    value={r.amount}
                    onChange={(e) => setRow(idx, { amount: e.target.value })}
                    onBlur={() => onAmountBlur(idx)}
                    error={submitted && !v.amount}
                    helperText={submitted && !v.amount ? 'Amount > 0' : ''}
                    disabled={submitting}
                    className="bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    InputProps={{ className: 'text-gray-800' }}
                  />
                  <TextField
                    label="Value Date"
                    type="date"
                    size="small"
                    value={r.value_date}
                    onChange={(e) => setRow(idx, { value_date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    disabled={submitting}
                    className="bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    InputProps={{ className: 'text-gray-800' }}
                  />
                  <TextField
                    label="Remarks"
                    size="small"
                    value={r.remarks}
                    onChange={(e) => setRow(idx, { remarks: e.target.value })}
                    disabled={submitting}
                    className="bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    InputProps={{ className: 'text-gray-800' }}
                  />
                  <IconButton
                    onClick={() => delRow(idx)}
                    disabled={rows.length <= 1 || submitting}
                    className="text-red-500 hover:bg-red-100 rounded-full transition-colors duration-200"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              );
            })}

            <Box className="flex justify-between items-center bg-gray-100 p-4 rounded-xl">
              <Button
                startIcon={<AddIcon />}
                onClick={addRow}
                disabled={submitting}
                className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors duration-200"
              >
                Add Row
              </Button>
              <Stack direction="row" spacing={2}>
                <Chip
                  label={`Rows: ${rows.length}`}
                  className="bg-gray-200 text-gray-800"
                  size="small"
                />
                <Chip
                  label={`Total: ₹${fmtMoney(total)}`}
                  className={balanced ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                  size="small"
                />
                <Chip
                  label={`Expected: ₹${fmtMoney(expected)}`}
                  className="bg-gray-200 text-gray-800"
                  size="small"
                />
              </Stack>
            </Box>
          </Stack>
        )}
      </DialogContent>

      <DialogActions className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <Button
          onClick={onClose}
          disabled={submitting}
          className="text-gray-600 hover:bg-gray-200 rounded-lg px-4 py-2 transition-colors duration-200"
        >
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={submitting || !balanced || loadingDDL || !allRowsValid}
          className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 transition-colors duration-200"
        >
          {submitting ? 'Saving…' : isResplit ? 'Save Re-split' : 'Save Split'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SplitModal;