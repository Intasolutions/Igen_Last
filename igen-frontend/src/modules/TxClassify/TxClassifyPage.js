import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Select,
  MenuItem,
  Button,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  Collapse,
  IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SplitsIcon from '@mui/icons-material/CallSplit';
import ClassifyIcon from '@mui/icons-material/Rule';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CloseIcon from '@mui/icons-material/Close';

import API from '../../api/axios';
import SplitModal from './SplitModal';
import SingleClassifyDialog from './SingleClassifyDialog';
import EditChildDialog from './EditChildDialog';
import { debounce } from 'lodash';

// -------- utils --------
const fmtMoney = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '-';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// Build prefill rows for SplitModal from current flattened table rows
const buildInitialSplitRows = (allRows, txnId) => {
  const children = allRows
    .filter((r) => r.is_split_child && r.parent_transaction_id === txnId) // Adjust based on actual field
    .map((r) => r.child)
    .filter(Boolean);

  if (!children.length) return null;

  return children.map((c, idx) => ({
    transaction_type_id: c.transaction_type_id || '',
    cost_centre_id: c.cost_centre_id || '',
    entity_id: c.entity_id || '',
    asset_id: c.asset_id ?? null,
    contract_id: c.contract_id ?? null,
    amount: c.amount,
    value_date: c.value_date || '',
    remarks: c.remarks || `Split part ${idx + 1}/${children.length}`,
  }));
};

// Reusable styles
const themeStyles = {
  inputBase: {
    borderRadius: 4,
    bgcolor: '#f5f5f5',
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&:hover': { bgcolor: '#eceff1' },
    '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
    fontSize: '0.9rem',
    height: 44,
  },
  button: {
    borderRadius: 2,
    bgcolor: '#f5f5f5',
    '&:hover': { bgcolor: '#e3f2fd' },
    '&:disabled': { bgcolor: 'grey.200', color: 'grey.500' },
    fontWeight: 500,
  },
};

// Reusable SVG icons
const BankIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
  </svg>
);

const CreditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2" aria-hidden="true">
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const DebitIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14" strokeLinecap="round" />
  </svg>
);

