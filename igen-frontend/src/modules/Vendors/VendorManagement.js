// src/modules/Vendors/VendorManagement.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Snackbar, Typography, Select, MenuItem, InputLabel, FormControl,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Paper,
  TablePagination, IconButton, Tooltip, Slide
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import EditIcon from '@mui/icons-material/Edit';
import { styled } from '@mui/material/styles';
import { RadioGroup, FormControlLabel, Radio } from '@mui/material';

import API from '../../api/axios';
import SearchBar from '../../components/SearchBar';
import StatusFilter, { statusToIsActive } from '../../components/StatusFilter';
import { perms } from '../../utils/perm'; // ⬅️ permission helper

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const Alert = React.forwardRef((props, ref) => (
  <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />
));

const vendorTypeOptions = [
  { value: 'Contractor', label: 'Contractor' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'Consultant', label: 'Consultant' },
];

// Styled cells/rows
const StyledTableCell = styled(TableCell)(() => ({
  fontWeight: 'bold',
  backgroundColor: '#e3f2fd',
}));

// avoid forwarding the "inactive" prop to the DOM node
const StyledTableRow = styled(TableRow, {
  shouldForwardProp: (prop) => prop !== 'inactive',
})(({ inactive }) => ({
  backgroundColor: inactive ? '#fffde7' : '#e8f5e9',
  transition: 'background-color .2s',
  '&:hover': {
    backgroundColor: inactive ? '#fff9c4' : '#c8e6c9',
  },
}));

