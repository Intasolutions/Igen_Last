'use client';

import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControl, InputLabel, Select, Checkbox,
  ListItemText, Typography, Paper, Chip, IconButton, Tooltip,
  Snackbar, Alert, Card, CardContent, TableContainer, Table, TableHead, TableBody, TableCell, TableRow,
  RadioGroup, FormControlLabel, Radio
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockResetIcon from '@mui/icons-material/LockReset';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import InputAdornment from '@mui/material/InputAdornment';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Stack } from '@mui/material';
import { TablePagination } from '@mui/material';
import SearchBar from '../../components/SearchBar';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    user_id: '',
    full_name: '',
    role: 'ACCOUNTANT',
    password: '',
    confirm_password: '',
    company_ids: [],
  });

  const [editForm, setEditForm] = useState({
    id: '',
    full_name: '',
    role: '',
    company_ids: [],
    is_active: true,
  });

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const roleOptions = [
    { value: 'SUPER_USER', label: 'Super User' },
    { value: 'CENTER_HEAD', label: 'Center Head' },
    { value: 'ACCOUNTANT', label: 'Accountant' },
    { value: 'PROPERTY_MANAGER', label: 'Property Manager' },
  ];

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // ---- validations ----
  const validateUserId = (id) => (!id ? 'User ID is required' : '');
  const validateName = (name) => {
    if (!name) return 'Full name is required';
    if (!/^[A-Za-z\s]+$/.test(name)) return 'Only letters and spaces allowed';
    return '';
  };
  const validatePassword = (pass) => {
    if (!pass) return 'Password is required';
    if (pass.length < 6) return 'Must be at least 6 characters';
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(pass)) return 'Must include letters and numbers';
    return '';
  };
  const validateConfirmPassword = (pass, confirm) => {
    if (!confirm) return 'Confirm password is required';
    if (pass !== confirm) return 'Passwords do not match';
    return '';
  };

  // ---- data ----
  const fetchUsers = async () => {
    try {
      const res = await API.get('users/?ordering=-created_at');
      // handle both list and paginated formats
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setUsers(data);
    } catch (err) {
      console.error('Fetch error:', err.response?.data);
      showSnackbar('Error fetching users', 'error');
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      if (Array.isArray(res.data)) setCompanies(res.data);
      else showSnackbar('Unexpected response format when fetching companies', 'error');
    } catch (err) {
      console.error('Fetch companies error:', err.response?.data);
      showSnackbar('Error fetching companies', 'error');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
  }, []);

  // Reset to page 0 when list or search changes to avoid empty pages
  useEffect(() => {
    setPage(0);
  }, [searchQuery, users]);

  // If "All" is selected, ensure page is 0
  useEffect(() => {
    if (rowsPerPage === -1) setPage(0);
  }, [rowsPerPage]);

  // ---- create ----
  const handleAddUser = async () => {
    const { user_id, password, full_name, confirm_password, company_ids, role } = form;

    const idError = validateUserId(user_id);
    const nameError = validateName(full_name);
    const passError = validatePassword(password);
    const confirmError = validateConfirmPassword(password, confirm_password);

    const needsCompanies = role !== 'SUPER_USER';
    const companiesInvalid = needsCompanies && (!Array.isArray(company_ids) || company_ids.length === 0);

    if (idError || nameError || passError || confirmError || companiesInvalid) {
      showSnackbar('Please correct the highlighted errors', 'error');
      return;
    }

    try {
      // build payload WITHOUT confirm_password
      const { confirm_password: _omit, ...base } = form;
      let payload = base;

      if (role === 'SUPER_USER') {
        // SUPER_USER: no companies needed/sent
        const { company_ids: _omit2, ...rest } = base;
        payload = rest;
      }

      await API.post('users/', payload);
      showSnackbar('User added successfully!', 'success');
      await fetchUsers();
      setOpen(false);
      setForm({
        user_id: '',
        full_name: '',
        role: 'ACCOUNTANT',
        password: '',
        confirm_password: '',
        company_ids: [],
      });
    } catch (err) {
      console.error('Add error:', err.response?.data);
      showSnackbar('Failed to add user: ' + (err.response?.data?.detail || 'Unknown error'), 'error');
    }
  };

  // ---- edit ----
  const openEditModal = (user) => {
    setEditForm({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      company_ids: Array.isArray(user.companies) ? user.companies.map(c => c.id) : [],
      is_active: !!user.is_active,
    });
    setEditOpen(true);
  };

  const handleEditUser = async () => {
    const needsCompanies = editForm.role !== 'SUPER_USER';
    const companiesInvalid = needsCompanies && (!Array.isArray(editForm.company_ids) || editForm.company_ids.length === 0);

    if (!editForm.full_name || !editForm.role || companiesInvalid) {
      showSnackbar('Please fill in all required fields', 'error');
      return;
    }
    try {
      const payload =
        editForm.role === 'SUPER_USER'
          ? { full_name: editForm.full_name, role: editForm.role, is_active: editForm.is_active }
          : { full_name: editForm.full_name, role: editForm.role, company_ids: editForm.company_ids, is_active: editForm.is_active };

      await API.put(`users/${editForm.id}/`, payload);
      showSnackbar('User updated successfully!', 'success');
      await fetchUsers();
      setEditOpen(false);
    } catch (err) {
      console.error('Edit error:', err.response?.data);
      showSnackbar('Failed to update user', 'error');
    }
  };

  // ---- deactivate ----
  const deactivateUser = async (id) => {
    try {
      await API.post(`users/${id}/deactivate/`);
      showSnackbar('User deactivated successfully!', 'success');
      await fetchUsers();
    } catch (err) {
      console.error('Deactivate error:', err.response?.data);
      showSnackbar('Failed to deactivate user', 'error');
    }
  };

  // ---- password reset ----
  const openResetDialog = (id) => {
    setResetUserId(id);
    setNewPassword('');
    setConfirmPassword('');
    setResetDialogOpen(true);
  };

  const handlePasswordReset = async () => {
    if (!newPassword) {
      showSnackbar('Password cannot be empty', 'error');
      return;
    }
    try {
      await API.post(`users/${resetUserId}/reset-password/`, {
        password: newPassword,
        confirm_password: confirmPassword,
      });
      showSnackbar('Password reset successfully!', 'success');
      setResetDialogOpen(false);
    } catch (err) {
      console.error('Reset error:', err.response?.data);
      showSnackbar('Failed to reset password: ' + (err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Unknown error'), 'error');
    }
  };

  // ---- table helpers ----
  const filteredUsers = users.filter((u) =>
    (u.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );
  const pageSize = rowsPerPage === -1 ? filteredUsers.length : rowsPerPage;
  const start = page * pageSize;
  const end = start + pageSize;

  return (
    <div className='p-[35px]'>
      <Typography variant="h5" gutterBottom>User Management</Typography>

      <div className="flex justify-between items-center mb-4 mt-6">
        <div className="flex-1 max-w-sm">
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            label="Search User"
            placeholder="Enter name to search"
          />
        </div>

        <div className='flex gap-3'>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => {
              setForm({
                user_id: '',
                full_name: '',
                role: 'ACCOUNTANT',
                password: '',
                confirm_password: '',
                company_ids: [],
              });
              setOpen(true);
              setEditOpen(false);
            }}
            sx={{ borderRadius: 2, px: 3, py: 1.5, fontSize: 13 }}
          >
            Add User
          </Button>
        </div>
      </div>

      <Card sx={{ boxShadow: 3, borderRadius: 3, mt: 3 }}>
        <CardContent>
          <TableContainer component={Paper} elevation={1}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Full Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>User ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Role & Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Companies</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                </TableRow> {/* ✅ fixed: was </Row> */}
              </TableHead>
              <TableBody>
                {filteredUsers
                  .slice(start, rowsPerPage === -1 ? undefined : end)
                  .map((u, index) => (
                    <TableRow key={u.id} hover>
                      <TableCell>{start + index + 1}</TableCell>
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell>{u.user_id}</TableCell>
                      <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={u.role} size="small" />
                        <Chip
                          label={u.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          sx={{
                            bgcolor: u.is_active ? '#d0f0c0' : '#fff8dc',
                            color: u.is_active ? '#388e3c' : '#f57c00',
                            fontWeight: 500
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {u.role !== 'SUPER_USER' && (u.companies || []).map((c) => (
                            <Chip
                              key={c.id}
                              label={c.name}
                              size="small"
                              sx={{ backgroundColor: '#f1f1f1', fontSize: 12 }}
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Reset Password" arrow>
                          <IconButton onClick={() => openResetDialog(u.id)}>
                            <LockResetIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit User" arrow>
                          <IconButton onClick={() => openEditModal(u)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={u.is_active ? "Deactivate User" : "Already Inactive"} arrow>
                          <span>
                            <IconButton
                              onClick={() => deactivateUser(u.id)}
                              disabled={!u.is_active}
                            >
                              <DeleteIcon color={u.is_active ? 'error' : 'disabled'} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">No users found.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <TablePagination
        component="div"
        count={filteredUsers.length}
        page={page}
        onPageChange={(e, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          const next = parseInt(e.target.value, 10);
          setRowsPerPage(next);
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
        sx={{ mt: 2 }}
      />

      {/* Add / Edit Dialog */}
      <Dialog
        open={open || editOpen}
        onClose={() => { setOpen(false); setEditOpen(false); }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}
      >
        <DialogTitle sx={{ fontSize: 20, fontWeight: 600, pb: 0 }}>
          {open ? 'Add New User' : 'Edit User'}
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={3}>
            {/* ---- Add ---- */}
            {open && (
              <>
                <TextField
                  label="User ID"
                  variant="outlined"
                  fullWidth
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  helperText={validateUserId(form.user_id)}
                  error={!!validateUserId(form.user_id)}
                />

                <TextField
                  label="Full Name"
                  variant="outlined"
                  fullWidth
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  helperText={validateName(form.full_name)}
                  error={!!validateName(form.full_name)}
                />

                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  helperText={validatePassword(form.password)}
                  error={!!validatePassword(form.password)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <TextField
                  label="Confirm Password"
                  type={showPassword ? 'text' : 'password'}
                  variant="outlined"
                  fullWidth
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  helperText={validateConfirmPassword(form.password, form.confirm_password)}
                  error={!!validateConfirmPassword(form.password, form.confirm_password)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />

                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    label="Role"
                    value={form.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        role,
                        // clear companies if SUPER_USER
                        company_ids: role === 'SUPER_USER' ? [] : prev.company_ids,
                      }));
                    }}
                  >
                    {roleOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Companies only when NOT SUPER_USER */}
                {form.role !== 'SUPER_USER' && (
                  <FormControl fullWidth>
                    <InputLabel>Companies</InputLabel>
                    <Select
                      label="Companies"
                      multiple
                      value={form.company_ids}
                      onChange={(e) => setForm({ ...form, company_ids: e.target.value })}
                      renderValue={(selected) =>
                        companies
                          .filter((c) => selected.includes(c.id))
                          .map((c) => c.name)
                          .join(', ')
                      }
                    >
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          <Checkbox checked={form.company_ids.includes(company.id)} />
                          <ListItemText primary={company.name} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </>
            )}

            {/* ---- Edit ---- */}
            {editOpen && (
              <>
                <TextField
                  label="Full Name"
                  variant="outlined"
                  fullWidth
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />

                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    label="Role"
                    value={editForm.role}
                    onChange={(e) => {
                      const role = e.target.value;
                      setEditForm((prev) => ({
                        ...prev,
                        role,
                        company_ids: role === 'SUPER_USER' ? [] : prev.company_ids,
                      }));
                    }}
                  >
                    {roleOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Companies only when NOT SUPER_USER */}
                {editForm.role !== 'SUPER_USER' && (
                  <FormControl fullWidth>
                    <InputLabel>Companies</InputLabel>
                    <Select
                      label="Companies"
                      multiple
                      value={editForm.company_ids}
                      onChange={(e) => setEditForm({ ...editForm, company_ids: e.target.value })}
                      renderValue={(selected) =>
                        companies
                          .filter((c) => selected.includes(c.id))
                          .map((c) => c.name)
                          .join(', ')
                      }
                    >
                      {companies.map((company) => (
                        <MenuItem key={company.id} value={company.id}>
                          <Checkbox checked={editForm.company_ids.includes(company.id)} />
                          <ListItemText primary={company.name} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {/* Active / Inactive toggle */}
                <FormControl component="fieldset">
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Status</Typography>
                  <RadioGroup
                    row
                    value={editForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) =>
                      setEditForm({ ...editForm, is_active: e.target.value === 'active' })
                    }
                  >
                    <FormControlLabel value="active" control={<Radio />} label="Active" />
                    <FormControlLabel value="inactive" control={<Radio />} label="Inactive" />
                  </RadioGroup>
                </FormControl>
              </>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2, pt: 1 }}>
          <Button variant="outlined" onClick={() => { setOpen(false); setEditOpen(false); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={open ? handleAddUser : handleEditUser}
          >
            {open ? 'Add' : 'Done'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 4, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600, fontSize: 18 }}>
          Reset Password
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              )
            }}
            helperText="At least 6 characters with letters and numbers"
          />

          <TextField
            label="Confirm Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            variant="outlined"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            sx={{ mt: 2 }}
            error={confirmPassword && newPassword !== confirmPassword}
            helperText={
              confirmPassword && newPassword !== confirmPassword
                ? 'Passwords do not match'
                : 'Re-enter the password to confirm'
            }
          />

          {newPassword.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor:
                    newPassword.length < 6
                      ? '#f44336'
                      : /(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)
                        ? '#4caf50'
                        : '#ff9800',
                  transition: 'background-color 0.3s ease'
                }}
              />
              <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                {newPassword.length < 6
                  ? 'Too short'
                  : /(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)
                    ? 'Strong password'
                    : 'Try adding numbers and letters'}
              </Typography>
            </div>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => {
            setResetDialogOpen(false);
            setNewPassword('');
            setConfirmPassword('');
          }} variant="outlined">
            Cancel
          </Button>

          <Button
            onClick={handlePasswordReset}
            variant="contained"
            color="primary"
            disabled={
              newPassword.length < 6 ||
              !/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword) ||
              confirmPassword !== newPassword
            }
          >
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%', backgroundColor: snackbar.severity === 'success' ? '#4caf50' : snackbar.severity === 'error' ? '#f44336' : '#2196f3' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
