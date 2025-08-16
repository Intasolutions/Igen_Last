import React, { useEffect, useState } from 'react';
import {
  Button, TextField, Dialog, DialogActions, DialogContent,
  DialogTitle, Snackbar, MenuItem, Typography, Box, Select,
  InputLabel, FormControl, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, Paper, IconButton,
  TablePagination, Tooltip,Slide,
  Card,
  CardContent
} from '@mui/material';
import MuiAlert from '@mui/material/Alert';
import EditIcon from '@mui/icons-material/Edit';
import { styled } from '@mui/material/styles';
import { RadioGroup, FormControlLabel, Radio } from '@mui/material';

import API from '../../api/axios';
import ConfirmDialog from '../../components/ConfirmDialog';
import SearchBar from '../../components/SearchBar';


const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const Alert = React.forwardRef((props, ref) => {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const vendorTypeOptions = [
  { value: 'Contractor', label: 'Contractor' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'Consultant', label: 'Consultant' }
];

// Styled table cells
const StyledTableCell = styled(TableCell)(() => ({
  fontWeight: 'bold',
  backgroundColor: '#e3f2fd',
}));

// Styled table rows
const StyledTableRow = styled(TableRow)(({ inactive }) => ({
  backgroundColor: inactive ? '#fff8e1' : '#e8f5e9',
  '&:nth-of-type(even)': {
    backgroundColor: inactive ? '#fffde7' : '#f1f8e9',
  },
}));

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [search, setSearch] = useState("");
  const [formErrors, setFormErrors] = useState({});
const [confirmOpen, setConfirmOpen] = useState(false);
const [selectedVendor, setSelectedVendor] = useState(null);


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
    is_active: true
  };

  const [form, setForm] = useState(initialForm);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const fetchVendors = async () => {
    try {
      const res = await API.get('/vendors/');
      setVendors(res.data);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to fetch vendors.', 'error');
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get('/companies/');
      setCompanies(res.data);
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load companies.', 'error');
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchCompanies();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Validations
  const isValidPAN = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  const isValidIFSC = (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());

const handleSubmit = async () => {
  let errors = {};

  if (!form.vendor_name.trim()) errors.vendor_name = 'Vendor Name is required.';
  if (!form.vendor_type) errors.vendor_type = 'Vendor Type is required.';
  if (!form.contact_person.trim()) errors.contact_person = 'Contact Person is required.';
  if (!/^\d{10}$/.test(form.phone_number)) errors.phone_number = 'Phone number must be 10 digits.';
  if (!form.bank_name.trim()) errors.bank_name = 'Bank Name is required.';
  if (!/^\d+$/.test(form.bank_account)) errors.bank_account = 'Bank Account must be numeric.';
  if (!form.address.trim()) errors.address = 'Address is required.';
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan_number)) errors.pan_number = 'Invalid PAN format (e.g. ABCDE1234F)';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc_code.toUpperCase())) errors.ifsc_code = 'Invalid IFSC format (e.g. HDFC0001234)';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email address.';
  if (form.gst_number && !/^[0-9A-Z]{15}$/.test(form.gst_number)) errors.gst_number = 'Invalid GST Number.';

  setFormErrors(errors);

  if (Object.keys(errors).length > 0) return; // Stop if errors exist

  // Proceed with API call
  try {
   if (editingIndex !== null) {
  await API.put(`/vendors/${vendors[editingIndex].id}/`, { 
    ...form, 
    is_active: form.is_active 
  });
} else {
  await API.post('/vendors/', { 
    ...form, 
    is_active: form.is_active 
  });
}

    setOpen(false);
    setForm(initialForm);
    setEditingIndex(null);
    fetchVendors();
  } catch (err) {
    console.error(err.response?.data || err);
  }
};

const handleEdit = (index) => {
  const vendor = vendors[index];
  setForm({
    ...vendor,
    company_id: vendor.company_id || vendor.company?.id || '',
    is_active: vendor.is_active
  });
  setEditingIndex(index);
  setOpen(true);
};




  // Pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter vendors
  const filteredVendors = vendors.filter(v =>
    v.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    v.phone_number?.toLowerCase().includes(search.toLowerCase()) ||
    v.pan_number?.toLowerCase().includes(search.toLowerCase())
  );

const handleToggleClick = (vendor) => {
  setSelectedVendor(vendor);
  setConfirmOpen(true);
};

