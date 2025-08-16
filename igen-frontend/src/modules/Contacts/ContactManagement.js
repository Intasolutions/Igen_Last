// Enhanced ContactManagement.js with validations and unit test stubs

import React, { useState, useEffect, useMemo } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Card, CardContent, Typography, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Tooltip, Snackbar, Alert, Slide, Select, MenuItem, InputLabel, FormControl,
  Checkbox, ListItemText, OutlinedInput, ListSubheader,Switch,Radio,RadioGroup,FormControlLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchBar from '../../components/SearchBar'; 
import TablePaginationComponent from '../../components/TablePaginationComponent';
import ConfirmDialog from '../../components/ConfirmDialog';



import gsap from 'gsap';
import { useRef } from 'react';





const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const stakeholderOptions = [
  'Landlord', 'Tenant', 'Vendor', 'Buyer', 'Seller', 'Broker', 'Key Holder', 'Project Stakeholder', 'Other'
];

const defaultForm = {
  full_name: '',
  type: 'Individual',
  stakeholder_types: [],
  phone: '',
  alternate_phone: '',
  email: '',
  address: '',
  pan: '',
  gst: '',
  notes: '',
  linked_properties: [],
  is_active: true   
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{10}$/;

export default function ContactManagement() {
  const [contacts, setContacts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedStakeholder, setSelectedStakeholder] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [properties, setProperties] = useState([]);
  const [errors, setErrors] = useState({});
  const [stakeholderSearch, setStakeholderSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({
      title: '',
      content: '',
      onConfirm: null
    });
    const [linkedProperties, setLinkedProperties] = useState([]);




  useEffect(() => {
    fetchContacts();
    fetchProperties();
  }, []);


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\d{10}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const StatusToggle = ({ contact, onToggle }) => {
  const toggleRef = useRef(null);

  const handleChange = async () => {
    const newStatus = !contact.is_active;
    onToggle(contact, newStatus, toggleRef);

    // GSAP animation
    gsap.timeline()
      .to(toggleRef.current, {
        scale: 0.85,
        boxShadow: `0px 0px 12px ${newStatus ? '#4caf50' : '#ff9800'}`,
        duration: 0.15,
        ease: "power1.inOut"
      })
      .to(toggleRef.current, {
        scale: 1,
        boxShadow: '0px 0px 0px transparent',
        duration: 0.25,
        ease: "elastic.out(1, 0.5)"
      });

    await onToggle(contact, newStatus);
  };

  return (
    <Tooltip title={contact.is_active ? "Click to mark Inactive" : "Click to mark Active"}>
      <div ref={toggleRef} style={{ display: 'flex' }}>
        <Switch
          checked={contact.is_active}
          onChange={handleChange}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': {
              color: '#4caf50',
              '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.08)' }
            },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
              backgroundColor: '#4caf50'
            },
            '& .MuiSwitch-switchBase': {
              color: '#ff9800',
              '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.08)' }
            },
            '& .MuiSwitch-track': {
              backgroundColor: '#ffb74d'
            }
          }}
        />
      </div>
    </Tooltip>
  );
};

