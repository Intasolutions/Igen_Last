import React, { useEffect, useState, useCallback } from 'react';
import API from '../../api/axios';
import Select from 'react-select';
import {
  Typography, Button, Card, CardContent, TextField, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Alert, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton, Tooltip, TablePagination, Chip,
  Slide, Fade, Box, Toolbar
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { debounce } from 'lodash';
import FileUploader from '../../components/FileUploader';

const SlideTransition = React.forwardRef(function SlideTransition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function CashLedgerManagement() {
  // Filters & data
  const [filters, setFilters] = useState({
    cost_centre: '',
    entity: '',
    transaction_type: '',
    spent_by: '',
    chargeable: '',
    search: '',
    ordering: '',
  });

  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [entities, setEntities] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [balance, setBalance] = useState(0);

  // Form/dialog state
  const defaultForm = {
    date: '',
    company: '',
    spent_by: '',
    cost_centre: '',
    entity: '',
    transaction_type: '',
    amount: '',
    chargeable: false,
    margin: '',
    balance_amount: '',
    remarks: '',
    document: []
  };
  const [form, setForm] = useState(defaultForm);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Currency formatter
  const formatCurrency = (value) =>
    `₹ ${parseFloat(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  // ---------- Validation Function ----------
  const validateForm = () => {
    const newErrors = {};
    if (!form.date) newErrors.date = 'Date is required';
    if (!form.company) newErrors.company = 'Company is required';
    if (!form.spent_by) newErrors.spent_by = 'Spent By is required';
    if (!form.cost_centre) newErrors.cost_centre = 'Cost Centre is required';
    if (!form.entity) newErrors.entity = 'Entity is required';
    if (!form.transaction_type) newErrors.transaction_type = 'Transaction Type is required';
    if (!form.amount) newErrors.amount = 'Amount is required';
    if (form.chargeable && !form.margin) newErrors.margin = 'Margin is required when chargeable';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------- API calls ----------
  const fetchMasterData = useCallback(async () => {
    try {
      const [u, cc, e, t, c] = await Promise.all([
        API.get('users/'),
        API.get('cost-centres/'),
        API.get('entities/'),
        API.get('transaction-types/?direction=DEBIT&status=Active'),
        API.get('companies/')
      ]);
      setUsers(u.data);
      setCostCentres(cc.data);
      setEntities(e.data);
      setTransactionTypes(t.data);
      setCompanies(c.data);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to fetch master data', severity: 'error' });
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await API.get('cash-ledger/', { params: filters });
      setEntries(res.data);
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to fetch entries', severity: 'error' });
    }
  }, [filters]);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await API.get('cash-ledger/balance/');
      setBalance(res.data.current_balance);
    } catch (err) {
      console.error(err);
      setBalance(0);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
    fetchBalance();
    fetchEntries();
  }, [fetchMasterData, fetchBalance, fetchEntries]);

  // ---------- Debounced fetching when filters change ----------
  useEffect(() => {
    const handler = debounce(() => {
      setPage(0);
      fetchEntries();
    }, 350);
    handler();
    return () => handler.cancel();
  }, [filters, fetchEntries]);

  // ---------- Actions ----------
  const handleSubmit = async () => {
    if (!validateForm()) {
      setSnackbar({ open: true, message: 'Please fill all required fields', severity: 'warning' });
      return;
    }

    const payload = new FormData();
    payload.append('date', form.date);
    payload.append('company', parseInt(form.company));
    payload.append('spent_by', parseInt(form.spent_by));
    payload.append('cost_centre', parseInt(form.cost_centre));
    payload.append('entity', parseInt(form.entity));
    payload.append('transaction_type', parseInt(form.transaction_type));
    payload.append('amount', form.amount);
    payload.append('chargeable', form.chargeable);
    if (form.chargeable && form.margin) payload.append('margin', form.margin);
    payload.append('balance_amount', form.balance_amount);
    if (form.remarks) payload.append('remarks', form.remarks);
    form.document.forEach((file, index) => {
      payload.append(`document[${index}]`, file);
    });

    try {
      await API.post('cash-ledger/', payload);
      setSnackbar({ open: true, message: 'Entry added successfully', severity: 'success' });
      setForm(defaultForm);
      setErrors({});
      setOpen(false);
      fetchEntries();
      fetchBalance();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to add entry', severity: 'error' });
    }
  };

  const deactivateEntry = async (id) => {
    try {
      await API.post(`cash-ledger/${id}/deactivate/`);
      setSnackbar({ open: true, message: 'Entry deactivated', severity: 'info' });
      fetchEntries();
      fetchBalance();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to deactivate', severity: 'error' });
    }
  };

  // ---------- Filter helpers ----------
  const orderingOptions = [
    { value: '', label: 'Default' },
    { value: 'date', label: 'Date Asc' },
    { value: '-date', label: 'Date Desc' },
    { value: 'amount', label: 'Amount Asc' },
    { value: '-amount', label: 'Amount Desc' },
  ];
  const costCentreOptions = costCentres.map(c => ({ value: c.cost_centre_id, label: c.name }));
  const entityOptions = entities.map(ent => ({ value: ent.id, label: ent.name }));
  const transactionTypeOptions = transactionTypes.map(t => ({ value: t.transaction_type_id, label: t.name }));
  const userOptions = users.map(u => ({ value: u.id, label: u.full_name }));
  const chargeableOptions = [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];

  const selectStyles = {
    control: (base) => ({
      ...base,
      borderRadius: 9999,
      minHeight: 38,
      boxShadow: 'none',
      borderColor: '#e5e7eb',
    }),
    valueContainer: (base) => ({ ...base, padding: '0 8px' }),
    indicatorsContainer: (base) => ({ ...base, paddingRight: 6 }),
    placeholder: (base) => ({ ...base, color: '#9ca3af' }),
  };

  const clearAllFilters = () => {
    setFilters({
      cost_centre: '',
      entity: '',
      transaction_type: '',
      spent_by: '',
      chargeable: '',
      search: '',
      ordering: '',
    });
  };

  const removeFilter = (key) => {
    setFilters(prev => ({ ...prev, [key]: '' }));
  };

  const paginated = rowsPerPage > 0
    ? entries.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : entries;

  return (
    <div className="p-[28px]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <Typography variant="h5" fontWeight="bold">Cash Ledger Register</Typography>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-right">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: 12,
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
              minWidth: 260,
              marginBottom: '8px',
            }}
          >
            <AccountBalanceWalletIcon style={{ fontSize: 40, opacity: 0.85 }} />
            <div>
              <Typography variant="subtitle2" sx={{ opacity: 0.9, fontWeight: 600 }}>
                Current Balance
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 'bold', lineHeight: 1.1 }}>
                {formatCurrency(balance)}
              </Typography>
            </div>
          </div>
          <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
            Add Entry
          </Button>
        </div>
      </div>

      {/* Modern Filter Bar */}
      <Toolbar sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #2196f3 0%, #64b5f6 100%)',
        borderRadius: 2,
        mb: 2,
        p: 2,
        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
        color: 'white',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(33, 150, 243, 0.6)',
          backgroundPosition: 'right center',
          transition: 'all 0.3s ease',
        },
        backgroundSize: '200% 100%',
        backgroundPosition: 'left center',
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flex: 1 }}>
          <Box sx={{ minWidth: 150 }}>
            <Select
              styles={{
                ...selectStyles,
                menuPortal: base => ({ ...base, zIndex: 1500 }),
              }}
              menuPortalTarget={document.body}
              options={orderingOptions}
              value={orderingOptions.find(o => o.value === filters.ordering) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, ordering: opt?.value || '' }))}
              isClearable
              placeholder="Sort By"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select
              styles={{
                ...selectStyles,
                menuPortal: base => ({ ...base, zIndex: 1500 }),
              }}
              menuPortalTarget={document.body}
              options={costCentreOptions}
              value={costCentreOptions.find(o => o.value === filters.cost_centre) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, cost_centre: opt?.value || '' }))}
              isClearable
              placeholder="Cost Centre"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select
              styles={{
                ...selectStyles,
                menuPortal: base => ({ ...base, zIndex: 1500 }),
              }}
              menuPortalTarget={document.body}
              options={entityOptions}
              value={entityOptions.find(o => o.value === filters.entity) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, entity: opt?.value || '' }))}
              isClearable
              placeholder="Entity"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select
              styles={{
                ...selectStyles,
                menuPortal: base => ({ ...base, zIndex: 1500 }),
              }}
              menuPortalTarget={document.body}
              options={transactionTypeOptions}
              value={transactionTypeOptions.find(o => o.value === filters.transaction_type) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, transaction_type: opt?.value || '' }))}
              isClearable
              placeholder="Type"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select
              styles={{
                ...selectStyles,
                menuPortal: base => ({ ...base, zIndex: 1500 }),
              }}
              menuPortalTarget={document.body}
              options={userOptions}
              value={userOptions.find(o => o.value === filters.spent_by) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, spent_by: opt?.value || '' }))}
              isClearable
              placeholder="Spent By"
            />
          </Box>
          <Box sx={{ minWidth: 130 }}>
            <Select
              styles={{
                ...selectStyles,
                menuPortal: base => ({ ...base, zIndex: 1500 }),
              }}
              menuPortalTarget={document.body}
              options={chargeableOptions}
              value={chargeableOptions.find(o => o.value === filters.chargeable) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, chargeable: opt?.value || '' }))}
              isClearable
              placeholder="Chargeable"
            />
          </Box>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          onClick={clearAllFilters}
          sx={{
            borderColor: 'white',
            color: 'white',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            py: 1,
            borderRadius: 2,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'primary.main',
              color: 'background.paper',
              borderColor: 'primary.main',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            },
            '&:active': {
              boxShadow: 'none',
              backgroundColor: 'primary.dark',
              borderColor: 'primary.dark',
            },
          }}
        >
          Clear All
        </Button>
      </Toolbar>

      {/* Active Filter Chips */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {Object.entries(filters)
          .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
          .map(([key, value]) => {
            let label = value;
            if (key === 'cost_centre') label = costCentres.find(c => String(c.cost_centre_id) === String(value))?.name ?? value;
            if (key === 'entity') label = entities.find(en => String(en.id) === String(value))?.name ?? value;
            if (key === 'transaction_type') label = transactionTypes.find(t => String(t.transaction_type_id) === String(value))?.name ?? value;
            if (key === 'spent_by') label = users.find(u => String(u.id) === String(value))?.full_name ?? value;
            if (key === 'chargeable') label = value === 'true' ? 'Yes' : 'No';
            if (key === 'ordering') {
              const ord = orderingOptions.find(o => o.value === value);
              label = ord ? ord.label : value;
            }
            if (key === 'search') label = `Search: "${value}"`;
            return (
              <Chip
                key={key}
                label={`${key.replace('_', ' ')}: ${label}`}
                onDelete={() => removeFilter(key)}
                deleteIcon={<CloseIcon />}
                variant="outlined"
              />
            );
          })}
      </Box>

      {/* Table */}
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small" stickyHeader>
              <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Spent By</TableCell>
                  <TableCell>Cost Centre</TableCell>
                  <TableCell>Entity</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Chargeable</TableCell>
                  <TableCell align="right">Margin</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="center">Document</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((e, index) => (
                  <TableRow key={e.id}>
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{e.spent_by_name}</TableCell>
                    <TableCell>{e.cost_centre_name}</TableCell>
                    <TableCell>{e.entity_name}</TableCell>
                    <TableCell>{e.transaction_type_name}</TableCell>
                    <TableCell align="right">{formatCurrency(e.amount)}</TableCell>
                    <TableCell>
                      <Chip label={e.chargeable ? 'Yes' : 'No'} color={e.chargeable ? 'success' : 'default'} size="small" />
                    </TableCell>
                    <TableCell align="right">{e.margin ?? '-'}</TableCell>
                    <TableCell align="right">{formatCurrency(e.balance_amount)}</TableCell>
                    <TableCell align="center">
                      {e.document_url ? (
                        <Tooltip title="View Document">
                          <Chip
                            component="a"
                            href={e.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            label="Doc 1"
                            icon={
                              <img
                                src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"
                                alt="PDF"
                                style={{ width: 16, height: 16 }}
                              />
                            }
                            clickable
                            size="small"
                            sx={{ backgroundColor: '#e0f2f1' }}
                          />
                        </Tooltip>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Deactivate Entry">
                        <IconButton color="error" onClick={() => deactivateEntry(e.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={entries.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      {/* Add Entry Dialog */}
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setErrors({});
          setForm(defaultForm);
        }}
        fullWidth
        maxWidth="sm"
        TransitionComponent={SlideTransition}
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
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', color: '#1e293b' }}>
          Add Cash Ledger Entry
        </DialogTitle>
             <DialogContent sx={{ 
          p: 3,
          overflowY: 'auto',
          maxHeight: '60vh', // Set a max height to enable scrolling
          '&::-webkit-scrollbar': {
            display: 'none', // Hide scrollbar for WebKit browsers
          },
          scrollbarWidth: 'none', // Hide scrollbar for Firefox
          '-ms-overflow-style': 'none', // Hide scrollbar for IE/Edge
        }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField
              type="date"
              label="Date"
              InputLabelProps={{ shrink: true }}
              fullWidth
              margin="dense"
              value={form.date}
              onChange={(e) => {
                setForm({ ...form, date: e.target.value });
                setErrors(prev => ({ ...prev, date: e.target.value ? '' : 'Date is required' }));
              }}
              error={!!errors.date}
              helperText={errors.date}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            />
            <TextField
              select
              label="Company"
              value={form.company ?? ''}
              onChange={(e) => {
                setForm({ ...form, company: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, company: e.target.value ? '' : 'Company is required' }));
              }}
              fullWidth
              margin="dense"
              error={!!errors.company}
              helperText={errors.company}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            >
              {companies.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Spent By"
              value={form.spent_by ?? ''}
              onChange={(e) => {
                setForm({ ...form, spent_by: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, spent_by: e.target.value ? '' : 'Spent By is required' }));
              }}
              fullWidth
              margin="dense"
              error={!!errors.spent_by}
              helperText={errors.spent_by}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            >
              {users.map(u => <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>)}
            </TextField>
            <TextField
              select
              label="Cost Centre"
              value={form.cost_centre ?? ''}
              onChange={(e) => {
                setForm({ ...form, cost_centre: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, cost_centre: e.target.value ? '' : 'Cost Centre is required' }));
              }}
              fullWidth
              margin="dense"
              error={!!errors.cost_centre}
              helperText={errors.cost_centre}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            >
              {costCentres.map(cc => (
                <MenuItem key={cc.cost_centre_id} value={cc.cost_centre_id}>{cc.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Entity"
              value={form.entity ?? ''}
              onChange={(e) => {
                setForm({ ...form, entity: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, entity: e.target.value ? '' : 'Entity is required' }));
              }}
              fullWidth
              margin="dense"
              error={!!errors.entity}
              helperText={errors.entity}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            >
              {entities.map(en => <MenuItem key={en.id} value={en.id}>{en.name}</MenuItem>)}
            </TextField>
            <TextField
              select
              label="Transaction Type"
              value={form.transaction_type ?? ''}
              onChange={(e) => {
                setForm({ ...form, transaction_type: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, transaction_type: e.target.value ? '' : 'Transaction Type is required' }));
              }}
              fullWidth
              margin="dense"
              error={!!errors.transaction_type}
              helperText={errors.transaction_type}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            >
              {transactionTypes.map(t => (
                <MenuItem key={t.transaction_type_id} value={t.transaction_type_id}>
                  {t.name} ({t.direction}) - {t.company_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label="Amount"
              value={form.amount}
              onChange={(e) => {
                setForm({ ...form, amount: e.target.value });
                setErrors(prev => ({ ...prev, amount: e.target.value ? '' : 'Amount is required' }));
              }}
              fullWidth
              margin="dense"
              error={!!errors.amount}
              helperText={errors.amount}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#475569' }}>
                Chargeable
              </Typography>
              <Switch
                checked={form.chargeable}
                onChange={(e) => {
                  setForm({ ...form, chargeable: e.target.checked });
                  if (!e.target.checked) setErrors(prev => ({ ...prev, margin: '' }));
                }}
                sx={{
                  '& .MuiSwitch-switchBase': {
                    transition: 'all 0.3s ease',
                    '&.Mui-checked': {
                      transform: 'translateX(16px)',
                      color: '#ffffff',
                      '& + .MuiSwitch-track': {
                        backgroundColor: '#2196f3',
                        opacity: 1,
                      },
                    },
                  },
                  '& .MuiSwitch-thumb': {
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                    width: 20,
                    height: 20,
                  },
                  '& .MuiSwitch-track': {
                    borderRadius: 20 / 2,
                    backgroundColor: '#e2e8f0',
                    opacity: 1,
                    transition: 'background-color 0.3s ease',
                  },
                  '&:hover': {
                    '& .MuiSwitch-thumb': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    },
                  },
                }}
              />
            </Box>
          </Box>
          <Fade in={form.chargeable}>
            <Box sx={{ mt: 2 }}>
              <TextField
                type="number"
                label="Margin"
                value={form.margin}
                onChange={(e) => {
                  setForm({ ...form, margin: e.target.value });
                  setErrors(prev => ({ ...prev, margin: e.target.value ? '' : 'Margin is required when chargeable' }));
                }}
                fullWidth
                margin="dense"
                error={!!errors.margin}
                helperText={errors.margin}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                    '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                  },
                  '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
                }}
              />
            </Box>
          </Fade>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <TextField
              type="number"
              label="Balance Amount"
              value={form.balance_amount}
              onChange={(e) => setForm({ ...form, balance_amount: e.target.value })}
              fullWidth
              margin="dense"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            />
            <TextField
              label="Remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              fullWidth
              margin="dense"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&:hover': { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' },
                },
                '& .MuiInputLabel-root': { color: '#475569', fontWeight: 500 },
              }}
            />
          </Box>
          <FileUploader
            mode="add"
            selectedFiles={form.document}
            setSelectedFiles={(files) => setForm({ ...form, document: files })}
            onFilesChange={(files) => setForm({ ...form, document: files })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => {
              setOpen(false);
              setErrors({});
              setForm(defaultForm);
            }}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': {
                backgroundColor: '#f1f5f9',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
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
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </div>
  );
}