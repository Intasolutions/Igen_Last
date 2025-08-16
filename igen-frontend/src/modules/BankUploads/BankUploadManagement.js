
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, MenuItem, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, TablePagination, TextField, InputAdornment, Chip, Stack, Divider, Card, CardContent, Tooltip,
  Snackbar, Badge, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import API from '../../api/axios';
import FileUploader from '../../components/FileUploader';
import { styled } from '@mui/material/styles';

const LOCAL_BATCH_KEY = 'last_upload_batch_id';
const LOCAL_ACCOUNT_KEY = 'last_selected_bank_account';

const SummaryItem = ({ label, value, intent }) => (
  <Chip
    label={`${label}: ${value}`}
    color={intent === 'good' ? 'success' : intent === 'bad' ? 'error' : 'default'}
    variant="filled"
    sx={{
      fontWeight: 500,
      borderRadius: '8px',
      height: '32px',
      '& .MuiChip-label': { fontSize: '0.9rem' }
    }}
  />
);

// Robust formatter (keeps 2 decimals, returns "-" for empty)
const fmtMoney = (v) => {
  if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '-';
  return Number(v).toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BankUploadManagement = () => {
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [bankAccountError, setBankAccountError] = useState(null);
  const [file, setFile] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState(null);
  const [response, setResponse] = useState(null);
  const [recentUploads, setRecentUploads] = useState([]);
  const [batchTotals, setBatchTotals] = useState({ total_credit: 0, total_debit: 0, final_balance: 0 });
  const [uploadedTransactions, setUploadedTransactions] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [openDialog, setOpenDialog] = useState(false);

  // ---------------- helpers ----------------
  const resetTables = () => {
    setUploadedTransactions([]);
    setBatchTotals({ total_credit: 0, total_debit: 0, final_balance: 0 });
    setSearchTerm('');
    setTypeFilter('ALL');
    setPage(0);
  };

  const fetchBatchSummary = async (batchId, setFromRecentList = false) => {
    setLoadingTable(true);
    setError(null);
    try {
      const res = await API.get(`bank-uploads/batch-transactions/?batch_id=${batchId}`);
      setUploadedTransactions(res.data.transactions || []);
      setBatchTotals({
        total_credit: res.data.total_credit ?? 0,
        total_debit: res.data.total_debit ?? 0,
        final_balance: res.data.final_balance ?? 0,
      });
      if (!setFromRecentList) {
        setResponse(prev => ({
          ...(prev || {}),
          upload_batch_id: batchId,
          uploaded: res.data.transactions?.length ?? 0,
        }));
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || 'Could not fetch previous upload summary.');
      setResponse(null);
      resetTables();
    } finally {
      setLoadingTable(false);
    }
  };

  // ---------------- effects ----------------
  useEffect(() => {
    const fetchBankAccounts = async () => {
      setBankAccountError(null);
      try {
        const res = await API.get('banks/');
        if (Array.isArray(res.data)) {
          setBankAccounts(res.data);
          const savedAccount = localStorage.getItem(LOCAL_ACCOUNT_KEY);
          if (savedAccount && res.data.some(account => account.id === savedAccount)) {
            setSelectedBankAccount(savedAccount);
          } else {
            localStorage.removeItem(LOCAL_ACCOUNT_KEY);
          }
        } else {
          setBankAccountError('Unexpected response format for bank accounts.');
        }
      } catch (err) {
        setBankAccountError(err?.response?.data?.detail || 'Failed to fetch bank accounts. Please try again.');
      }
    };
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    const savedAccount = localStorage.getItem(LOCAL_ACCOUNT_KEY);
    const savedBatchId = localStorage.getItem(LOCAL_BATCH_KEY);
    if (savedAccount && bankAccounts.some(account => account.id === savedAccount)) {
      setSelectedBankAccount(savedAccount);
      if (savedBatchId) fetchBatchSummary(savedBatchId, true);
    }
  }, [bankAccounts]);

  useEffect(() => {
    const run = async () => {
      if (!selectedBankAccount) return;
      setLoadingTable(true);
      try {
        const ru = await API.get(`bank-uploads/recent-uploads/?bank_account_id=${selectedBankAccount}`);
        const list = ru?.data?.recent_uploads || [];
        setRecentUploads(list);
        if (list.length > 0) {
          const latest = list[0];
          localStorage.setItem(LOCAL_BATCH_KEY, latest.batch_id);
          await fetchBatchSummary(latest.batch_id, true);
        } else {
          resetTables();
          setResponse(null);
        }
      } catch (err) {
        setRecentUploads([]);
        resetTables();
        setResponse(null);
        setError('Failed to fetch recent uploads.');
      } finally {
        setLoadingTable(false);
      }
    };
    run();
  }, [selectedBankAccount]);

  // ---------------- handlers ----------------
  const handleBankAccountChange = (e) => {
    const value = e.target.value;
    setSelectedBankAccount(value);
    localStorage.setItem(LOCAL_ACCOUNT_KEY, value);
    setFile([]);
    setError(null);
    setResponse(null);
    resetTables();
    setRecentUploads([]);
    setSnackbar({ open: true, message: 'Bank account selected.', severity: 'info' });
  };

  const handleFileChange = (files) => {
    if (!files || files.length > 1) {
      setSnackbar({ open: true, message: 'Please upload only one CSV file.', severity: 'error' });
      setFile([]);
      return;
    }
    const f = files[0];
    const name = f?.name?.toLowerCase() || '';
    const ok = name.endsWith('.csv') || f?.type === 'text/csv';
    if (f && ok) {
      setFile([f]);
      setError(null);
      setSnackbar({ open: true, message: `File selected: ${f.name}`, severity: 'info' });
    } else {
      setFile([]);
      setError('Please upload a valid CSV file.');
      setSnackbar({ open: true, message: 'Invalid file type. Please upload a CSV file.', severity: 'error' });
    }
  };

  const handleUpload = async () => {
    if (!selectedBankAccount) {
      setError('Please select a bank account.');
      setSnackbar({ open: true, message: 'Please select a bank account.', severity: 'error' });
      return;
    }
    if (!file?.length) {
      setError('Please upload a CSV file.');
      setSnackbar({ open: true, message: 'Please upload a CSV file.', severity: 'error' });
      return;
    }

    const formData = new FormData();
    formData.append('bank_account_id', selectedBankAccount);
    formData.append('file', file[0]);

    setUploading(true);
    setError(null);
    setResponse(null);
    resetTables();

    try {
      const res = await API.post('bank-uploads/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResponse(res.data);
      localStorage.setItem(LOCAL_BATCH_KEY, res.data.upload_batch_id);
      localStorage.setItem(LOCAL_ACCOUNT_KEY, selectedBankAccount);
      setSnackbar({ open: true, message: 'CSV file uploaded successfully!', severity: 'success' });
      setOpenDialog(false);

      if (res.data.upload_batch_id) {
        await fetchBatchSummary(res.data.upload_batch_id);
        try {
          const ru = await API.get(`bank-uploads/recent-uploads/?bank_account_id=${selectedBankAccount}`);
          setRecentUploads(ru?.data?.recent_uploads || []);
        } catch {}
      }
    } catch (err) {
      let message = err?.response?.data?.error || err?.response?.data?.detail || 'Upload failed.';
      if (err?.response?.data?.details) message += ': ' + err.response.data.details.join(' | ');
      setError(message);
      setResponse({ errors: err?.response?.data?.errors || [], ...err?.response?.data });
      setSnackbar({ open: true, message: message, severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
    setFile([]);
    setError(null);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFile([]);
    setError(null);
  };

  // ---------------- filtering/pagination ----------------
  const filteredTransactions = useMemo(() => {
    let data = uploadedTransactions;
    if (typeFilter !== 'ALL') {
      data = data.filter(t =>
        typeFilter === 'CREDIT' ? Number(t.credit_amount) > 0 : Number(t.debit_amount) > 0
      );
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      data = data.filter(
        t =>
          (t.narration && t.narration.toLowerCase().includes(term)) ||
          (t.utr_number && String(t.utr_number).toLowerCase().includes(term)) ||
          (t.transaction_date && String(t.transaction_date).toLowerCase().includes(term))
      );
    }
    return data;
  }, [uploadedTransactions, searchTerm, typeFilter]);

  const paginatedTransactions = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredTransactions.slice(start, start + rowsPerPage);
  }, [filteredTransactions, page, rowsPerPage]);

  // ---------------- render ----------------
  return (
    <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: '1400px', mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
          Bank Transaction Upload
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Tooltip title="Select a bank account to upload transactions">
            <Select
              value={selectedBankAccount}
              onChange={handleBankAccountChange}
              displayEmpty
              size="medium"
              sx={{
                minWidth: 200,
                borderRadius: 2,
                backgroundColor: 'white',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'grey.300' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                '& .MuiSelect-select': { py: 1.5 }
              }}
              disabled={uploading || bankAccounts.length === 0}
            >
              <MenuItem value="" disabled>
                {bankAccounts.length === 0 ? 'No Bank Accounts Available' : 'Select Bank Account'}
              </MenuItem>
              {bankAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.bank_name} - {a.account_number}
                </MenuItem>
              ))}
            </Select>
          </Tooltip>
          <Button
            variant="contained"
            onClick={handleOpenDialog}
            disabled={uploading || !selectedBankAccount}
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
              '&:hover': { background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)' },
              '&:disabled': { background: 'grey.400' }
            }}
          >
            Upload File
          </Button>
        </Box>
      </Box>

      {/* Upload Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Bank Transactions</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <FileUploader
              mode="add"
              onFilesChange={handleFileChange}
              onUpload={handleFileChange}
              uploading={uploading}
              selectedFiles={file}
              setSelectedFiles={setFile}
              accept=".csv"
              maxFiles={1}
            />
            {error && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={uploading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={uploading || !file?.length}
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
              '&:hover': { background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)' },
              '&:disabled': { background: 'grey.400' }
            }}
          >
            {uploading ? <CircularProgress size={24} color="inherit" /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bank Account Error */}
      {bankAccountError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {bankAccountError}
        </Alert>
      )}

      {/* Row Errors */}
      {response?.errors?.length > 0 && (
        <Card sx={{ 
          mb: 3, 
          p: 3, 
          borderRadius: 4, 
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', 
          background: 'linear-gradient(145deg, #ffffff, #f8fafc)', 
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }
        }}>
          <CardContent>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                fontWeight: 600, 
                color: 'error.main',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v.01M12 8v4" />
              </svg>
              {response.errors.length} Row(s) with Errors
            </Typography>
            <Box component="ul" sx={{ pl: 3, m: 0, maxHeight: 200, overflowY: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: 3 } }}>
              {response.errors.map((err, idx) => (
                <li key={idx}>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      py: 1, 
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary', bgcolor: 'grey.100', borderRadius: 2, px: 1, transition: 'all 0.2s ease' }
                    }}
                  >
                    Row {err.row}: {err.error || JSON.stringify(err.errors)}
                  </Typography>
                </li>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Validation & Upload Summary */}
      {response && (
        <Card sx={{ 
          mb: 3, 
          p: 3, 
          borderRadius: 4, 
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)', 
          background: 'linear-gradient(145deg, #ffffff, #f5f7fa)', 
          border: '1px solid rgba(0,0,0,0.05)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }
        }}>
          <CardContent>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2, 
                fontWeight: 600, 
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Upload Summary
            </Typography>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={2} 
              flexWrap="wrap" 
              sx={{ 
                gap: 1.5,
                '& > *': { 
                  transition: 'transform 0.2s ease',
                  '&:hover': { transform: 'scale(1.05)' }
                }
              }}
            >
              <SummaryItem
                label="Balance Continuity"
                value={response.balance_continuity_in_file || response.balance_continuity || '—'}
                intent={(response.balance_continuity_in_file || response.balance_continuity) === 'Valid' ? 'good' : 'bad'}
                sx={{
                  bgcolor: (response.balance_continuity_in_file || response.balance_continuity) === 'Valid' ? 'success.light' : 'error.light',
                  color: (response.balance_continuity_in_file || response.balance_continuity) === 'Valid' ? 'success.contrastText' : 'error.contrastText',
                  borderRadius: '12px',
                  fontWeight: 500,
                  px: 2,
                  py: 1
                }}
              />
              <SummaryItem
                label="Prev Ending Balance Match"
                value={typeof response.previous_ending_balance_match === 'boolean'
                  ? (response.previous_ending_balance_match ? 'Yes' : 'No')
                  : '—'}
                intent={response.previous_ending_balance_match === true ? 'good' : (response.previous_ending_balance_match === false ? 'bad' : undefined)}
                sx={{
                  bgcolor: response.previous_ending_balance_match === true ? 'success.light' : response.previous_ending_balance_match === false ? 'error.light' : 'grey.100',
                  color: response.previous_ending_balance_match === true ? 'success.contrastText' : response.previous_ending_balance_match === false ? 'error.contrastText' : 'text.primary',
                  borderRadius: '12px',
                  fontWeight: 500,
                  px: 2,
                  py: 1
                }}
              />
              <SummaryItem
                label="Duplicate Rows Found"
                value={typeof response.duplicate_rows_found === 'boolean'
                  ? (response.duplicate_rows_found ? 'Yes' : 'No')
                  : (response.skipped_duplicates > 0 ? 'Yes' : 'No')}
                intent={(response.duplicate_rows_found || response.skipped_duplicates > 0) ? 'bad' : 'good'}
                sx={{
                  bgcolor: (response.duplicate_rows_found || response.skipped_duplicates > 0) ? 'error.light' : 'success.light',
                  color: (response.duplicate_rows_found || response.skipped_duplicates > 0) ? 'error.contrastText' : 'success.contrastText',
                  borderRadius: '12px',
                  fontWeight: 500,
                  px: 2,
                  py: 1
                }}
              />
              <SummaryItem
                label="Total Transactions Uploaded"
                value={typeof response.uploaded === 'number' ? response.uploaded : (uploadedTransactions?.length || 0)}
                sx={{
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  borderRadius: '12px',
                  fontWeight: 500,
                  px: 2,
                  py: 1
                }}
              />
              <SummaryItem
                label="Skipped Duplicates"
                value={response.skipped_duplicates ?? 0}
                intent={response.skipped_duplicates > 0 ? 'bad' : 'good'}
                sx={{
                  bgcolor: response.skipped_duplicates > 0 ? 'error.light' : 'success.light',
                  color: response.skipped_duplicates > 0 ? 'error.contrastText' : 'success.contrastText',
                  borderRadius: '12px',
                  fontWeight: 500,
                  px: 2,
                  py: 1
                }}
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {(batchTotals.total_credit !== 0 || batchTotals.total_debit !== 0 || batchTotals.final_balance !== 0) && (
        <Card sx={{ 
          mb: 3, 
          p: 3, 
          borderRadius: 3, 
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)', 
          background: 'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)', 
          border: '1px solid rgba(0,0,0,0.03)',
          overflow: 'hidden',
          transition: 'all 0.3s ease-in-out',
          '&:hover': { 
            boxShadow: '0 6px 20px rgba(0,0,0,0.1)', 
            transform: 'translateY(-2px)' 
          }
        }}>
          <CardContent sx={{ p: 0 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 2.5, 
                px: 2,
                fontWeight: 700, 
                color: '#1a1a1a',
                letterSpacing: '-0.02em',
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5 
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v20M2 12h20" strokeLinecap="round" />
              </svg>
              Batch Totals
            </Typography>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              spacing={2} 
              sx={{ 
                px: 2,
                '& > *': { 
                  flex: 1, 
                  py: 2, 
                  px: 2.5,
                  borderRadius: 2, 
                  bgcolor: 'rgba(255,255,255,0.9)', 
                  border: '1px solid rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  '&:hover': { 
                    bgcolor: 'primary.light', 
                    color: 'primary.contrastText',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }
                }
              }}
            >
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 600, 
                  color: '#2e7d32', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontSize: '1.1rem'
                }}
              >
                Total Credit: {fmtMoney(batchTotals.total_credit)}
              </Typography>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 600, 
                  color: '#d32f2f', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontSize: '1.1rem'
                }}
              >
                Total Debit: {fmtMoney(batchTotals.total_debit)}
              </Typography>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 600, 
                  color: '#1976d2', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontSize: '1.1rem'
                }}
              >
                Final Balance: {fmtMoney(batchTotals.final_balance)}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
      <Divider sx={{ my: 3 }} />

      {/* Transactions Table */}
      <Card sx={{ 
        mb: 3, 
        borderRadius: 4, 
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)', 
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.03)',
        transition: 'all 0.3s ease',
        '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }
      }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600, 
                color: '#1a1a1a', 
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
              </svg>
              Uploaded Transactions
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center', 
              flexWrap: 'wrap',
              '& > *': { 
                transition: 'all 0.2s ease',
                '&:focus-within': { transform: 'translateY(-2px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }
              }
            }}>
              <TextField
                variant="outlined"
                size="small"
                placeholder="Search narration, UTR, or date"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'grey.500', fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  sx: {
                    borderRadius: 3,
                    bgcolor: '#f5f5f5',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '&:hover': { bgcolor: '#eceff1' },
                    '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
                    fontSize: '0.9rem',
                    height: 40,
                  }
                }}
                sx={{ 
                  width: { xs: '100%', sm: 320 }, 
                  '& .MuiInputBase-root': { 
                    pr: 1,
                    '& input': { py: 1.2 }
                  }
                }}
              />
              <Select
                size="small"
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
                sx={{
                  minWidth: 140,
                  borderRadius: 3,
                  bgcolor: '#f5f5f5',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover': { bgcolor: '#eceff1' },
                  '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
                  fontSize: '0.9rem',
                  height: 40,
                  '& .MuiSelect-select': { py: 1.2 }
                }}
              >
                <MenuItem value="ALL">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
                    </svg>
                    All
                  </Box>
                </MenuItem>
                <MenuItem value="CREDIT">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    Credit
                  </Box>
                </MenuItem>
                <MenuItem value="DEBIT">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2">
                      <path d="M5 12h14" strokeLinecap="round" />
                    </svg>
                    Debit
                  </Box>
                </MenuItem>