const validateForm = () => {
  const newErrors = {};

  if (!form.full_name) newErrors.full_name = 'Full name is required';

  if (!form.phone) newErrors.phone = 'Phone number is required';
  else if (!phoneRegex.test(form.phone)) newErrors.phone = 'Phone must be 10 digits';

  if (form.email && !emailRegex.test(form.email)) {
    newErrors.email = 'Invalid email format';
  }

  if (form.stakeholder_types.length === 0) {
    newErrors.stakeholder_types = 'At least one stakeholder type is required';
  }

  if (form.pan && !panRegex.test(form.pan.toUpperCase())) {
    newErrors.pan = 'Invalid PAN format (ABCDE1234F)';
  }

  if (form.type === 'Company') {
    if (!form.gst) {
      newErrors.gst = 'GST number is required for companies';
    } else if (!gstRegex.test(form.gst.toUpperCase())) {
      newErrors.gst = 'Invalid GST format (22ABCDE1234F1Z5)';
    }
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};


  const fetchContacts = async () => {
    try {
      const params = {};
      if (selectedStakeholder) params.stakeholder_types = selectedStakeholder;
      const res = await API.get('contacts/', { params });
      setContacts(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch (err) {
      showSnackbar('Error fetching contacts', 'error');
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await API.get('properties/');
      setProperties(res.data);
    } catch (err) {
      showSnackbar('Failed to load properties', 'error');
    }
  };

const handleAddOrUpdate = async () => {
  if (!validateForm()) {
    console.log('Client validation failed', errors);
    return;
  }

  // Extract IDs only
  const linkedIds = (form.linked_properties || []).map(p => p.id || p);

  const payload = {
    ...form,
    linked_property_ids: linkedIds
  };
  delete payload.linked_properties; // prevent sending objects to backend

  try {
    if (editingId) {
      await API.put(`contacts/${editingId}/`, payload);
      showSnackbar('Contact updated');
    } else {
      await API.post('contacts/', payload);
      showSnackbar('Contact added');
    }
    fetchContacts();
    setOpen(false);
    resetForm();
  } catch (err) {
    if (err.response) {
      console.error('Server error data:', err.response.data);
      alert(JSON.stringify(err.response.data, null, 2));
    }
    showSnackbar('Save failed', 'error');
  }
};


  const resetForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };



  const handleExport = () => {
    const headers = ['Full Name', 'Phone', 'Email', 'Address', 'Notes'];
    const rows = contacts.map(c => [c.full_name, c.phone, c.email, c.address, c.notes]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'contacts.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async () => {
    if (!csvFile) return showSnackbar('Select a CSV file first', 'warning');
    const formData = new FormData();
    formData.append('file', csvFile);
    try {
      await API.post('contacts/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSnackbar('Bulk upload successful');
      fetchContacts();
    } catch (err) {
      showSnackbar('Bulk upload failed', 'error');
    }
  };

const filteredContacts = useMemo(() => {
  return contacts.filter(c => {
    const matchesSearch =
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase());

    const matchesStakeholder = selectedStakeholder
      ? c.stakeholder_types?.includes(selectedStakeholder)
      : true;

    return matchesSearch && matchesStakeholder;
  });
}, [search, contacts, selectedStakeholder]);

// Slice for pagination
const paginatedContacts = useMemo(() => {
  if (rowsPerPage === -1) return filteredContacts; // Show all
  const start = page * rowsPerPage;
  return filteredContacts.slice(start, start + rowsPerPage);
}, [filteredContacts, page, rowsPerPage]);

const handleToggleStatus = (contact, newStatus) => {
  setConfirmData({
    title: 'Change Contact Status',
    content: `Are you sure you want to mark this contact as ${newStatus ? 'ACTIVE' : 'INACTIVE'}?`,
    onConfirm: async () => {
      try {
        await API.patch(`contacts/${contact.contact_id}/`, { is_active: newStatus });
        showSnackbar(`Contact marked as ${newStatus ? 'ACTIVE' : 'INACTIVE'}`);
        fetchContacts();
      } catch (err) {
        showSnackbar('Status update failed', 'error');
      } finally {
        setConfirmOpen(false);
      }
    }
  });
  setConfirmOpen(true);
};


  return (


    
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight={600}>Contact Management</Typography>

      <div className="flex justify-between items-center my-6 gap-4 flex-wrap">
       <SearchBar
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  label="Search by Name or Email"
  placeholder="Search contacts..."
/>

       
        <div className="flex gap-2">
          {/* <Button variant="contained" startIcon={<UploadFileIcon />} component="label">
            Upload CSV
            <input type="file" hidden accept=".csv" onChange={(e) => setCsvFile(e.target.files[0])} />
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>Export</Button> */}
          
       <FormControl size="small" style={{ minWidth: 240 }} variant="outlined">
  <InputLabel>Stakeholder Filter</InputLabel>
  <Select
    value={selectedStakeholder}
    onChange={(e) => {
      setSelectedStakeholder(e.target.value);
      setStakeholderSearch('');
    }}
    displayEmpty
    input={<OutlinedInput label="Stakeholder Filter" />}
    renderValue={(selected) => selected || 'All'}
    MenuProps={{ PaperProps: { style: { maxHeight: 300 } } }}
  >
    <ListSubheader>
      <TextField
        size="small"
        placeholder="Search..."
        fullWidth
        value={stakeholderSearch}
        onChange={(e) => setStakeholderSearch(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />
    </ListSubheader>

    <MenuItem value="">All</MenuItem>
    {stakeholderOptions
      .filter((option) =>
        option.toLowerCase().includes(stakeholderSearch.toLowerCase())
      )
      .map((type) => (
        <MenuItem key={type} value={type}>
          {type}
        </MenuItem>
      ))}
  </Select>
</FormControl>

          <Button variant="contained" onClick={() => { setOpen(true); resetForm(); }}>Add Contact</Button>
        </div>
      </div>

      <Card sx={{ boxShadow: 4, borderRadius: 3 }}>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow  >
                  <TableCell>#</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Stakeholder Type(s)</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Alternate</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>PAN</TableCell>
                  <TableCell>GST</TableCell>
                  <TableCell>Notes</TableCell>
                  <TableCell>Linked Properties</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
            {paginatedContacts.map((c, index) => (
                  <TableRow key={c.contact_id} 
  hover
  sx={{
    backgroundColor: c.is_active ? '#e8f5e9' : '#fffde7', 
    transition: 'background-color 0.3s ease',
  }}>
                  <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{c.full_name}</TableCell>
                    <TableCell>{c.type}</TableCell>
                    <TableCell>{(c.stakeholder_types || []).join(', ')}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.alternate_phone}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.address}</TableCell>
                    <TableCell>{c.pan}</TableCell>
                    <TableCell>{c.gst}</TableCell>
                    <TableCell>{c.notes}</TableCell>
                    <TableCell>
                      {(c.linked_properties || []).map(p => typeof p === 'object' ? p.name : (properties.find(x => x.id === p)?.name || p)).join(', ')}
                    </TableCell>
<TableCell align="center">

    {/* Edit button (left) */}
    <Tooltip title="Edit">
      <IconButton onClick={() => { 
        setForm(c); 
        setEditingId(c.contact_id); 
        setOpen(true); 
      }}>
        <EditIcon color="primary" />
      </IconButton>
    </Tooltip>

  

</TableCell>


                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
        <TablePaginationComponent
  count={filteredContacts.length}
  page={page}
  rowsPerPage={rowsPerPage}
  onPageChange={(e, newPage) => setPage(newPage)}
  onRowsPerPageChange={(e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0); // reset to first page
  }}
/>

      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth TransitionComponent={Transition}   PaperProps={{ sx: { borderRadius: 3, p: 2 } }}>
        <DialogTitle>{editingId ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
        <DialogContent style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <TextField label="Full Name" fullWidth margin="normal" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}   error={!!errors.full_name}
  helperText={errors.full_name}  />
          <FormControl fullWidth margin="normal">
            <InputLabel>Type</InputLabel>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} label="Type">
              <MenuItem value="Individual">Individual</MenuItem>
              <MenuItem value="Company">Company</MenuItem>
            </Select>
          </FormControl>
        <FormControl
  fullWidth
  margin="normal"
  error={!!errors.stakeholder_types}
>
  <InputLabel>Stakeholder Type(s)</InputLabel>
  <Select
    multiple
    value={form.stakeholder_types}
    onChange={(e) => setForm({ ...form, stakeholder_types: e.target.value })}
    input={<OutlinedInput label="Stakeholder Type(s)" />}
    renderValue={(selected) => selected.join(', ')}
  >
    {stakeholderOptions.map(option => (
      <MenuItem key={option} value={option}>
        <Checkbox checked={form.stakeholder_types.includes(option)} />
        <ListItemText primary={option} />
      </MenuItem>
    ))}
  </Select>
  {errors.stakeholder_types && (
    <Typography variant="caption" color="error" sx={{ ml: 2 }}>
      {errors.stakeholder_types}
    </Typography>
  )}
</FormControl>

          <TextField label="Phone" fullWidth margin="normal" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}   error={!!errors.phone}
  helperText={errors.phone} />
          <TextField label="Alternate Phone" fullWidth margin="normal" value={form.alternate_phone} onChange={(e) => setForm({ ...form, alternate_phone: e.target.value })} />
          <TextField label="Email" fullWidth margin="normal" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}  error={!!errors.email}
  helperText={errors.email} />
          <TextField label="Address" fullWidth margin="normal" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
         <TextField
  label="PAN"
  fullWidth
  margin="normal"
  value={form.pan}
  onChange={(e) => {
    setForm({ ...form, pan: e.target.value.toUpperCase() });
    if (errors.pan) setErrors(prev => ({ ...prev, pan: null }));
  }}
  error={!!errors.pan}
  helperText={errors.pan}
/>

        {form.type === 'Company' && (
  <TextField
    label="GST"
    fullWidth
    margin="normal"
    value={form.gst}
    onChange={(e) => {
      setForm({ ...form, gst: e.target.value.toUpperCase() });
      if (errors.gst) setErrors(prev => ({ ...prev, gst: null }));
    }}
    error={!!errors.gst}
    helperText={errors.gst}
/>
)}

          <TextField label="Notes" fullWidth multiline rows={2} margin="normal" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Linked Properties</InputLabel>
          <Select
  multiple
  value={form.linked_properties}
  onChange={(e) => setForm({ ...form, linked_properties: e.target.value })}
  renderValue={(selected) =>
    selected.map(p => p.name).join(', ')
  }
>
  {properties.map((prop) => (
    <MenuItem key={prop.id} value={prop}>
      {prop.name}
    </MenuItem>
  ))}
</Select>

          </FormControl>
<FormControl fullWidth margin="normal">
  <Typography variant="subtitle2" sx={{ mb: 1 }}>
    Status
  </Typography>
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

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}   sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': {
                backgroundColor: '#f1f5f9',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddOrUpdate}  sx={{
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
            }}>{editingId ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

<ConfirmDialog
  open={confirmOpen}
  title={confirmData.title}
  content={confirmData.content}
  onClose={() => setConfirmOpen(false)}
  onConfirm={confirmData.onConfirm}
/>


    </div>



  );
}
