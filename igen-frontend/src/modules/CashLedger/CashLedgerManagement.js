import React, { useEffect, useState, useCallback } from 'react';
import API from '../../api/axios';
import Select from 'react-select';
import {
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  TablePagination,
  Chip,
  Slide,
  Fade,
  Box,
  Toolbar,
  Stack,
  RadioGroup,
  Radio,
  FormControlLabel,
  Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { debounce } from 'lodash';
import FileUploader from '../../components/FileUploader';

const SlideTransition = React.forwardRef(function SlideTransition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/* ------------ role/permission helpers ------------ */
const isCenterHeadRole = (role) => {
  if (!role) return false;
  const r = String(role).toLowerCase().trim();
  return ['center head', 'center_head', 'centerhead', 'centre head', 'centre_head'].includes(r);
};

const userCanAddCashEntry = () => {
  try {
    const raw =
      localStorage.getItem('user') ||
      localStorage.getItem('auth_user') ||
      localStorage.getItem('profile') ||
      localStorage.getItem('auth');
    if (!raw) return true;
    const u = JSON.parse(raw);

    const role =
      u?.role ??
      u?.user_role ??
      u?.user?.role ??
      u?.profile?.role ??
      u?.data?.role;

    const disallow = isCenterHeadRole(role);

    const perms =
      (Array.isArray(u?.permissions) && u.permissions) ||
      (Array.isArray(u?.perms) && u.perms) ||
      (Array.isArray(u?.scopes) && u.scopes) ||
      [];
    const hasExplicitCreate =
      perms.some(p =>
        ['cash_ledger.create', 'cash-ledger:create', 'cashledger.create', 'cash_ledger:add']
          .includes(String(p).toLowerCase())
      );

    if (disallow && !hasExplicitCreate) return false;
    return true;
  } catch {
    return true;
  }
};

/* ------------ link/status helpers ------------ */
const toAbsoluteUrl = (u) => {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('//')) return window.location.protocol + u;
  const base = API?.defaults?.baseURL
    ? new URL(API.defaults.baseURL, window.location.origin).origin
    : window.location.origin;
  return u.startsWith('/') ? base + u : base + '/' + u;
};

const getDocLinks = (row) => {
  if (row?.document_url) return [{ url: row.document_url, name: 'Document' }];
  if (row?.document) return [{ url: toAbsoluteUrl(row.document), name: 'Document' }];

  const raw =
    row?.document_urls ??
    row?.documents ??
    row?.attachments ??
    row?.files ??
    [];

  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr
    .map((d, i) => {
      if (typeof d === 'string') return { url: toAbsoluteUrl(d), name: `Doc ${i + 1}` };
      const url = d?.url || d?.file || d?.path || d?.location || '';
      const name = d?.name || d?.filename || d?.original_name || `Doc ${i + 1}`;
      return url ? { url: toAbsoluteUrl(url), name } : null;
    })
    .filter(Boolean);
};

const deriveIsActive = (row) => {
  if (typeof row?.is_active === 'boolean') return row.is_active;
  if (row?.status) return String(row.status).toLowerCase() === 'active';
  if (typeof row?.deleted === 'boolean') return !row.deleted;
  if (typeof row?.is_deactivated === 'boolean') return !row.is_deactivated;
  return true;
};

/* ------------ component ------------ */
export default function CashLedgerManagement() {
  const [canAdd, setCanAdd] = useState(true);
  useEffect(() => {
    setCanAdd(userCanAddCashEntry());
  }, []);

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

  /* add form */
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

  /* edit dialog */
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editStatus, setEditStatus] = useState('active');
  const [editForm, setEditForm] = useState({
    date: '',
    company: '',
    spent_by: '',
    cost_centre: '',
    entity: '',
    transaction_type: '',
    amount: '',
    chargeable: false,
    margin: '',
    remarks: '',
  });
  const [editDoc, setEditDoc] = useState([]);

  /* ui */
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const formatCurrency = (v) => `₹ ${parseFloat(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const companyName = (id) => companies.find((c) => String(c.id) === String(id))?.name || '-';

  /* validation */
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

  /* api */
  const fetchMasterData = useCallback(async () => {
    try {
      const [pmLite, cc, e, t, c] = await Promise.all([
        API.get('users/?role=PROPERTY_MANAGER&is_active=true&fields=id,name'),
        API.get('cost-centres/'),
        API.get('entities/'),
        API.get('transaction-types/?direction=Debit&status=Active'),
        API.get('companies/')
      ]);

      const normalizedUsers = (pmLite.data || []).map(u => ({
        id: u.id,
        full_name: u.name || u.full_name || u.user_id || 'User'
      }));

      setUsers(normalizedUsers);
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

  useEffect(() => {
    const handler = debounce(() => {
      setPage(0);
      fetchEntries();
    }, 350);
    handler();
    return () => handler.cancel();
  }, [filters, fetchEntries]);

  /* add actions */
  const handleSubmit = async () => {
    if (!canAdd) {
      setSnackbar({ open: true, message: "You don't have permission to add entries.", severity: 'error' });
      return;
    }
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
    if (form.balance_amount !== '') payload.append('balance_amount', form.balance_amount);
    if (form.remarks) payload.append('remarks', form.remarks);
    if (form.document && form.document.length > 0) {
      payload.append('document', form.document[0]);
    }

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

  /* edit actions */
  const openEdit = (row) => {
    setEditRow(row);
    setEditStatus(deriveIsActive(row) ? 'active' : 'inactive');
    setEditForm({
      date: row.date || '',
      company: row.company || '',
      spent_by: row.spent_by || '',
      cost_centre: row.cost_centre || '',
      entity: row.entity || '',
      transaction_type: row.transaction_type || '',
      amount: row.amount ?? '',
      chargeable: !!row.chargeable,
      margin: row.margin ?? '',
      remarks: row.remarks || '',
    });
    setEditDoc([]);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const payload = new FormData();
    payload.append('is_active', editStatus === 'active');
    if (editForm.date) payload.append('date', editForm.date);
    if (editForm.company) payload.append('company', parseInt(editForm.company));
    if (editForm.spent_by) payload.append('spent_by', parseInt(editForm.spent_by));
    if (editForm.cost_centre) payload.append('cost_centre', parseInt(editForm.cost_centre));
    if (editForm.entity) payload.append('entity', parseInt(editForm.entity));
    if (editForm.transaction_type) payload.append('transaction_type', parseInt(editForm.transaction_type));
    if (editForm.amount !== '') payload.append('amount', editForm.amount);
    payload.append('chargeable', !!editForm.chargeable);
    if (editForm.chargeable) {
      if (editForm.margin !== '') payload.append('margin', editForm.margin);
    } else {
      payload.append('margin', '');
    }
    payload.append('remarks', editForm.remarks || '');
    if (editDoc && editDoc.length > 0) {
      payload.append('document', editDoc[0]);
    }

    try {
      await API.patch(`cash-ledger/${editRow.id}/`, payload);
      setSnackbar({ open: true, message: 'Entry updated', severity: 'success' });
      setEditOpen(false);
      setEditRow(null);
      fetchEntries();
      fetchBalance();
    } catch (err) {
      console.error(err);
      setSnackbar({ open: true, message: 'Failed to update entry', severity: 'error' });
    }
  };

  /* select helpers */
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

  const removeFilter = (key) => setFilters(prev => ({ ...prev, [key]: '' }));

  const paginated = rowsPerPage > 0
    ? entries.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : entries;

  const DetailRow = ({ label, children }) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr', columnGap: 2, rowGap: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: '#0f172a' }}>{children ?? '—'}</Typography>
    </Box>
  );

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
          {canAdd && (
            <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
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
        backgroundSize: '200% 100%',
        backgroundPosition: 'left center',
      }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', flex: 1 }}>
          <Box sx={{ minWidth: 150 }}>
            <Select styles={{ ...selectStyles, menuPortal: b => ({ ...b, zIndex: 1500 }) }}
              menuPortalTarget={document.body}
              options={orderingOptions}
              value={orderingOptions.find(o => o.value === filters.ordering) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, ordering: opt?.value || '' }))}
              isClearable placeholder="Sort By"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select styles={{ ...selectStyles, menuPortal: b => ({ ...b, zIndex: 1500 }) }}
              menuPortalTarget={document.body}
              options={costCentreOptions}
              value={costCentreOptions.find(o => o.value === filters.cost_centre) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, cost_centre: opt?.value || '' }))}
              isClearable placeholder="Cost Centre"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select styles={{ ...selectStyles, menuPortal: b => ({ ...b, zIndex: 1500 }) }}
              menuPortalTarget={document.body}
              options={entityOptions}
              value={entityOptions.find(o => o.value === filters.entity) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, entity: opt?.value || '' }))}
              isClearable placeholder="Entity"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select styles={{ ...selectStyles, menuPortal: b => ({ ...b, zIndex: 1500 }) }}
              menuPortalTarget={document.body}
              options={transactionTypeOptions}
              value={transactionTypeOptions.find(o => o.value === filters.transaction_type) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, transaction_type: opt?.value || '' }))}
              isClearable placeholder="Type"
            />
          </Box>
          <Box sx={{ minWidth: 150 }}>
            <Select styles={{ ...selectStyles, menuPortal: b => ({ ...b, zIndex: 1500 }) }}
              menuPortalTarget={document.body}
              options={userOptions}
              value={userOptions.find(o => o.value === filters.spent_by) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, spent_by: opt?.value || '' }))}
              isClearable placeholder="Spent By"
            />
          </Box>
          <Box sx={{ minWidth: 130 }}>
            <Select styles={{ ...selectStyles, menuPortal: b => ({ ...b, zIndex: 1500 }) }}
              menuPortalTarget={document.body}
              options={chargeableOptions}
              value={chargeableOptions.find(o => o.value === filters.chargeable) || null}
              onChange={(opt) => setFilters(prev => ({ ...prev, chargeable: opt?.value || '' }))}
              isClearable placeholder="Chargeable"
            />
          </Box>
        </Box>
        <Button variant="outlined" color="primary" onClick={clearAllFilters}
          sx={{ borderColor: 'white', color: 'white', textTransform: 'none', fontWeight: 600 }}>
          Clear All
        </Button>
      </Toolbar>

      {/* Active Filter Chips */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {Object.entries(filters)
          .filter(([_, value]) => value !== '' && value !== null && value !== undefined)
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
              <Chip key={key} label={`${key.replace('_', ' ')}: ${label}`}
                onDelete={() => removeFilter(key)} deleteIcon={<CloseIcon />} variant="outlined" />
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
                  <TableCell>Status</TableCell>
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
                    <TableCell>
                      <Chip size="small" label={deriveIsActive(e) ? 'Active' : 'Inactive'}
                        color={deriveIsActive(e) ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell align="center">
                      {(() => {
                        const docs = getDocLinks(e);
                        if (!docs.length) return '—';
                        const visible = docs.slice(0, 3);
                        const extra = docs.length - visible.length;
                        return (
                          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center">
                            {visible.map((d, i) => (
                              <Tooltip title="View Document" key={`${e.id}-doc-${i}`}>
                                <Chip component="a" href={d.url} target="_blank" rel="noopener noreferrer"
                                  label={d.name} clickable size="small" sx={{ backgroundColor: '#e0f2f1' }} />
                              </Tooltip>
                            ))}
                            {extra > 0 && <Chip size="small" label={`+${extra}`} sx={{ backgroundColor: '#e0f2f1' }} />}
                          </Stack>
                        );
                      })()}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Entry">
                        <IconButton color="primary" onClick={() => openEdit(e)}>
                          <EditIcon />
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
        onClose={() => { setOpen(false); setErrors({}); setForm(defaultForm); }}
        fullWidth maxWidth="sm" TransitionComponent={SlideTransition}
        PaperProps={{ sx: { borderRadius: 4, p: 3, backgroundColor: '#fafafa', boxShadow: 10, overflowY: 'hidden' } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', color: '#1e293b' }}>
          Add Cash Ledger Entry
        </DialogTitle>
        <DialogContent sx={{
          p: 3, overflowY: 'auto', maxHeight: '60vh',
          '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', msOverflowStyle: 'none'
        }}>
          {/* wrap siblings in a fragment to avoid “adjacent JSX” errors */}
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <TextField
                type="date" label="Date" InputLabelProps={{ shrink: true }} fullWidth margin="dense"
                value={form.date}
                onChange={(e) => { setForm({ ...form, date: e.target.value }); setErrors(p => ({ ...p, date: e.target.value ? '' : 'Date is required' })); }}
                error={!!errors.date} helperText={errors.date}
              />
              <TextField
                select label="Company" value={form.company ?? ''} onChange={(e) => { setForm({ ...form, company: parseInt(e.target.value) }); setErrors(p => ({ ...p, company: e.target.value ? '' : 'Company is required' })); }}
                fullWidth margin="dense" error={!!errors.company} helperText={errors.company}
              >
                {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
              <TextField
                select label="Spent By" value={form.spent_by ?? ''} onChange={(e) => { setForm({ ...form, spent_by: parseInt(e.target.value) }); setErrors(p => ({ ...p, spent_by: e.target.value ? '' : 'Spent By is required' })); }}
                fullWidth margin="dense" error={!!errors.spent_by} helperText={errors.spent_by}
              >
                {users.map(u => <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>)}
              </TextField>
              <TextField
                select label="Cost Centre" value={form.cost_centre ?? ''} onChange={(e) => { setForm({ ...form, cost_centre: parseInt(e.target.value) }); setErrors(p => ({ ...p, cost_centre: e.target.value ? '' : 'Cost Centre is required' })); }}
                fullWidth margin="dense" error={!!errors.cost_centre} helperText={errors.cost_centre}
              >
                {costCentres.map(cc => <MenuItem key={cc.cost_centre_id} value={cc.cost_centre_id}>{cc.name}</MenuItem>)}
              </TextField>
              <TextField
                select label="Entity" value={form.entity ?? ''} onChange={(e) => { setForm({ ...form, entity: parseInt(e.target.value) }); setErrors(p => ({ ...p, entity: e.target.value ? '' : 'Entity is required' })); }}
                fullWidth margin="dense" error={!!errors.entity} helperText={errors.entity}
              >
                {entities.map(en => <MenuItem key={en.id} value={en.id}>{en.name}</MenuItem>)}
              </TextField>
              <TextField
                select label="Transaction Type" value={form.transaction_type ?? ''} onChange={(e) => { setForm({ ...form, transaction_type: parseInt(e.target.value) }); setErrors(p => ({ ...p, transaction_type: e.target.value ? '' : 'Transaction Type is required' })); }}
                fullWidth margin="dense" error={!!errors.transaction_type} helperText={errors.transaction_type}
              >
                {transactionTypes.map(t => <MenuItem key={t.transaction_type_id} value={t.transaction_type_id}>{t.name} ({t.direction}) - {t.company_name}</MenuItem>)}
              </TextField>
              <TextField
                type="number" label="Amount" value={form.amount}
                onChange={(e) => { setForm({ ...form, amount: e.target.value }); setErrors(p => ({ ...p, amount: e.target.value ? '' : 'Amount is required' })); }}
                fullWidth margin="dense" error={!!errors.amount} helperText={errors.amount}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, color: '#475569' }}>Chargeable</Typography>
                <Switch
                  checked={form.chargeable}
                  onChange={(e) => { setForm({ ...form, chargeable: e.target.checked }); if (!e.target.checked) setErrors(p => ({ ...p, margin: '' })); }}
                />
              </Box>
            </Box>

            <Fade in={form.chargeable}>
              <Box sx={{ mt: 2 }}>
                <TextField
                  type="number" label="Margin" value={form.margin}
                  onChange={(e) => { setForm({ ...form, margin: e.target.value }); setErrors(p => ({ ...p, margin: e.target.value ? '' : 'Margin is required when chargeable' })); }}
                  fullWidth margin="dense" error={!!errors.margin} helperText={errors.margin}
                />
              </Box>
            </Fade>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
              <TextField
                type="number" label="Balance Amount" value={form.balance_amount}
                onChange={(e) => setForm({ ...form, balance_amount: e.target.value })}
                fullWidth margin="dense"
              />
              <TextField
                label="Remarks" value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                fullWidth margin="dense"
              />
            </Box>

            <FileUploader
              mode="add"
              selectedFiles={form.document}
              setSelectedFiles={(files) => setForm({ ...form, document: files })}
              onFilesChange={(files) => setForm({ ...form, document: files })}
            />
          </>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => { setOpen(false); setErrors({}); setForm(defaultForm); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!canAdd}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditRow(null); }}
        fullWidth maxWidth="sm" TransitionComponent={SlideTransition}
        PaperProps={{ sx: { borderRadius: 4, p: 3, backgroundColor: '#fafafa', boxShadow: 10, overflowY: 'hidden' } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', color: '#1e293b' }}>
          Edit Cash Ledger Entry
        </DialogTitle>
        <DialogContent sx={{
          p: 3, overflowY: 'auto', maxHeight: '70vh',
          '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', msOverflowStyle: 'none'
        }}>
          <Typography variant="subtitle2" sx={{ color: '#475569' }}>Status</Typography>
          <RadioGroup row value={editStatus} onChange={(e) => setEditStatus(e.target.value)} sx={{ mb: 1 }}>
            <FormControlLabel value="active" control={<Radio />} label="Active" />
            <FormControlLabel value="inactive" control={<Radio />} label="Inactive" />
          </RadioGroup>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" sx={{ color: '#475569', mb: 1 }}>Edit Fields</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} fullWidth margin="dense"
              value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
            <TextField select label="Company" value={editForm.company ?? ''} onChange={(e) => setEditForm({ ...editForm, company: parseInt(e.target.value) })}
              fullWidth margin="dense">
              {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField select label="Spent By" value={editForm.spent_by ?? ''} onChange={(e) => setEditForm({ ...editForm, spent_by: parseInt(e.target.value) })}
        Width margin="dense">
              {users.map(u => <MenuItem key={u.id} value={u.id}>{u.full_name}</MenuItem>)}
            </TextField>
            <TextField select label="Cost Centre" value={editForm.cost_centre ?? ''} onChange={(e) => setEditForm({ ...editForm, cost_centre: parseInt(e.target.value) })}
              fullWidth margin="dense">
              {costCentres.map(cc => <MenuItem key={cc.cost_centre_id} value={cc.cost_centre_id}>{cc.name}</MenuItem>)}
            </TextField>
            <TextField select label="Entity" value={editForm.entity ?? ''} onChange={(e) => setEditForm({ ...editForm, entity: parseInt(e.target.value) })}
              fullWidth margin="dense">
              {entities.map(en => <MenuItem key={en.id} value={en.id}>{en.name}</MenuItem>)}
            </TextField>
            <TextField select label="Transaction Type" value={editForm.transaction_type ?? ''} onChange={(e) => setEditForm({ ...editForm, transaction_type: parseInt(e.target.value) })}
              fullWidth margin="dense">
              {transactionTypes.map(t => <MenuItem key={t.transaction_type_id} value={t.transaction_type_id}>{t.name} ({t.direction}) - {t.company_name}</MenuItem>)}
            </TextField>
            <TextField type="number" label="Amount" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              fullWidth margin="dense" />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#475569' }}>Chargeable</Typography>
              <Switch checked={!!editForm.chargeable} onChange={(e) => setEditForm({ ...editForm, chargeable: e.target.checked })} />
            </Box>
          </Box>

          <Fade in={!!editForm.chargeable}>
            <Box sx={{ mt: 2 }}>
              <TextField type="number" label="Margin" value={editForm.margin}
                onChange={(e) => setEditForm({ ...editForm, margin: e.target.value })}
                fullWidth margin="dense" />
            </Box>
          </Fade>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <TextField label="Remarks" value={editForm.remarks}
              onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} fullWidth margin="dense" />
            <DetailRow label="Current Balance">
              {editRow ? formatCurrency(editRow.balance_amount) : '—'}
            </DetailRow>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Typography variant="subtitle2" sx={{ color: '#475569', mb: 1 }}>Document</Typography>
          <Box sx={{ mb: 1 }}>
            {editRow && (() => {
              const docs = getDocLinks(editRow);
              if (!docs.length) return <Typography variant="body2">—</Typography>;
              return (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {docs.map((d, i) => (
                    <Chip key={`edit-doc-${i}`} component="a" href={d.url} target="_blank"
                      rel="noopener noreferrer" label={d.name} clickable size="small"
                      sx={{ backgroundColor: '#e0f2f1' }} />
                  ))}
                </Stack>
              );
            })()}
          </Box>

          <FileUploader
            mode="add"
            selectedFiles={editDoc}
            setSelectedFiles={setEditDoc}
            onFilesChange={setEditDoc}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => { setEditOpen(false); setEditRow(null); }}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </div>
  );
}
