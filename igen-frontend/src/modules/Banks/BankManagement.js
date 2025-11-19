// src/modules/Banks/BankManagement.js
import React, { useState, useEffect, forwardRef, useMemo } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControl, InputLabel, Select,
  Card, CardContent, Typography, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Snackbar, Alert as MuiAlert,
  Tooltip, Slide, FormLabel, RadioGroup, FormControlLabel, Radio, Box, Chip,
  TablePagination
} from '@mui/material';
import { Edit, ToggleOff, ToggleOn } from '@mui/icons-material';
import SearchBar from '../../components/SearchBar';
import ConfirmDialog from '../../components/ConfirmDialog';
import StatusFilter, { statusToIsActive } from '../../components/StatusFilter';

// 🔒 permission helpers
import { canCreate, canUpdate, canDelete } from '../../utils/perm';

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function BankManagement() {
  // Only SUPER_USER has create/update/delete for banks in the matrix
  const canEditBanks = canCreate('banks') || canUpdate('banks') || canDelete('banks');

  const [banks, setBanks] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(''); // '', 'active', 'inactive'

  const [form, setForm] = useState({
    company_id: '',
    account_name: '',
    account_number: '',
    bank_name: '',
    ifsc: '',
    is_active: true
  });

  const [editForm, setEditForm] = useState({
    id: '',
    company_id: '',
    account_name: '',
    account_number: '',
    bank_name: '',
    ifsc: '',
    is_active: true
  });

  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  // -------- Fetchers --------
  const fetchBanks = async () => {
    try {
      const params = { include_inactive: true };
      const isActive = statusToIsActive(selectedStatus);
      if (typeof isActive === 'boolean') params.is_active = isActive;

      const res = await API.get('banks/', { params });
      const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setBanks(items || []);
    } catch {
      setSnackbar({ open: true, message: 'Error fetching banks', severity: 'error' });
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setCompanies(items || []);
    } catch {
      setSnackbar({ open: true, message: 'Error fetching companies', severity: 'error' });
    }
  };

  useEffect(() => {
    fetchBanks();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refetch when status filter changes so server filters apply
  useEffect(() => {
    fetchBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  // -------- Validation --------
  const validateForm = (data) => {
    const errors = {};

    if (!data.company_id) errors.company_id = 'Company is required';
    if (!data.account_name) errors.account_name = 'Account name is required';

    if (!data.account_number) {
      errors.account_number = 'Account number is required';
    } else if (!/^\d{9,18}$/.test(data.account_number)) {
      errors.account_number = 'Account number must be 9 to 18 digits';
    }

    if (!data.bank_name) errors.bank_name = 'Bank name is required';

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!data.ifsc) {
      errors.ifsc = 'IFSC is required';
    } else if (!ifscRegex.test(String(data.ifsc).toUpperCase())) {
      errors.ifsc = 'Invalid IFSC code format';
    }

    return errors;
  };

  // -------- Add --------
  const handleAddBank = async () => {
    if (!canEditBanks) return; // guard
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    try {
      await API.post('banks/', { ...form, ifsc: String(form.ifsc).toUpperCase() });
      setSnackbar({ open: true, message: 'Bank added successfully!', severity: 'success' });
      fetchBanks();
      setOpen(false);
      setForm({ company_id: '', account_name: '', account_number: '', bank_name: '', ifsc: '', is_active: true });
      setFormErrors({});
    } catch {
      setSnackbar({ open: true, message: 'Failed to add bank', severity: 'error' });
    }
  };

  // -------- Edit --------
  const openEditModal = (bank) => {
    if (!canEditBanks) return; // guard
    setEditForm({
      id: bank.id,
      company_id: bank.company?.id || '',
      account_name: bank.account_name || '',
      account_number: bank.account_number || '',
      bank_name: bank.bank_name || '',
      ifsc: bank.ifsc || '',
      is_active: !!bank.is_active
    });
    setEditFormErrors({});
    setEditOpen(true);
  };

  const handleAddDialogOpen = () => {
    if (!canEditBanks) return;
    setFormErrors({});
    setForm({ company_id: '', account_name: '', account_number: '', bank_name: '', ifsc: '', is_active: true });
    setOpen(true);
  };

  const handleEditBank = async () => {
    if (!canEditBanks) return; // guard
    const errors = validateForm(editForm);
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }
    try {
      await API.put(`banks/${editForm.id}/`, { ...editForm, ifsc: String(editForm.ifsc).toUpperCase() });
      setSnackbar({ open: true, message: 'Bank updated successfully!', severity: 'success' });
      fetchBanks();
      setEditOpen(false);
    } catch {
      setSnackbar({ open: true, message: 'Failed to update bank', severity: 'error' });
    }
  };

  // -------- Toggle Active/Inactive --------
  const handleConfirmToggle = (bank) => {
    if (!canEditBanks) return; // guard
    setSelectedBank(bank);
    setConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!canEditBanks || !selectedBank) return;
    const updatedStatus = !selectedBank.is_active;

    try {
      await API.patch(`banks/${selectedBank.id}/`, { is_active: updatedStatus });
      setSnackbar({
        open: true,
        message: updatedStatus ? 'Bank reactivated successfully!' : 'Bank deactivated successfully!',
        severity: 'success',
      });
      fetchBanks();
    } catch {
      setSnackbar({
        open: true,
        message: updatedStatus ? 'Failed to reactivate bank' : 'Failed to deactivate bank',
        severity: 'error',
      });
    } finally {
      setConfirmOpen(false);
      setSelectedBank(null);
    }
  };

  // -------- Filtering + Pagination --------
  const filteredBanks = useMemo(() => {
    const q = (searchQuery || '').toLowerCase();
    return (banks || []).filter((b) => {
      const matchesSearch =
        (b.account_name || '').toLowerCase().includes(q) ||
        (b.bank_name || '').toLowerCase().includes(q) ||
        (b.account_number || '').toLowerCase().includes(q) ||
        (b.ifsc || '').toLowerCase().includes(q) ||
        (b.company?.name || '').toLowerCase().includes(q);

      const matchesStatus = selectedStatus
        ? selectedStatus === 'active'
          ? !!b.is_active
          : !b.is_active
        : true;

      return matchesSearch && matchesStatus;
    });
  }, [banks, searchQuery, selectedStatus]);

  const visibleRows =
    rowsPerPage === -1
      ? filteredBanks
      : filteredBanks.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight="bold">Bank Management</Typography>

      {/* Header controls: Search on left; StatusFilter + Add button on right */}
      <div className="flex justify-between items-center mb-6 mt-6 gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px] max-w-sm">
          <SearchBar
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            label="Search bank..."
            placeholder="Search by company, account name/number, bank or IFSC"
          />
        </div>

        <div className="flex items-center gap-3">
          <StatusFilter
            value={selectedStatus}
            onChange={(v) => { setSelectedStatus(v); setPage(0); }}
          />

          {/* 🔒 Add bank only for users with edit rights */}
          {canEditBanks && (
            <Button variant="contained" color="primary" onClick={handleAddDialogOpen}>
              Add Bank
            </Button>
          )}
        </div>
      </div>

      <Card sx={{ boxShadow: 4, borderRadius: 3 }}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Account Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Account Number</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Bank Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>IFSC</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  {canEditBanks && <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>

              <TableBody>
                {visibleRows.map((b, index) => (
                  <TableRow
                    key={b.id}
                    hover
                    sx={{
                      backgroundColor: b.is_active ? '#e8f5e9' : '#fffde7',
                      transition: 'background-color 0.3s ease',
                    }}
                  >
                    <TableCell>{(rowsPerPage === -1 ? 0 : page * rowsPerPage) + index + 1}</TableCell>
                    <TableCell>{b.company?.name}</TableCell>
                    <TableCell>{b.account_name}</TableCell>
                    <TableCell>{b.account_number}</TableCell>
                    <TableCell>{b.bank_name}</TableCell>
                    <TableCell>{b.ifsc}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={b.is_active ? 'Active' : 'Inactive'}
                        color={b.is_active ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>

                    {canEditBanks && (
                      <TableCell align="center">
                        <Tooltip title="Edit Bank" arrow>
                          <IconButton color="primary" onClick={() => openEditModal(b)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={b.is_active ? 'Deactivate' : 'Reactivate'} arrow>
                          <IconButton
                            color={b.is_active ? 'warning' : 'success'}
                            onClick={() => handleConfirmToggle(b)}
                          >
                            {b.is_active ? <ToggleOff /> : <ToggleOn />}
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={filteredBanks.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
            />
          </TableContainer>
        </CardContent>
      </Card>

      {/* 🔒 Add Bank Dialog (render only if allowed) */}
      {canEditBanks && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          fullWidth
          maxWidth="sm"
          TransitionComponent={Transition}
          keepMounted
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
          <DialogTitle>Add New Bank</DialogTitle>
          <DialogContent
            dividers
            sx={{
              p: 3,
              overflowY: 'auto',
              maxHeight: '60vh',
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              '-ms-overflow-style': 'none',
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
              Bank Details
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <FormControl fullWidth margin="normal" error={!!formErrors.company_id}>
                <InputLabel id="add-company-label">Company</InputLabel>
                <Select
                  labelId="add-company-label"
                  value={form.company_id}
                  label="Company"
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                  onBlur={() => {
                    setFormErrors((prev) => ({
                      ...prev,
                      company_id: form.company_id ? undefined : 'Company is required'
                    }));
                  }}
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.company_id && (
                  <Typography color="error" variant="caption">{formErrors.company_id}</Typography>
                )}
              </FormControl>

              <TextField
                margin="normal"
                label="Account Name"
                fullWidth
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                onBlur={() =>
                  setFormErrors((prev) => ({
                    ...prev,
                    account_name: form.account_name ? undefined : 'Account name is required'
                  }))
                }
                error={!!formErrors.account_name}
                helperText={formErrors.account_name}
              />

              <TextField
                margin="normal"
                label="Account Number"
                fullWidth
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                onBlur={() =>
                  setFormErrors((prev) => ({
                    ...prev,
                    account_number: form.account_number ? undefined : 'Account number is required'
                  }))
                }
                error={!!formErrors.account_number}
                helperText={formErrors.account_number}
              />

              <TextField
                margin="normal"
                label="Bank Name"
                fullWidth
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                onBlur={() =>
                  setFormErrors((prev) => ({
                    ...prev,
                    bank_name: form.bank_name ? undefined : 'Bank name is required'
                  }))
                }
                error={!!formErrors.bank_name}
                helperText={formErrors.bank_name}
              />
            </Box>

            <TextField
              margin="normal"
              label="IFSC"
              fullWidth
              value={form.ifsc}
              onChange={(e) => setForm({ ...form, ifsc: e.target.value.toUpperCase() })}
              onBlur={() => {
                const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
                setFormErrors((prev) => ({
                  ...prev,
                  ifsc: !form.ifsc
                    ? 'IFSC is required'
                    : !ifscRegex.test(form.ifsc)
                    ? 'Invalid IFSC code format'
                    : undefined
                }));
              }}
              error={!!formErrors.ifsc}
              helperText={formErrors.ifsc}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpen(false)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                color: '#64748b',
                '&:hover': { backgroundColor: '#f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAddBank}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                backgroundColor: '#2196f3',
                boxShadow: '0 4px 12px rgba(33,150,243,0.4)',
                transition: 'all 0.3s ease',
                '&:hover': { backgroundColor: '#1976d2', boxShadow: '0 6px 16px rgba(33,150,243,0.5)' },
              }}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 🔒 Edit Bank Dialog (render only if allowed) */}
      {canEditBanks && (
        <Dialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          fullWidth
          maxWidth="sm"
          TransitionComponent={Transition}
          keepMounted
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
          <DialogTitle>Edit Bank</DialogTitle>
          <DialogContent
            dividers
            sx={{
              p: 3,
              overflowY: 'auto',
              maxHeight: '60vh',
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
              '-ms-overflow-style': 'none',
            }}
          >
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>Bank Details</Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <FormControl fullWidth margin="normal" error={!!editFormErrors.company_id}>
                <InputLabel id="edit-company-label">Company</InputLabel>
                <Select
                  labelId="edit-company-label"
                  value={editForm.company_id}
                  label="Company"
                  onChange={(e) => setEditForm({ ...editForm, company_id: e.target.value })}
                  onBlur={() => {
                    setEditFormErrors((prev) => ({
                      ...prev,
                      company_id: editForm.company_id ? undefined : 'Company is required'
                    }));
                  }}
                >
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
                {editFormErrors.company_id && (
                  <Typography color="error" variant="caption">{editFormErrors.company_id}</Typography>
                )}
              </FormControl>

              <TextField
                margin="normal"
                label="Account Name"
                fullWidth
                value={editForm.account_name}
                onChange={(e) => setEditForm({ ...editForm, account_name: e.target.value })}
                onBlur={() =>
                  setEditFormErrors((prev) => ({
                    ...prev,
                    account_name: editForm.account_name ? undefined : 'Account name is required'
                  }))
                }
                error={!!editFormErrors.account_name}
                helperText={editFormErrors.account_name}
              />

              <TextField
                margin="normal"
                label="Account Number"
                fullWidth
                value={editForm.account_number}
                onChange={(e) => setEditForm({ ...editForm, account_number: e.target.value })}
                onBlur={() =>
                  setEditFormErrors((prev) => ({
                    ...prev,
                    account_number: editForm.account_number ? undefined : 'Account number is required'
                  }))
                }
                error={!!editFormErrors.account_number}
                helperText={editFormErrors.account_number}
              />

              <TextField
                margin="normal"
                label="Bank Name"
                fullWidth
                value={editForm.bank_name}
                onChange={(e) => setEditForm({ ...editForm, bank_name: e.target.value })}
                onBlur={() =>
                  setEditFormErrors((prev) => ({
                    ...prev,
                    bank_name: editForm.bank_name ? undefined : 'Bank name is required'
                  }))
                }
                error={!!editFormErrors.bank_name}
                helperText={editFormErrors.bank_name}
              />

              <TextField
                margin="normal"
                label="IFSC"
                fullWidth
                value={editForm.ifsc}
                onChange={(e) => setEditForm({ ...editForm, ifsc: e.target.value.toUpperCase() })}
                onBlur={() => {
                  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
                  setEditFormErrors((prev) => ({
                    ...prev,
                    ifsc: !editForm.ifsc
                      ? 'IFSC is required'
                      : !ifscRegex.test(editForm.ifsc)
                      ? 'Invalid IFSC code format'
                      : undefined
                  }));
                }}
                error={!!editFormErrors.ifsc}
                helperText={editFormErrors.ifsc}
              />

              <FormControl component="fieldset" margin="normal">
                <FormLabel component="legend">Status</FormLabel>
                <RadioGroup
                  row
                  value={editForm.is_active ? 'true' : 'false'}
                  onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
                  sx={{ gap: 2 }}
                >
                  <FormControlLabel
                    value="true"
                    control={<Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} />}
                    label="Active"
                    sx={{ '& .MuiFormControlLabel-label': { color: '#424242' } }}
                  />
                  <FormControlLabel
                    value="false"
                    control={<Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} />}
                    label="Inactive"
                    sx={{ '& .MuiFormControlLabel-label': { color: '#424242' } }}
                  />
                </RadioGroup>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setEditOpen(false)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                color: '#64748b',
                '&:hover': { backgroundColor: '#f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleEditBank}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                backgroundColor: '#2196f3',
                boxShadow: '0 4px 12px rgba(33,150,243,0.4)',
                transition: 'all 0.3s ease',
                '&:hover': { backgroundColor: '#1976d2', boxShadow: '0 6px 16px rgba(33,150,243,0.5)' },
              }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Confirm Activate/Deactivate */}
      {canEditBanks && (
        <ConfirmDialog
          open={confirmOpen}
          title={selectedBank?.is_active ? 'Deactivate bank?' : 'Reactivate bank?'}
          description={
            selectedBank?.is_active
              ? 'This will mark the bank as inactive. Continue?'
              : 'This will mark the bank as active. Continue?'
          }
          onCancel={() => setConfirmOpen(false)}
          onConfirm={confirmToggleStatus}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MuiAlert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
