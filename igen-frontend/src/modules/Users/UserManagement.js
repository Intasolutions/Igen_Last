import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
  Switch,
  CircularProgress,
  Backdrop,
  InputAdornment,
  Chip,
  Tooltip,
  Card,
  CardContent,
  Slide,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  LockReset as LockResetIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

import API from '../../api/axios';

/* ---------------------------
   Slide-up dialog animation
---------------------------- */
const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

/* ---------------------------
   UserForm dialog
---------------------------- */
function UserForm({ open, onClose, onSave, user, roles, companies }) {
  const isEdit = Boolean(user?.id);

  const [form, setForm] = useState({
    user_id: '',
    full_name: '',
    role: 'ACCOUNTANT',
    company_ids: [],
    is_active: true,
    password: '' // required only on create
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit) {
      setForm({
        user_id: user?.user_id ?? '',
        full_name: user?.full_name ?? '',
        role: typeof user?.role === 'string' ? user.role : (user?.role?.id || user?.role || 'ACCOUNTANT'),
        company_ids: (user?.companies || []).map((c) => c.id),
        is_active: Boolean(user?.is_active),
        password: ''
      });
    } else {
      setForm({
        user_id: '',
        full_name: '',
        role: 'ACCOUNTANT',
        company_ids: [],
        is_active: true,
        password: ''
      });
    }
    setErrors({});
  }, [user, isEdit, open]);

  const validate = () => {
    const e = {};
    if (!form.user_id?.trim()) e.user_id = 'User ID is required';
    if (!form.full_name?.trim()) e.full_name = 'Full name is required';
    if (!form.role) e.role = 'Role is required';
    if (!isEdit && !form.password) e.password = 'Password is required';
    if (form.role !== 'SUPER_USER' && (!form.company_ids || form.company_ids.length === 0)) {
      e.company_ids = 'Select at least one company for this role';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload = {
      user_id: form.user_id.trim(),
      full_name: form.full_name.trim(),
      role: form.role,
      is_active: form.is_active,
      ...(form.role === 'SUPER_USER' ? {} : { company_ids: form.company_ids }),
      ...(form.password ? { password: form.password } : {})
    };

    try {
      await onSave(payload);
      onClose();
    } catch (_) {
      // onSave shows error; keep dialog open
    }
  };

  const fieldErr = (name) =>
    errors[name] ? { error: true, helperText: errors[name] } : {};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionComponent={Transition}
      keepMounted
      PaperProps={{
        sx: {
          borderRadius: 4,
          p: 1,
          backgroundColor: '#fafafa',
          boxShadow: 10,
          overflow: 'hidden',
        }
      }}
    >
      <DialogTitle sx={{ pb: 0.5 }}>{isEdit ? 'Edit User' : 'Add User'}</DialogTitle>
      <DialogContent
        dividers
        sx={{
          p: 3,
          overflowY: 'auto',
          maxHeight: '60vh',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          '-ms-overflow-style': 'none'
        }}
      >
        <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
          User Details
        </Typography>

        <TextField
          label="User ID"
          fullWidth
          margin="dense"
          value={form.user_id}
          onChange={(e) => setForm({ ...form, user_id: e.target.value })}
          disabled={isEdit}
          {...fieldErr('user_id')}
        />
        <TextField
          label="Full Name"
          fullWidth
          margin="dense"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          {...fieldErr('full_name')}
        />

        <TextField
          select
          label="Role"
          fullWidth
          margin="dense"
          value={form.role}
          onChange={(e) =>
            setForm({
              ...form,
              role: e.target.value,
              company_ids: e.target.value === 'SUPER_USER' ? [] : form.company_ids
            })
          }
          {...fieldErr('role')}
        >
          {(roles || []).map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>

        {form.role !== 'SUPER_USER' && (
          <TextField
            select
            label="Companies"
            fullWidth
            margin="dense"
            SelectProps={{
              multiple: true,
              renderValue: (selected) => {
                const selectedCompanies = (companies || []).filter((c) =>
                  selected.includes(c.id)
                );
                if (selectedCompanies.length === 0) return '';
                return (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedCompanies.map((c) => (
                      <Chip key={c.id} label={c.name} />
                    ))}
                  </Box>
                );
              }
            }}
            value={form.company_ids}
            onChange={(e) => setForm({ ...form, company_ids: e.target.value })}
            {...fieldErr('company_ids')}
          >
            {(companies || []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Box mt={1} display="flex" alignItems="center" gap={1}>
          <Typography>Status</Typography>
          <Switch
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          <Typography color={form.is_active ? 'success.main' : 'warning.main'}>
            {form.is_active ? 'Active' : 'Inactive'}
          </Typography>
        </Box>

        <TextField
          type="password"
          label={isEdit ? 'New Password (optional)' : 'Password'}
          fullWidth
          margin="dense"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          {...fieldErr('password')}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
            color: '#64748b',
            '&:hover': { backgroundColor: '#f1f5f9' }
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 500,
            backgroundColor: '#2196f3',
            boxShadow: '0 4px 12px rgba(33,150,243,0.35)',
            '&:hover': {
              backgroundColor: '#1976d2',
              boxShadow: '0 6px 16px rgba(33,150,243,0.45)'
            }
          }}
        >
          {isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ---------------------------
   UserManagement page
---------------------------- */
export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPasswordForm, setResetPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [resetError, setResetError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // --- Fetch users ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await API.get('users/');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setSnackbar({ open: true, message: 'Failed to load users', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch roles & companies ---
  const fetchRolesAndCompanies = async () => {
    try {
      const [rolesRes, companiesRes] = await Promise.all([
        API.get('users/roles/'),
        API.get('companies/')
      ]);
      setRoles(rolesRes.data || []);
      setCompanies(companiesRes.data || []);
    } catch (error) {
      console.error('Error fetching roles/companies:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRolesAndCompanies();
  }, []);

  // --- Handle save (add/update) ---
  const handleSave = async (form) => {
    try {
      const payload = { ...form };
      if (editUser) {
        await API.put(`users/${editUser.id}/`, payload);
        setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' });
      } else {
        await API.post('users/', payload);
        setSnackbar({ open: true, message: 'User added successfully', severity: 'success' });
        setTimeout(() => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }, 300);
      }
      await fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      const data = error.response?.data;
      const msg =
        typeof data === 'string'
          ? data
          : data?.detail ||
            Object.entries(data || {})
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
              .join(' | ') ||
            'Failed to save user';
      setSnackbar({ open: true, message: msg, severity: 'error' });
      throw error; // keep form open on error
    }
  };

  // --- Handle reset password ---
  const handleResetPassword = async () => {
    if (!resetPasswordForm.password || !resetPasswordForm.confirmPassword) {
      setResetError('Password and confirmation are required');
      return;
    }
    if (resetPasswordForm.password !== resetPasswordForm.confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    try {
      await API.post(`users/${resetUserId}/reset-password/`, {
        password: resetPasswordForm.password
      });
      setSnackbar({ open: true, message: 'Password reset successfully', severity: 'success' });
      setResetDialogOpen(false);
      setResetPasswordForm({ password: '', confirmPassword: '' });
      setResetError('');
    } catch (error) {
      console.error('Error resetting password:', error);
      setSnackbar({ open: true, message: 'Failed to reset password', severity: 'error' });
    }
  };

  // --- Filtered users for table ---
  const filteredUsers = users.filter((u) => {
    const q = (search || '').toLowerCase();
    const roleStr = typeof u.role === 'string' ? u.role : (u?.role?.name || '');
    const companyStr = (u?.companies || []).map((c) => c.name).join(' ');
    return (
      (u.user_id || '').toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      roleStr.toLowerCase().includes(q) ||
      companyStr.toLowerCase().includes(q)
    );
  });

  // --- CSV Export (UTF-8 BOM for Excel) ---
  const handleExport = () => {
    const filtered = filteredUsers; // use same filtered order for S.No
    const csv = [
      ['S.No', 'User ID', 'Full name', 'Role', 'Company', 'Status'],
      ...filtered.map((u, idx) => [
        idx + 1,
        u.user_id ?? '',
        u.full_name ?? '',
        (typeof u.role === 'string' ? u.role : (u?.role?.name ?? '')),
        (u?.companies || []).map((c) => c.name).join('; '),
        u.is_active ? 'Active' : 'Inactive'
      ])
    ]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = 'users.csv';
    link.click();
  };

  return (
    <Box sx={{ p: '35px' }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        User Management
      </Typography>

      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ my: 2 }}>
        <Box display="flex" gap={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Type user, role, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              backgroundColor: '#2196f3',
              boxShadow: '0 4px 12px rgba(33,150,243,0.35)',
              '&:hover': { backgroundColor: '#1976d2' }
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditUser(null); setOpen(true); }}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              backgroundColor: '#2196f3',
              boxShadow: '0 4px 12px rgba(33,150,243,0.35)',
              '&:hover': { backgroundColor: '#1976d2' }
            }}
          >
            Add User
          </Button>
        </Box>
        <Tooltip title="Refresh list">
          <IconButton onClick={fetchUsers}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent sx={{ p: 0 }}>
          <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  <TableCell>S.No</TableCell>
                  <TableCell>User ID</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((u, index) => (
                  <TableRow
                    key={u.id}
                    hover
                    sx={{
                      backgroundColor: u.is_active === false ? '#fff9c4' : '#e8f5e9',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    {/* Serial number */}
                    <TableCell>{index + 1}</TableCell>

                    <TableCell>{u.user_id}</TableCell>
                    <TableCell>{u.full_name}</TableCell>
                    <TableCell>{typeof u.role === 'string' ? u.role : (u?.role?.name ?? '')}</TableCell>
                    <TableCell>
                      {(u?.companies || []).map((c) => c.name).join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={u.is_active ? 'success' : 'default'}
                        label={u.is_active ? 'Active' : 'Inactive'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          color="primary"
                          onClick={() => { setEditUser(u); setOpen(true); }}
                          aria-label="Edit user"
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Reset Password">
                        <IconButton
                          onClick={() => { setResetUserId(u.id); setResetDialogOpen(true); }}
                          aria-label="Reset password"
                        >
                          <LockResetIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* User Form */}
      <UserForm
        open={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        user={editUser}
        roles={roles}
        companies={companies}
      />

      {/* Reset Password Dialog */}
      <Dialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        TransitionComponent={Transition}
        keepMounted
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            backgroundColor: '#fafafa',
            boxShadow: 10,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle sx={{ pb: 0.5 }}>Reset Password</DialogTitle>
        <DialogContent
          dividers
          sx={{
            p: 3,
            overflowY: 'auto',
            maxHeight: '60vh',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
            '-ms-overflow-style': 'none'
          }}
        >
          <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
            Enter New Password
          </Typography>
          <TextField
            type="password"
            label="New Password"
            fullWidth
            margin="dense"
            value={resetPasswordForm.password}
            onChange={(e) =>
              setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })
            }
          />
          <TextField
            type="password"
            label="Confirm Password"
            fullWidth
            margin="dense"
            value={resetPasswordForm.confirmPassword}
            onChange={(e) =>
              setResetPasswordForm({
                ...resetPasswordForm,
                confirmPassword: e.target.value
              })
            }
          />
          {resetError && <Typography color="error">{resetError}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setResetDialogOpen(false)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': { backgroundColor: '#f1f5f9' }
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleResetPassword}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              backgroundColor: '#2196f3',
              boxShadow: '0 4px 12px rgba(33,150,243,0.35)',
              '&:hover': { backgroundColor: '#1976d2' }
            }}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Loader */}
      <Backdrop open={loading} sx={{ color: '#fff', zIndex: (t) => t.zIndex.drawer + 1 }}>
        <CircularProgress color="inherit" />
      </Backdrop>

      {/* “User Added” toast */}
      {showSuccess && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            bgcolor: 'success.main',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
            boxShadow: 6
          }}
        >
          User Added Successfully
        </Box>
      )}
    </Box>
  );
}