export default function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(''); // '', 'active', 'inactive'
  const [formErrors, setFormErrors] = useState({});

  // 🔐 compute permission once
  const canEdit = perms.editVendors();

  const initialForm = {
    vendor_name: '',
    vendor_type: '',
    pan_number: '',
    gst_number: '',
    contact_person: '',
    email: '',
    phone_number: '',
    bank_name: '',
    bank_account: '',
    ifsc_code: '',
    address: '',
    notes: '',
    company_id: '',
    is_active: true,
  };
  const [form, setForm] = useState(initialForm);

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  // ---------- DATA FETCH ----------
  const fetchVendors = async () => {
    try {
      const params = {};
      const isActive = statusToIsActive(selectedStatus);
      if (typeof isActive === 'boolean') params.is_active = isActive;

      const res = await API.get('vendors/vendors/', { params });
      const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setVendors(items || []);
    } catch {
      setVendors([]);
      showSnackbar('Failed to fetch vendors.', 'error');
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      const items = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setCompanies(items || []);
    } catch {
      setCompanies([]);
      showSnackbar('Failed to load companies.', 'error');
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refetch when status changes (server-side filter)
  useEffect(() => {
    fetchVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  // ---------- FORM ----------
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    const errors = {};

    // Required
    if (!form.vendor_name?.trim()) errors.vendor_name = 'Vendor Name is required.';
    if (!form.vendor_type) errors.vendor_type = 'Vendor Type is required.';

    // Formats
    if (form.phone_number && !/^\d{10}$/.test(form.phone_number)) {
      errors.phone_number = 'Phone number must be 10 digits.';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Invalid email address.';
    }
    if (form.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number.toUpperCase())) {
      errors.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';
    }
    if (form.gst_number && !/^[0-9A-Z]{15}$/.test(form.gst_number.toUpperCase())) {
      errors.gst_number = 'Invalid GST Number.';
    }

    // Bank fields grouped
    if (form.bank_name || form.bank_account || form.ifsc_code) {
      if (!form.bank_name?.trim()) errors.bank_name = 'Bank Name is required if any bank detail is entered.';
      if (form.bank_account && !/^\d+$/.test(form.bank_account)) errors.bank_account = 'Bank Account must be numeric.';
      if (form.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc_code.toUpperCase())) {
        errors.ifsc_code = 'Invalid IFSC format (e.g. HDFC0001234).';
      }
    }

    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    try {
      if (editingIndex !== null) {
        await API.put(`vendors/vendors/${vendors[editingIndex].id}/`, { ...form });
        showSnackbar('Vendor updated');
      } else {
        await API.post('vendors/vendors/', { ...form });
        showSnackbar('Vendor created');
      }
      setOpen(false);
      setForm(initialForm);
      setEditingIndex(null);
      fetchVendors();
    } catch (err) {
      console.error(err?.response?.data || err);
      showSnackbar('Save failed', 'error');
    }
  };

  const handleEdit = (index) => {
    const vendor = vendors[index];
    setForm({
      ...initialForm,
      ...vendor,
      company_id: vendor?.company_id || vendor?.company?.id || '',
      is_active: !!vendor?.is_active,
    });
    setEditingIndex(index);
    setOpen(true);
  };

  // ---------- TABLE DATA ----------
  const filteredVendors = useMemo(() => {
    const q = (search || '').toLowerCase();
    return vendors.filter((vendor) => {
      const matchesSearch =
        (vendor.vendor_name || '').toLowerCase().includes(q) ||
        (vendor.phone_number || '').toLowerCase().includes(q) ||
        (vendor.pan_number || '').toLowerCase().includes(q);

      const matchesStatus = selectedStatus
        ? selectedStatus === 'active'
          ? !!vendor.is_active
          : !vendor.is_active
        : true;

      return matchesSearch && matchesStatus;
    });
  }, [vendors, search, selectedStatus]);

  // handle “All” (-1) rowsPerPage properly
  const visibleRows = useMemo(() => {
    if (rowsPerPage === -1) return filteredVendors;
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredVendors.slice(start, end);
  }, [filteredVendors, page, rowsPerPage]);

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    const v = parseInt(e.target.value, 10);
    setRowsPerPage(v);
    setPage(0);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" mb={4} fontWeight={700}>Vendor Management</Typography>

      {/* Header: left = search, right = status filter + (maybe) button */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
        gap={2}
        flexWrap="wrap"
      >
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label="Search vendor phone or name or pan ..."
        />

        <Box display="flex" gap={2} alignItems="center">
          <StatusFilter
            value={selectedStatus}
            onChange={(v) => { setSelectedStatus(v); setPage(0); }}
            labelAll="All Vendors"
            sx={{ minWidth: 180 }}
          />

          {canEdit && (
            <Button
              variant="contained"
              onClick={() => { setForm(initialForm); setEditingIndex(null); setOpen(true); }}
            >
              Add New Vendor
            </Button>
          )}
        </Box>
      </Box>

      <Card sx={{ boxShadow: 4, borderRadius: 3 }}>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <StyledTableCell>#</StyledTableCell>
                  <StyledTableCell>Name</StyledTableCell>
                  <StyledTableCell>Type</StyledTableCell>
                  <StyledTableCell>PAN</StyledTableCell>
                  <StyledTableCell>GST</StyledTableCell>
                  <StyledTableCell>Phone</StyledTableCell>
                  <StyledTableCell>Email</StyledTableCell>
                  <StyledTableCell>Bank</StyledTableCell>
                  <StyledTableCell>IFSC</StyledTableCell>
                  <StyledTableCell>Address</StyledTableCell>
                  {canEdit && <StyledTableCell>Actions</StyledTableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((vendor, i) => (
                  <StyledTableRow key={vendor.id} inactive={!vendor.is_active}>
                    <TableCell>{(rowsPerPage === -1 ? 0 : page * rowsPerPage) + i + 1}</TableCell>
                    <TableCell>{vendor.vendor_name}</TableCell>
                    <TableCell>{vendor.vendor_type}</TableCell>
                    <TableCell>{vendor.pan_number}</TableCell>
                    <TableCell>{vendor.gst_number}</TableCell>
                    <TableCell>{vendor.phone_number}</TableCell>
                    <TableCell>{vendor.email}</TableCell>
                    <TableCell>{vendor.bank_name}</TableCell>
                    <TableCell>{vendor.ifsc_code}</TableCell>
                    <TableCell>{vendor.address}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <Tooltip title="Edit Vendor">
                          <IconButton onClick={() => handleEdit((rowsPerPage === -1 ? i : page * rowsPerPage + i))} color="primary">
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </StyledTableRow>
                ))}

                {visibleRows.length === 0 && (
                  <TableRow>
                    {/* 10 columns without Actions; 11 with Actions */}
                    <TableCell colSpan={canEdit ? 11 : 10} align="center">No vendors found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>

        <TablePagination
          component="div"
          count={filteredVendors.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
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
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        TransitionComponent={Transition}
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
        <DialogTitle>{editingIndex !== null ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>

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
          <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>Vendor Details</Typography>
          <Box className="space-y-4">
            <TextField
              name="vendor_name"
              label="Vendor Name"
              value={form.vendor_name || ''}
              onChange={handleChange}
              fullWidth
              required
              error={!!formErrors.vendor_name}
              helperText={formErrors.vendor_name}
            />

            <FormControl fullWidth required error={!!formErrors.vendor_type}>
              <InputLabel>Vendor Type</InputLabel>
              <Select name="vendor_type" value={form.vendor_type || ''} onChange={handleChange} label="Vendor Type">
                {vendorTypeOptions.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
              {formErrors.vendor_type && (
                <Typography variant="caption" color="error">{formErrors.vendor_type}</Typography>
              )}
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="pan_number"
                label="PAN Number"
                value={form.pan_number || ''}
                onChange={handleChange}
                error={!!formErrors.pan_number}
                helperText={formErrors.pan_number}
                fullWidth
              />
              <TextField
                name="gst_number"
                label="GST Number"
                value={form.gst_number || ''}
                onChange={handleChange}
                error={!!formErrors.gst_number}
                helperText={formErrors.gst_number}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="contact_person"
                label="Contact Person"
                value={form.contact_person || ''}
                onChange={handleChange}
                error={!!formErrors.contact_person}
                helperText={formErrors.contact_person}
                fullWidth
              />
              <TextField
                name="email"
                label="Email Address"
                value={form.email || ''}
                onChange={handleChange}
                error={!!formErrors.email}
                helperText={formErrors.email}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="phone_number"
                label="Phone Number"
                value={form.phone_number || ''}
                onChange={handleChange}
                error={!!formErrors.phone_number}
                helperText={formErrors.phone_number}
                fullWidth
              />
              <TextField
                name="bank_name"
                label="Bank Name"
                value={form.bank_name || ''}
                onChange={handleChange}
                error={!!formErrors.bank_name}
                helperText={formErrors.bank_name}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="bank_account"
                label="Bank Account No."
                value={form.bank_account || ''}
                onChange={handleChange}
                error={!!formErrors.bank_account}
                helperText={formErrors.bank_account}
                fullWidth
              />
              <TextField
                name="ifsc_code"
                label="IFSC Code"
                value={form.ifsc_code || ''}
                onChange={handleChange}
                error={!!formErrors.ifsc_code}
                helperText={formErrors.ifsc_code}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                name="address"
                label="Address"
                value={form.address || ''}
                onChange={handleChange}
                error={!!formErrors.address}
                helperText={formErrors.address}
                fullWidth
              />
              <TextField
                name="notes"
                label="Notes"
                value={form.notes || ''}
                onChange={handleChange}
                fullWidth
              />
            </Box>

            <FormControl fullWidth error={!!formErrors.company_id}>
              <InputLabel>Company</InputLabel>
              <Select
                name="company_id"
                value={form.company_id || ''}
                onChange={handleChange}
                label="Company"
              >
                {companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
                ))}
              </Select>
              {formErrors.company_id && (
                <Typography variant="caption" color="error">{formErrors.company_id}</Typography>
              )}
            </FormControl>

            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <Typography variant="subtitle1">Status</Typography>
              <RadioGroup
                row
                value={form.is_active ? 'active' : 'inactive'}
                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
              >
                <FormControlLabel
                  value="active"
                  control={<Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} />}
                  label="Active"
                />
                <FormControlLabel
                  value="inactive"
                  control={<Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} />}
                  label="Inactive"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}
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
          <Button variant="contained" onClick={handleSubmit}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              backgroundColor: '#2196f3',
              boxShadow: '0 4px 12px rgba(33,150,243,0.4)',
              transition: 'all 0.3s ease',
              '&:hover': {
                backgroundColor: '#1976d2',
                boxShadow: '0 6px 16px rgba(33,150,243,0.5)',
              },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