oplasia
              </Select>
            </Box>
          </Box>
          <TableContainer sx={{ 
            maxHeight: 400, 
            '&::-webkit-scrollbar': { width: 6 }, 
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'grey.300', borderRadius: 3 },
            borderRadius: 2,
            bgcolor: '#fafafa'
          }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ 
                  '& th': { 
                    backgroundColor: '#e3f2fd', 
                    borderBottom: '1px solid #bbdefb',
                    fontWeight: 600,
                    color: '#1565c0',
                    py: 1.5
                  } 
                }}>
                  <TableCell>Date</TableCell>
                  <TableCell>Narration</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell>UTR</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingTable ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={26} sx={{ color: '#1976d2' }} /> Loading...
                    </TableCell>
                  </TableRow>
                ) : paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((item, idx) => (
                    <TableRow 
                      key={idx} 
                      hover 
                      sx={{ 
                        '&:hover': { 
                          backgroundColor: '#e3f2fd', 
                          transition: 'background-color 0.2s ease' 
                        },
                        '& td': { 
                          borderBottom: '1px solid rgba(0,0,0,0.05)',
                          py: 1.2,
                          fontSize: '0.9rem'
                        }
                      }}
                    >
                      <TableCell>{item.transaction_date}</TableCell>
                      <TableCell>{item.narration}</TableCell>
                      <TableCell align="right" sx={{ color: '#2e7d32' }}>{fmtMoney(item.credit_amount)}</TableCell>
                      <TableCell align="right" sx={{ color: '#d32f2f' }}>{fmtMoney(item.debit_amount)}</TableCell>
                      <TableCell align="right" sx={{ color: '#1976d2' }}>{fmtMoney(item.balance_amount)}</TableCell>
                      <TableCell>{item.utr_number || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary', fontStyle: 'italic' }}>
                      No transactions to display.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredTransactions.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            sx={{ 
              '.MuiTablePagination-toolbar': { 
                borderTop: '1px solid rgba(0,0,0,0.05)', 
                bgcolor: '#fafafa', 
                color: '#424242',
                '& .MuiSelect-select': { py: 1 },
                '& .MuiIconButton-root': { color: '#1976d2' }
              }
            }}
          />
        </CardContent>
      </Card>

      {/* Skipped Duplicates */}
      {response?.skipped_rows?.length > 0 && (
        <Card sx={{ mb: 3, borderRadius: 3, boxShadow: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Skipped Duplicate Transactions
            </Typography>
            <TableContainer sx={{ maxHeight: 300, '&::-webkit-scrollbar': { display: 'none' }, '-ms-overflow-style': 'none', 'scrollbar-width': 'none' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { backgroundColor: 'background.paper', borderBottom: '2px solid #e0e0e0' } }}>
                    <TableCell>Date</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>UTR</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {response.skipped_rows.map((item, idx) => (
                    <TableRow key={idx} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                      <TableCell>{item.transaction_date}</TableCell>
                      <TableCell>{item.narration}</TableCell>
                      <TableCell align="right">{fmtMoney(item.credit_amount)}</TableCell>
                      <TableCell align="right">{fmtMoney(item.debit_amount)}</TableCell>
                      <TableCell align="right">{fmtMoney(item.balance_amount)}</TableCell>
                      <TableCell>{item.utr_number || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Uploads */}
      {selectedBankAccount && (
        <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Recent Uploads
            </Typography>
            <TableContainer sx={{ maxHeight: 300, '&::-webkit-scrollbar': { display: 'none' }, '-ms-overflow-style': 'none', 'scrollbar-width': 'none' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ '& th': { backgroundColor: 'background.paper', borderBottom: '2px solid #e0e0e0' } }}>
                    <TableCell>Upload Date</TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell align="center">Transactions</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentUploads.length > 0 ? recentUploads.map((item, idx) => (
                    <TableRow key={idx} hover sx={{ '&:hover': { backgroundColor: 'action.hover' } }}>
                      <TableCell>{item.upload_date}</TableCell>
                      <TableCell>{item.file_name}</TableCell>
                      <TableCell>{item.uploaded_by}</TableCell>
                      <TableCell align="center">
                        <Badge badgeContent={item.transactions_uploaded ?? 0} color="primary" showZero />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={item.status}
                          color={/passed/i.test(item.status) ? 'success' : 'warning'}
                          variant="outlined"
                          sx={{ borderRadius: '8px' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            localStorage.setItem(LOCAL_BATCH_KEY, item.batch_id);
                            localStorage.setItem(LOCAL_ACCOUNT_KEY, selectedBankAccount);
                            fetchBatchSummary(item.batch_id);
                          }}
                          sx={{ borderRadius: 2 }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No recent uploads for this account.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Snackbar for Feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BankUploadManagement;