const TxClassifyPage = () => {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [selectedRowId, setSelectedRowId] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);

  // filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('both');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(true);

  // pagination
  const [limit, setLimit] = useState(200);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // dialogs
  const [splitOpen, setSplitOpen] = useState(false);
  const [singleOpen, setSingleOpen] = useState(false);
  const [activeTxn, setActiveTxn] = useState(null);

  // edit flows
  const [editMode, setEditMode] = useState(false);
  const [initialSplitRows, setInitialSplitRows] = useState(null);
  const [editChildOpen, setEditChildOpen] = useState(false);
  const [activeChild, setActiveChild] = useState(null);

  // Debounced search
  const debouncedSetSearch = useMemo(() => debounce((value) => setSearch(value), 300), []);

  // init: load bank accounts
  useEffect(() => {
    if (!localStorage.getItem('access') && !localStorage.getItem('refresh')) {
      setErr('You are not logged in.');
      return;
    }
    API.get('banks/')
      .then((res) => setBankAccounts(res.data || []))
      .catch((e) => setErr(extractApiError(e) || 'Failed to load bank accounts.'));
  }, []);

  const fetchUnclassified = async () => {
    if (!selectedBankAccount) {
      setRows([]);
      setTotalCount(0);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams({
        bank_account_id: selectedBankAccount,
        type,
        limit: String(limit),
        offset: String(offset),
        unclassified_only: unclassifiedOnly ? '1' : '0',
        flatten_splits: '1',
        include_children: '1',
      });
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (minAmount) params.append('min_amount', minAmount);
      if (maxAmount) params.append('max_amount', maxAmount);

      const res = await API.get(`tx-classify/unclassified/?${params.toString()}`);
      setRows(res?.data?.results || []);
      setTotalCount(Number(res?.data?.count || 0));
    } catch (e) {
      console.error('Error fetching transactions:', e);
      setErr(extractApiError(e) || 'Could not fetch transactions.');
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnclassified();
  }, [selectedBankAccount, type, startDate, endDate, minAmount, maxAmount, unclassifiedOnly, limit, offset]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      const searchableFields = [
        r.narration || '',
        r.utr_number || '',
        r.transaction_date || '',
        r.child?.transaction_type || '',
        r.child?.cost_centre || '',
        r.child?.entity || '',
        r.child?.remarks || '',
      ].join(' ').toLowerCase();
      return searchableFields.includes(term);
    });
  }, [rows, search]);

  // Openers
  const onOpenSplit = (row) => {
    setActiveTxn(row);
    setEditMode(false);
    setInitialSplitRows(null);
    setSplitOpen(true);
  };

  const onOpenSingle = (row) => {
    setActiveTxn(row);
    setSingleOpen(true);
  };

  // Parent edit
  const onOpenEditParent = (row) => {
    const count = Number(row.active_count || 0);
    if (count === 1) {
      const child = Array.isArray(row.children) && row.children[0] ? row.children[0] : null;
      setActiveTxn({
        ...row,
        __initialSingle__: child
          ? {
              transaction_type_id: child.transaction_type_id || '',
              cost_centre_id: child.cost_centre_id || '',
              entity_id: child.entity_id || '',
              asset_id: child.asset_id ?? null,
              contract_id: child.contract_id ?? null,
              amount: Math.abs(Number(row.signed_amount || 0)).toFixed(2),
              value_date: child.value_date || row.transaction_date || '',
              remarks: child.remarks || '',
            }
          : null,
      });
      setSingleOpen(true);
      return;
    }
    const prefill = buildInitialSplitRows(rows, row.id);
    setActiveTxn(row);
    setEditMode(true);
    setInitialSplitRows(prefill);
    setSplitOpen(true);
  };

  // Child edit
  const onOpenEditChild = (row) => {
    const c = row?.child || {};
    setActiveChild({
      classification_id: c.classification_id,
      transaction_type_id: c.transaction_type_id || '',
      cost_centre_id: c.cost_centre_id || '',
      entity_id: c.entity_id || '',
      asset_id: c.asset_id || '',
      contract_id: c.contract_id || '',
      value_date: c.value_date || '',
      remarks: c.remarks || '',
    });
    setEditChildOpen(true);
  };

  const afterActionRefresh = async () => {
    setSplitOpen(false);
    setSingleOpen(false);
    setEditChildOpen(false);
    setActiveTxn(null);
    setActiveChild(null);
    setEditMode(false);
    setInitialSplitRows(null);
    setSelectedRowId(null);
    await fetchUnclassified();
  };

  const resetFilters = () => {
    setSearch('');
    setType('both');
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setUnclassifiedOnly(true);
    setOffset(0);
  };

  const pageFrom = totalCount === 0 ? 0 : offset + 1;
  const pageTo = Math.min(offset + limit, totalCount);
  const canPrev = offset > 0;
  const canNext = offset + limit < totalCount;

  const renderStatusChip = (r) => {
    if (r.is_split_child) {
      return <Chip size="small" label="Split Child" color="secondary" sx={{ borderRadius: 2, fontWeight: 500 }} />;
    }
    const label = r.status || (r.active_count === 0 ? 'Unclassified' : r.active_count === 1 ? 'Classified' : `Split (${r.active_count})`);
    if (label === 'Unclassified')
      return <Chip size="small" label="Unclassified" sx={{ borderRadius: 2, bgcolor: 'grey.200', color: 'text.secondary', fontWeight: 500 }} />;
    if (label === 'Classified') {
      return (
        <Tooltip title={r.last_classified_at ? `Last classified: ${new Date(r.last_classified_at).toLocaleString()}` : ''}>
          <Chip size="small" label="Classified" color="primary" sx={{ borderRadius: 2, fontWeight: 500 }} />
        </Tooltip>
      );
    }
    return (
      <Tooltip title={r.last_classified_at ? `Last classified: ${new Date(r.last_classified_at).toLocaleString()}` : ''}>
        <Chip size="small" label={label} color="secondary" sx={{ borderRadius: 2, fontWeight: 500 }} />
      </Tooltip>
    );
  };

  const renderChildSummary = (child) => {
    if (!child) return '—';
    const bits = [
      child.transaction_type,
      child.cost_centre,
      child.entity,
      child.asset,
      child.contract,
    ].filter(Boolean);
    const base = bits.join(' • ');
    const vd = child.value_date ? ` — ${child.value_date}` : '';
    const rm = child.remarks ? ` — ${child.remarks}` : '';
    return `${base}${vd}${rm}` || '—';
  };

  const renderCredit = (r) => {
    const isChild = !!r.is_split_child;
    if (isChild) {
      const childAmt = Number(r?.child?.amount || 0);
      const isCreditTxn = Number(r.signed_amount) >= 0;
      const credit = isCreditTxn ? childAmt : 0;
      return `₹${fmtMoney(credit)}`;
    }
    return `₹${fmtMoney(r.credit_amount)}`;
  };

  const renderDebit = (r) => {
    const isChild = !!r.is_split_child;
    if (isChild) {
      const childAmt = Number(r?.child?.amount || 0);
      const isCreditTxn = Number(r.signed_amount) >= 0;
      const debit = isCreditTxn ? 0 : childAmt;
      return `₹${fmtMoney(debit)}`;
    }
    return `₹${fmtMoney(r.debit_amount)}`;
  };

  const renderSigned = (r) => {
    const isChild = !!r.is_split_child;
    if (isChild) {
      const childAmt = Number(r?.child?.amount || 0);
      const isCreditTxn = Number(r.signed_amount) >= 0;
      const signed = isCreditTxn ? childAmt : -childAmt;
      return <Chip size="small" label={`₹${fmtMoney(signed)}`} color={signed >= 0 ? 'success' : 'error'} variant="outlined" sx={{ borderRadius: 2, fontWeight: 500 }} />;
    }
    return <Chip size="small" label={`₹${fmtMoney(r.signed_amount)}`} color={Number(r.signed_amount) >= 0 ? 'success' : 'error'} variant="outlined" sx={{ borderRadius: 2, fontWeight: 500 }} />;
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: '1400px', mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
        <BankIcon />
        Review & Classify Transactions
      </Typography>

      {/* Controls */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 4,
          border: '1px solid rgba(0,0,0,0.03)',
          bgcolor: '#ffffff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          transition: 'all 0.3s ease',
          '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{
            '& > *': {
              transition: 'all 0.2s ease',
              '&:focus-within': {
                transform: 'translateY(-2px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              },
            },
          }}
        >
          <Select
            value={selectedBankAccount}
            onChange={(e) => { setSelectedBankAccount(e.target.value); setOffset(0); }}
            displayEmpty
            size="small"
            sx={{
              minWidth: 280,
              ...themeStyles.inputBase,
              '& .MuiSelect-select': { py: 1.4, pl: 2 },
              '& .MuiSvgIcon-root': { color: 'grey.500' },
            }}
          >
            <MenuItem value="" disabled>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <BankIcon />
                Select Bank Account
              </Box>
            </MenuItem>
            {bankAccounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <BankIcon />
                  {a.bank_name} - {a.account_number}
                </Box>
              </MenuItem>
            ))}
          </Select>

          <TextField
            type="date"
            size="small"
            label="Start Date"
            InputLabelProps={{ shrink: true, sx: { color: 'grey.600', fontWeight: 500 } }}
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setOffset(0); }}
            sx={{ width: 160, '& .MuiInputBase-root': { ...themeStyles.inputBase, '& input': { py: 1.4 } } }}
          />
          <TextField
            type="date"
            size="small"
            label="End Date"
            InputLabelProps={{ shrink: true, sx: { color: 'grey.600', fontWeight: 500 } }}
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setOffset(0); }}
            sx={{ width: 160, '& .MuiInputBase-root': { ...themeStyles.inputBase, '& input': { py: 1.4 } } }}
          />
          <TextField
            size="small"
            label="Min Amount"
            value={minAmount}
            onChange={(e) => { setMinAmount(e.target.value); setOffset(0); }}
            InputLabelProps={{ sx: { color: 'grey.600', fontWeight: 500 } }}
            sx={{ width: 140, '& .MuiInputBase-root': { ...themeStyles.inputBase, '& input': { py: 1.4 } } }}
          />
          <TextField
            size="small"
            label="Max Amount"
            value={maxAmount}
            onChange={(e) => { setMaxAmount(e.target.value); setOffset(0); }}
            InputLabelProps={{ sx: { color: 'grey.600', fontWeight: 500 } }}
            sx={{ width: 140, '& .MuiInputBase-root': { ...themeStyles.inputBase, '& input': { py: 1.4 } } }}
          />
          <Select
            size="small"
            value={type}
            onChange={(e) => { setType(e.target.value); setOffset(0); }}
            sx={{
              minWidth: 140,
              ...themeStyles.inputBase,
              '& .MuiSelect-select': { py: 1.4, pl: 2 },
              '& .MuiSvgIcon-root': { color: 'grey.500' },
            }}
          >
            <MenuItem value="both">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <BankIcon />
                Both
              </Box>
            </MenuItem>
            <MenuItem value="credit">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CreditIcon />
                Credit
              </Box>
            </MenuItem>
            <MenuItem value="debit">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <DebitIcon />
                Debit
              </Box>
            </MenuItem>
          </Select>
          <TextField
            placeholder="Search by narration, UTR, or classification"
            size="small"
            value={search}
            onChange={(e) => debouncedSetSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'grey.500', fontSize: 22 }} />
                </InputAdornment>
              ),
              sx: { ...themeStyles.inputBase },
            }}
            sx={{ minWidth: 320 }}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
              bgcolor: unclassifiedOnly ? '#1976d2' : '#f5f5f5',
              color: unclassifiedOnly ? '#ffffff' : '#424242',
              height: 44,
              px: 2,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: unclassifiedOnly ? '#1565c0' : '#eceff1',
                transform: 'translateY(-1px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              },
            }}
            onClick={() => { setUnclassifiedOnly(!unclassifiedOnly); setOffset(0); }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={unclassifiedOnly ? '#ffffff' : '#424242'} strokeWidth="2" aria-hidden="true">
                <path d={unclassifiedOnly ? 'M20 6L9 17l-5-5' : 'M3 7h18M3 12h18M3 17h18'} strokeLinecap="round" />
              </svg>
              Unclassified Only
            </Box>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchUnclassified}
            disabled={!selectedBankAccount || loading}
            sx={{
              ...themeStyles.button,
              borderColor: 'grey.300',
              color: '#1976d2',
              px: 3,
              fontSize: '0.9rem',
            }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={resetFilters}
            disabled={loading}
            sx={{
              ...themeStyles.button,
              borderColor: 'grey.300',
              color: '#424242',
              px: 3,
              fontSize: '0.9rem',
            }}
          >
            Reset Filters
          </Button>
        </Stack>
      </Paper>

      {err && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', bgcolor: '#ffebee', color: '#d32f2f', '& .MuiAlert-icon': { color: '#d32f2f' } }}
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setErr('')}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {err}
        </Alert>
      )}

      {/* Table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(0,0,0,0.03)',
          bgcolor: '#fafafa',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: 3 },
        }}
      >
        <Table size="small" aria-label="Transaction classification table">
          <TableHead>
            <TableRow sx={{ '& th': { backgroundColor: '#e3f2fd', borderBottom: '1px solid #bbdefb', fontWeight: 600, color: '#1565c0', py: 1.5 } }}>
              <TableCell></TableCell>
              <TableCell>Date</TableCell>

              <TableCell>Credit</TableCell>
              <TableCell>Debit</TableCell>
              <TableCell>Signed</TableCell>
              <TableCell>Balance</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>UTR</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} sx={{ color: '#1976d2' }} /> Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length > 0 ? (
              filtered.map((r) => {
                const isChild = !!r.is_split_child;
                const isUnclassifiedParent = !isChild && Number(r.active_count || 0) === 0;
                const isExpanded = expandedRow === r.id;

                return (
                  <React.Fragment key={isChild ? r.child.classification_id : r.id}>
                    <TableRow
                      hover
                      onClick={() => {
                        if (isUnclassifiedParent) {
                          setSelectedRowId(r.id);
                          onOpenSingle(r);
                        }
                      }}
                      sx={{
                        cursor: isUnclassifiedParent ? 'pointer' : 'default',
                        backgroundColor: selectedRowId === r.id ? '#e3f2fd' : 'inherit',
                        borderLeft: selectedRowId === r.id ? '4px solid #1976d2' : '4px solid transparent',
                        transition: 'all 0.2s ease',
                        '&:hover': { backgroundColor: '#e3f2fd' },
                        '& td': { borderBottom: '1px solid rgba(0,0,0,0.05)', py: 1.2, fontSize: '0.9rem' },
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRow(isExpanded ? null : r.id);
                          }}
                        >
                          {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>{r.transaction_date}</TableCell>
                    
              
                      <TableCell sx={{ color: '#2e7d32' }}>{renderCredit(r)}</TableCell>
                      <TableCell sx={{ color: '#d32f2f' }}>{renderDebit(r)}</TableCell>
                      <TableCell>{renderSigned(r)}</TableCell>
                      <TableCell sx={{ color: '#1976d2' }}>₹{fmtMoney(r.balance_amount)}</TableCell>
                      <TableCell>{renderStatusChip(r)}</TableCell>
                      <TableCell>{r.utr_number || '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
                          {/* <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ClassifyIcon />}
                            onClick={() => onOpenSingle(r)}
                            disabled={!isUnclassifiedParent}
                            sx={{
                              ...themeStyles.button,
                              borderColor: 'grey.300',
                              color: '#1976d2',
                              px: 2,
                            }}
                          >
                            Classify
                          </Button> */}
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<SplitsIcon />}
                            onClick={() => onOpenSplit(r)}
                            sx={{
                              borderRadius: 2,
                              bgcolor: '#1976d2',
                              '&:hover': { bgcolor: '#1565c0' },
                              '&:disabled': { bgcolor: 'grey.200', color: 'grey.500' },
                              fontWeight: 500,
                              px: 2,
                            }}
                          >
                            Split
                          </Button>
                          {!isChild && Number(r.active_count || 0) > 0 && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<EditIcon />}
                              onClick={() => onOpenEditParent(r)}
                              sx={{ color: '#1976d2', fontWeight: 500 }}
                              title="Edit this transaction’s existing classification(s)"
                            >
                              Edit
                            </Button>
                          )}
                          {isChild && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<EditIcon />}
                              onClick={() => onOpenEditChild(r)}
                              sx={{ color: '#1976d2', fontWeight: 500 }}
                              title="Edit this child classification’s metadata"
                            >
                              Edit
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={11}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Transaction Details
                            </Typography>
                            <Typography variant="body2">Narration: {r.narration}</Typography>
                            <Typography variant="body2">Classification: {isChild ? renderChildSummary(r.child) : '—'}</Typography>
                           
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={11} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                  {selectedBankAccount ? 'No transactions found for the current filters.' : 'Select a bank account to begin.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination footer */}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="flex-end"
        sx={{ mt: 2, bgcolor: '#fafafa', p: 1.5, borderRadius: 3, border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      >
        <Typography variant="body2" sx={{ mr: 2, color: '#424242', fontWeight: 500 }}>
          {totalCount ? `Showing ${pageFrom}-${pageTo} of ${totalCount}` : 'No results'}
        </Typography>
        <Select
          size="small"
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
          sx={{
            width: 90,
            ...themeStyles.inputBase,
            '& .MuiSelect-select': { py: 1 },
          }}
        >
          <MenuItem value={50}>50</MenuItem>
          <MenuItem value={100}>100</MenuItem>
          <MenuItem value={200}>200</MenuItem>
        </Select>
        <Button
          size="small"
          startIcon={<ChevronLeftIcon />}
          disabled={!canPrev || loading}
          onClick={() => setOffset(Math.max(0, offset - limit))}
          sx={{ ...themeStyles.button, color: '#1976d2' }}
        >
          Prev
        </Button>
        <Button
          size="small"
          endIcon={<ChevronRightIcon />}
          disabled={!canNext || loading}
          onClick={() => setOffset(offset + limit)}
          sx={{ ...themeStyles.button, color: '#1976d2' }}
        >
          Next
        </Button>
      </Stack>

      {/* Dialogs */}
      <SplitModal
        open={splitOpen}
        onClose={() => { setSplitOpen(false); setEditMode(false); setInitialSplitRows(null); }}
        txn={activeTxn}
        onDone={afterActionRefresh}
        editMode={editMode}
        initialRows={initialSplitRows}
      />
      <SingleClassifyDialog
        open={singleOpen}
        onClose={() => setSingleOpen(false)}
        txn={activeTxn}
        onDone={afterActionRefresh}
        editMode={Boolean(activeTxn?.__initialSingle__)}
        initial={activeTxn?.__initialSingle__ || null}
      />
      <EditChildDialog
        open={editChildOpen}
        onClose={() => setEditChildOpen(false)}
        child={activeChild}
        onDone={afterActionRefresh}
      />
    </Box>
  );
};

export default TxClassifyPage;