const handleConfirmToggle = async () => {
  if (!selectedVendor) return;
  try {
    await API.patch(`/vendors/${selectedVendor.id}/`, {
      is_active: !selectedVendor.is_active
    });
    showSnackbar(
      `Vendor ${selectedVendor.is_active ? 'deactivated' : 'activated'} successfully`
    );
    fetchVendors();
  } catch (err) {
    console.error(err);
    showSnackbar('Error updating vendor status.', 'error');
  }
  setConfirmOpen(false);
};
const StyledTableRow = styled(TableRow)(({ inactive }) => ({
  backgroundColor: inactive ? '#fff8e1' : '#e8f5e9',
  '&:nth-of-type(even)': {
    backgroundColor: inactive ? '#fffde7' : '#f1f8e9',
  },
}));


  return (
    <Box p={3}>
      <Typography variant="h5" mb={4} fontWeight={700}>Vendor Management</Typography>
      <Box display="flex" justifyContent="space-between" mb={3}>
       
   <SearchBar
   value={search}
   onChange={(e) => setSearch(e.target.value)}
   label='Search vendor phone or name or pan ....'
   />
         <Button variant="contained" onClick={() => { setForm(initialForm); setEditingIndex(null); setOpen(true); }}>
          Add New Vendor
        </Button>
      </Box>

      {/* Table */}
     <Card sx={{ boxShadow: 4, borderRadius: 3 }}>
      <CardContent>
       <TableContainer component={Paper} >
        <Table size='small'>
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
              <StyledTableCell>Actions</StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredVendors
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((v, i) => (
              <StyledTableRow key={v.id} inactive={!v.is_active}>

                  <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                  <TableCell>{v.vendor_name}</TableCell>
                  <TableCell>{v.vendor_type}</TableCell>
                  <TableCell>{v.pan_number}</TableCell>
                  <TableCell>{v.gst_number}</TableCell>
                  <TableCell>{v.phone_number}</TableCell>
                  <TableCell>{v.email}</TableCell>
                  <TableCell>{v.bank_name}</TableCell>
                  <TableCell>{v.ifsc_code}</TableCell>
                  <TableCell>{v.address}</TableCell>
                  <TableCell>
                    <Tooltip title="Edit Vendor">
                      <IconButton onClick={() => handleEdit(i)} color="primary">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={v.is_active ? "Deactivate Vendor" : "Activate Vendor"}>


<ConfirmDialog
  open={confirmOpen}
  title={selectedVendor?.is_active ? 'Deactivate Vendor' : 'Activate Vendor'}
  content={`Are you sure you want to ${selectedVendor?.is_active ? 'deactivate' : 'activate'} vendor "${selectedVendor?.vendor_name}"?`}
  onClose={() => setConfirmOpen(false)}
  onConfirm={handleConfirmToggle}
/>
                    </Tooltip>
                  </TableCell>
                </StyledTableRow>
              ))}
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
        rowsPerPageOptions={[5, 10, 25]}
      />
 
     </Card>

      

      {/* Dialog */}
<Dialog
  open={open}
  onClose={() => setOpen(false)}
  fullWidth
  maxWidth="sm"
  TransitionComponent={Transition}
  PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
>
  <DialogTitle>{editingIndex !== null ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>

<DialogContent
  sx={{
    overflowY: 'scroll',
    flex: 1,
    pr: 1,
    /* Hide scrollbar for Chrome, Safari, and Opera */
    '&::-webkit-scrollbar': {
      display: 'none'
    },
    /* Hide scrollbar for IE, Edge, and Firefox */
    '-ms-overflow-style': 'none', // IE and Edge
    'scrollbar-width': 'none'     // Firefox
  }}
>
    <Box display="flex" flexDirection="column" gap={2}>
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
        <Select
          name="vendor_type"
          value={form.vendor_type || ''}
          onChange={handleChange}
        >
          {vendorTypeOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
          ))}
        </Select>
        {formErrors.vendor_type && (
          <Typography variant="caption" color="error">{formErrors.vendor_type}</Typography>
        )}
      </FormControl>

      <TextField name="pan_number" label="PAN Number" value={form.pan_number || ''} onChange={handleChange} fullWidth
        error={!!formErrors.pan_number} helperText={formErrors.pan_number} />
      <TextField name="gst_number" label="GST Number" value={form.gst_number || ''} onChange={handleChange} fullWidth
        error={!!formErrors.gst_number} helperText={formErrors.gst_number} />
      <TextField name="contact_person" label="Contact Person" value={form.contact_person || ''} onChange={handleChange} fullWidth
        error={!!formErrors.contact_person} helperText={formErrors.contact_person} />
      <TextField name="email" label="Email Address" value={form.email || ''} onChange={handleChange} fullWidth
        error={!!formErrors.email} helperText={formErrors.email} />
      <TextField name="phone_number" label="Phone Number" value={form.phone_number || ''} onChange={handleChange} fullWidth
        error={!!formErrors.phone_number} helperText={formErrors.phone_number} />
      <TextField name="bank_name" label="Bank Name" value={form.bank_name || ''} onChange={handleChange} fullWidth
        error={!!formErrors.bank_name} helperText={formErrors.bank_name} />
      <TextField name="bank_account" label="Bank Account No." value={form.bank_account || ''} onChange={handleChange} fullWidth
        error={!!formErrors.bank_account} helperText={formErrors.bank_account} />
      <TextField name="ifsc_code" label="IFSC Code" value={form.ifsc_code || ''} onChange={handleChange} fullWidth
        error={!!formErrors.ifsc_code} helperText={formErrors.ifsc_code} />
      <TextField name="address" label="Address" value={form.address || ''} onChange={handleChange} fullWidth
        error={!!formErrors.address} helperText={formErrors.address} />
      <TextField name="notes" label="Notes" value={form.notes || ''} onChange={handleChange} fullWidth />

      <FormControl fullWidth error={!!formErrors.company_id}>
        <InputLabel>Company</InputLabel>
        <Select
          name="company_id"
          value={form.company_id || ''}
          onChange={handleChange}
        >
          {companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
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
    <Button onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="contained" onClick={handleSubmit}>Save</Button>
  </DialogActions>
</Dialog>



      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VendorManagement;
