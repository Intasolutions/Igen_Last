import React, { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, MenuItem, Snackbar, Alert,
  TextField, Typography, IconButton, Tooltip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Stepper, Step, StepLabel,
  Collapse, Grid, Link, TablePagination, Slide, Radio, RadioGroup,
  FormControlLabel, FormControl, FormLabel, CircularProgress
} from '@mui/material';
import { Edit, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Integrated FileUploader component
const FileUploader = ({ mode, onFilesChange, onUpload, uploading, selectedFiles, setSelectedFiles }) => {
  const onDrop = (acceptedFiles) => {
    const valid = acceptedFiles.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} exceeds 5MB limit`);
        return false;
      }
      return true;
    });

    if (valid.length === 0) return;

    const updatedFiles = [
      ...selectedFiles,
      ...valid.map(file => ({ file, name: file.name }))
    ];

    setSelectedFiles(updatedFiles);

    if (mode === 'edit' && typeof onUpload === 'function') {
      onUpload(updatedFiles);
    }

    if (mode === 'add') {
      onFilesChange(updatedFiles);
    }
  };

  const handleNameChange = (index, newName) => {
    const updatedFiles = [...selectedFiles];
    updatedFiles[index] = { ...updatedFiles[index], name: newName };
    setSelectedFiles(updatedFiles);
    if (mode === 'add') {
      onFilesChange(updatedFiles);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Upload New Documents (Max 20)</Typography>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #90caf9',
          padding: 2,
          borderRadius: 2,
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
          cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
        <UploadFileIcon sx={{ fontSize: 40, color: '#90caf9' }} />
        <Typography variant="body2" sx={{ mt: 1 }}>Drag & Drop or Click to Upload</Typography>
      </Box>
      {selectedFiles?.length > 0 && (
        <Box sx={{ mt: 2 }}>
          {selectedFiles.map((fileObj, index) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <TextField
                label={`Document ${index + 1} Name`}
                value={fileObj.name}
                onChange={(e) => handleNameChange(index, e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="Enter custom document name"
              />
              <Chip
                label={fileObj.file.name}
                size="small"
              />
            </Box>
          ))}
        </Box>
      )}
      {uploading && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <CircularProgress size={20} />
          <Typography sx={{ ml: 1 }}>Uploading...</Typography>
        </Box>
      )}
    </Box>
  );
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isActive: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeStep, setActiveStep] = useState(0);
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchText, setSearchText] = useState('');
  const [uploading, setUploading] = useState(false);

  const steps = ['Property Details', 'Configuration & Financials', 'Address', 'Attachments & Key Dates'];

  const [form, setForm] = useState({
    company: '',
    name: '',
    location: '',
    purpose: 'rental',
    status: 'vacant',
    landlord: '',
    tenant: '',
    remarks: '',
    config_bhk: '',
    config_bathroom: '',
    property_type: '',
    build_up_area_sqft: '',
    land_area_cents: '',
    monthly_rent: '',
    lease_start_date: '',
    lease_end_date: '',
    next_inspection_date: '',
    expected_sale_price: '',
    igen_service_charge: '',
    address_line1: '',
    address_line2: '',
    city: '',
    pincode: '',
    state: 'Kerala',
    country: 'India',
    key_date_label: '',
    key_date_due: '',
    key_date_remarks: '',
    is_active: true
  });

  const fetchData = async () => {
    try {
      const [propRes, compRes, contactRes] = await Promise.all([
        API.get('properties/'),
        API.get('companies/'),
        API.get('contacts/')
      ]);
      const propertyList = Array.isArray(propRes.data) ? propRes.data : propRes.data.results || [];
      setProperties(Array.isArray(propertyList) ? propertyList : []);
      setCompanies(compRes.data);
      setContacts(contactRes.data);
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch data', severity: 'error' });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validateForm = () => {
    const requiredFields = ['company', 'name', 'location', 'purpose', 'status', 'landlord'];
    for (const field of requiredFields) {
      if (!form[field] || form[field].toString().trim() === '') {
        setSnackbar({ open: true, message: `Please enter a valid ${field.replace('_', ' ')}`, severity: 'warning' });
        return false;
      }
    }
    if (form.status === 'occupied' && (form.purpose === 'care' || form.purpose === 'rental') && !form.tenant) {
      setSnackbar({ open: true, message: 'Tenant is required when status is Occupied', severity: 'warning' });
      return false;
    }
    if (form.status === 'tenant occupied' && form.purpose === 'sale' && !form.tenant) {
      setSnackbar({ open: true, message: 'Tenant is required when status is Tenant Occupied', severity: 'warning' });
      return false;
    }
    if (form.pincode && !/^[0-9]{6}$/.test(form.pincode)) {
      setSnackbar({ open: true, message: 'Pincode must be a 6-digit number', severity: 'warning' });
      return false;
    }
    if (documents.length > 20) {
      setSnackbar({ open: true, message: 'Cannot upload more than 20 documents', severity: 'warning' });
      return false;
    }
    for (const doc of documents) {
      if (!doc.name || doc.name.trim() === '') {
        setSnackbar({ open: true, message: 'All documents must have a valid name', severity: 'warning' });
        return false;
      }
    }
    return true;
  };

  const handleAddOrUpdateProperty = async () => {
    if (!validateForm()) return;

    setUploading(true);
    const formData = new FormData();
    Object.entries(form).forEach(([key, val]) => {
      if (val !== null && val !== undefined && val !== '') formData.append(key, val);
    });
    formData.append('is_active', form.is_active);

    try {
      let response;
      if (isEditMode && editId) {
        response = await API.put(`properties/${editId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        response = await API.post('properties/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      const propertyId = response.data.id;

      if (documents.length > 0) {
        for (let doc of documents) {
          const docData = new FormData();
          docData.append('property', propertyId);
          docData.append('file_name', doc.name);
          docData.append('file_url', doc.file);
          await API.post('property-documents/', docData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      if (form.key_date_label && form.key_date_due) {
        await API.post('property-key-dates/', {
          property: propertyId,
          date_label: form.key_date_label,
          due_date: form.key_date_due,
          remarks: form.key_date_remarks,
        });
      }

      setSnackbar({ open: true, message: isEditMode ? 'Property updated successfully' : 'Property added successfully', severity: 'success' });
      setOpen(false);
      fetchData();
      resetForm();
    } catch {
      setSnackbar({ open: true, message: 'Failed to save property', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setForm({
      company: '',
      name: '',
      location: '',
      purpose: 'rental',
      status: 'vacant',
      landlord: '',
      tenant: '',
      remarks: '',
      config_bhk: '',
      config_bathroom: '',
      property_type: '',
      build_up_area_sqft: '',
      land_area_cents: '',
      monthly_rent: '',
      lease_start_date: '',
      lease_end_date: '',
      next_inspection_date: '',
      expected_sale_price: '',
      igen_service_charge: '',
      address_line1: '',
      address_line2: '',
      city: '',
      pincode: '',
      state: 'Kerala',
      country: 'India',
      key_date_label: '',
      key_date_due: '',
      key_date_remarks: '',
      is_active: true
    });
    setDocuments([]);
    setIsEditMode(false);
    setEditId(null);
    setActiveStep(0);
  };

  const openEditDialog = (prop) => {
    setForm({
      ...form,
      ...prop,
      company: prop.company || prop.company?.id || '',
      landlord: prop.landlord?.contact_id || '',
      tenant: prop.tenant?.contact_id || '',
      purpose: prop.purpose || 'rental',
      status: prop.status || 'vacant',
      is_active: prop.is_active
    });
    setDocuments(prop.documents?.map(doc => ({ file: null, name: doc.file_name, id: doc.id })) || []);
    setEditId(prop.id);
    setIsEditMode(true);
    setOpen(true);
  };

  const handleToggleActive = (id, isActive) => {
    if (isActive) setConfirmDialog({ open: true, id, isActive });
    else proceedToggle(id, isActive);
  };

  const proceedToggle = async (id, isActive) => {
    setSnackbar({ open: true, message: isActive ? 'Deactivating...' : 'Activating...', severity: 'info' });
    try {
      await API.patch(`properties/${id}/`, { is_active: !isActive });
      fetchData();
      setSnackbar({ open: true, message: isActive ? 'Property deactivated' : 'Property activated', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Status update failed', severity: 'error' });
    } finally {
      setConfirmDialog({ open: false, id: null, isActive: false });
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'occupied':
      case 'owner occupied':
      case 'tenant occupied':
        return 'primary';
      case 'vacant':
        return 'warning';
      case 'under maintenance':
        return 'info';
      default:
        return 'default';
    }
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return form.company && form.name && form.location && form.purpose && form.status && form.landlord &&
               ((form.status === 'occupied' && (form.purpose === 'care' || form.purpose === 'rental') && form.tenant) ||
                (form.status === 'tenant occupied' && form.purpose === 'sale' && form.tenant) ||
                !['occupied', 'tenant occupied'].includes(form.status));

      case 1: {
        const { config_bhk, config_bathroom, property_type, lease_start_date, lease_end_date, next_inspection_date, purpose } = form;

        if (!config_bhk || !config_bathroom || !property_type) return false;

        if (purpose === 'rental' && lease_start_date) {
          const start = new Date(lease_start_date);
          if (lease_end_date && new Date(lease_end_date) <= start) return false;
          if (next_inspection_date && new Date(next_inspection_date) <= start) return false;
        }

        return true;
      }

      case 2:
        return true;

      case 3:
        if (documents.length > 20) return false;
        return documents.every(doc => doc.name && doc.name.trim() !== '');

      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!isStepValid()) {
      let message = 'Please complete required fields';
      if (activeStep === 0) {
        if (!form.company) message = 'Company is required';
        else if (!form.name) message = 'Property name is required';
        else if (!form.location) message = 'Location is required';
        else if (!form.purpose) message = 'Purpose is required';
        else if (!form.status) message = 'Status is required';
        else if (!form.landlord) message = 'Landlord is required';
        else if ((form.status === 'occupied' && (form.purpose === 'care' || form.purpose === 'rental') && !form.tenant) ||
                 (form.status === 'tenant occupied' && form.purpose === 'sale' && !form.tenant)) {
          message = 'Tenant is required for this status';
        }
      } else if (activeStep === 1 && form.purpose === 'rental') {
        if (form.lease_start_date && form.lease_end_date && new Date(form.lease_end_date) <= new Date(form.lease_start_date)) {
          message = 'Lease End Date must be after Lease Start Date';
        } else if (form.lease_start_date && form.next_inspection_date && new Date(form.next_inspection_date) <= new Date(form.lease_start_date)) {
          message = 'Next Inspection Date must be after Lease Start Date';
        }
      } else if (activeStep === 3) {
        if (documents.length > 20) {
          message = 'Cannot upload more than 20 documents';
        } else if (documents.some(doc => !doc.name || doc.name.trim() === '')) {
          message = 'All documents must have a valid name';
        }
      }
      setSnackbar({ open: true, message, severity: 'warning' });
      return;
    }

    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleAddOrUpdateProperty();
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleFilesChange = (updatedFiles) => {
    setDocuments(updatedFiles);
  };

  const handleUpload = async (files) => {
    if (!editId) return;
    setUploading(true);
    try {
      for (let doc of files) {
        const docData = new FormData();
        docData.append('property', editId);
        docData.append('file_name', doc.name);
        docData.append('file_url', doc.file);
        await API.post('property-documents/', docData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      setSnackbar({ open: true, message: 'Documents uploaded successfully', severity: 'success' });
      fetchData();
    } catch {
      setSnackbar({ open: true, message: 'Failed to upload documents', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const renderStepContent = (step) => {
    const statusOptions = {
      care: ['occupied', 'vacant', 'under maintenance'],
      rental: ['occupied', 'vacant', 'under maintenance'],
      sale: ['owner occupied', 'tenant occupied', 'vacant', 'under maintenance']
    };

    switch (step) {
      case 0:
        return (
          <Box p={2}>
            <TextField
              select
              fullWidth
              label="Company *"
              margin="dense"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            >
              <MenuItem value="">Select a company</MenuItem>
              {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField
              label="Property Name *"
              fullWidth
              margin="dense"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Location *"
              fullWidth
              margin="dense"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <TextField
              select
              fullWidth
              label="Landlord *"
              margin="dense"
              value={form.landlord}
              onChange={(e) => setForm({ ...form, landlord: e.target.value })}
            >
              <MenuItem value="">Select Landlord</MenuItem>
              {contacts.map(c => (
                <MenuItem key={c.contact_id} value={c.contact_id}>
                  {c.full_name || c.email || `Contact ${c.contact_id}`}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              label="Purpose *"
              margin="dense"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value, status: '', tenant: '' })}
            >
              <MenuItem value="rental">Rental</MenuItem>
              <MenuItem value="sale">Sale</MenuItem>
              <MenuItem value="care">Care</MenuItem>
            </TextField>
            <TextField
              select
              fullWidth
              label="Status *"
              margin="dense"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value, tenant: '' })}
            >
              <MenuItem value="">Select Status</MenuItem>
              {statusOptions[form.purpose].map(s => (
                <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
              ))}
            </TextField>
            {(form.status === 'occupied' && (form.purpose === 'care' || form.purpose === 'rental') ||
              form.status === 'tenant occupied' && form.purpose === 'sale') && (
              <TextField
                select
                fullWidth
                label="Tenant *"
                margin="dense"
                value={form.tenant}
                onChange={(e) => setForm({ ...form, tenant: e.target.value })}
              >
                <MenuItem value="">Select Tenant</MenuItem>
                {contacts.map(c => (
                  <MenuItem key={c.contact_id} value={c.contact_id}>
                    {c.full_name || c.email || `Contact ${c.contact_id}`}
                  </MenuItem>
                ))}
              </TextField>
            )}
<FormControl component="fieldset" sx={{ mt: 2 }}>
  <FormLabel component="legend">Property Status</FormLabel>
  <RadioGroup
    row
    value={form.is_active ? 'active' : 'inactive'}
    onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
    sx={{ gap: 2 }}
  >
    <FormControlLabel
      value="active"
      control={
        <Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} />
      }
      label="Active"
      sx={{ '& .MuiFormControlLabel-label': { color: '#424242' } }}
    />
    <FormControlLabel
      value="inactive"
      control={
        <Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} />
      }
      label="Inactive"
      sx={{ '& .MuiFormControlLabel-label': { color: '#424242' } }}
    />
  </RadioGroup>
</FormControl>

          </Box>
        );

      case 1:
        return (
          <Box p={2}>
            <TextField
              label="Bedrooms (BHK)"
              type="number"
              fullWidth
              margin="dense"
              value={form.config_bhk}
              onChange={(e) => setForm({ ...form, config_bhk: e.target.value })}
            />
            <TextField
              label="Bathrooms"
              type="number"
              fullWidth
              margin="dense"
              value={form.config_bathroom}
              onChange={(e) => setForm({ ...form, config_bathroom: e.target.value })}
            />
            <TextField
              select
              fullWidth
              label="Property Type"
              margin="dense"
              value={form.property_type}
              onChange={(e) => setForm({ ...form, property_type: e.target.value })}
            >
              <MenuItem value="">Select type</MenuItem>
              <MenuItem value="apartment">Apartment</MenuItem>
              <MenuItem value="villa">Villa</MenuItem>
              <MenuItem value="plot">Plot</MenuItem>
            </TextField>
            <TextField
              label="Built-up Area (Sq Ft)"
              type="number"
              fullWidth
              margin="dense"
              value={form.build_up_area_sqft}
              onChange={(e) => setForm({ ...form, build_up_area_sqft: e.target.value })}
            />
            <TextField
              label="Land Area (Cents)"
              type="number"
              fullWidth
              margin="dense"
              value={form.land_area_cents}
              onChange={(e) => setForm({ ...form, land_area_cents: e.target.value })}
            />
            {form.purpose === 'rental' && (
              <>
                <TextField
                  label="Monthly Rent"
                  type="number"
                  fullWidth
                  margin="dense"
                  value={form.monthly_rent}
                  onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })}
                />
                <TextField
                  type="date"
                  label="Lease Start Date"
                  fullWidth
                  margin="dense"
                  InputLabelProps={{ shrink: true }}
                  value={form.lease_start_date}
                  onChange={(e) => setForm({ ...form, lease_start_date: e.target.value })}
                />
                <TextField
                  type="date"
                  label="Lease End Date"
                  fullWidth
                  margin="dense"
                  InputLabelProps={{ shrink: true }}
                  value={form.lease_end_date}
                  onChange={(e) => setForm({ ...form, lease_end_date: e.target.value })}
                />
                <TextField
                  type="date"
                  label="Next Inspection Date"
                  fullWidth
                  margin="dense"
                  InputLabelProps={{ shrink: true }}
                  value={form.next_inspection_date}
                  onChange={(e) => setForm({ ...form, next_inspection_date: e.target.value })}
                />
              </>
            )}
            {form.purpose === 'sale' && (
              <TextField
                label="Expected Sale Price"
                type="number"
                fullWidth
                margin="dense"
                value={form.expected_sale_price}
                onChange={(e) => setForm({ ...form, expected_sale_price: e.target.value })}
              />
            )}
            <TextField
              label="iGen Service Charge"
              type="number"
              fullWidth
              margin="dense"
              value={form.igen_service_charge}
              onChange={(e) => setForm({ ...form, igen_service_charge: e.target.value })}
            />
          </Box>
        );

      case 2:
        return (
          <Box p={2}>
            <TextField
              label="Address Line 1"
              fullWidth
              margin="dense"
              value={form.address_line1}
              onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
            />
            <TextField
              label="Address Line 2"
              fullWidth
              margin="dense"
              value={form.address_line2}
              onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
            />
            <TextField
              label="City"
              fullWidth
              margin="dense"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <TextField
              label="Pincode"
              fullWidth
              margin="dense"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            />
            <TextField
              label="State"
              fullWidth
              margin="dense"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
            <TextField
              label="Country"
              fullWidth
              margin="dense"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </Box>
        );

      case 3:
        return (
          <Box p={2}>
            <TextField
              label="Remarks"
              fullWidth
              multiline
            
              margin="dense"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
            <FileUploader
              mode={isEditMode ? 'edit' : 'add'}
              onFilesChange={handleFilesChange}
              onUpload={handleUpload}
              uploading={uploading}
              selectedFiles={documents}
              setSelectedFiles={setDocuments}
            />
            <Typography sx={{ mt: 3, fontWeight: 'bold' }}>Key Dates</Typography>
            <TextField
              label="Date Label"
              fullWidth
              margin="dense"
              value={form.key_date_label}
              onChange={(e) => setForm({ ...form, key_date_label: e.target.value })}
            />
            <TextField
              type="date"
              label="Due Date"
              fullWidth
              margin="dense"
              InputLabelProps={{ shrink: true }}
              value={form.key_date_due}
              onChange={(e) => setForm({ ...form, key_date_due: e.target.value })}
            />
            <TextField
              label="Remarks"
              fullWidth
              margin="dense"
              value={form.key_date_remarks}
              onChange={(e) => setForm({ ...form, key_date_remarks: e.target.value })}
            />
          </Box>
        );

      default:
        return null;
    }
  };

  const filteredProperties = properties.filter((prop) =>
    prop.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const paginatedProperties = filteredProperties.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight="bold">Property Management</Typography>
      <div className="flex justify-between items-center mt-6 mb-6 flex-wrap gap-4">
        <div className="flex-1 max-w-sm">
          <TextField
            label="Search by Name"
            variant="outlined"
            size="small"
            fullWidth
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Type property name..."
            InputProps={{
              startAdornment: (
                <span className="material-icons text-gray-500 mr-2">search</span>
              ),
              sx: {
                borderRadius: 3,
                backgroundColor: '#fafafa',
              }
            }}
          />
        </div>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            resetForm();
            setOpen(true);
            setIsEditMode(false);
          }}
        >
          ADD PROPERTY
        </Button>
      </div>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell><strong>#</strong></TableCell>
                  <TableCell><strong>Company</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Location</strong></TableCell>
                  <TableCell><strong>Type</strong></TableCell>
                  <TableCell><strong>Area</strong></TableCell>
                  <TableCell><strong>Rent/Sale</strong></TableCell>
                  <TableCell><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedProperties.map((prop, index) => (
                  <React.Fragment key={prop.id}>
                    <TableRow
                      sx={{ backgroundColor: prop.is_active ? '#e8f5e9' : '#fffde7' }}
                    >
                      <TableCell>
                        <IconButton size="small" onClick={() => setExpandedRow(expandedRow === prop.id ? null : prop.id)}>
                          {expandedRow === prop.id ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                        </IconButton>
                        {page * rowsPerPage + index + 1}
                      </TableCell>
                      <TableCell>{prop.company_name}</TableCell>
                      <TableCell>{prop.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={prop.status}
                          color={getStatusColor(prop.status)}
                          size="small"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>{prop.location}</TableCell>
                      <TableCell>{prop.property_type}</TableCell>
                      <TableCell>{prop.build_up_area_sqft} sqft</TableCell>
                      <TableCell>{prop.purpose === 'rental' ? prop.monthly_rent : prop.expected_sale_price}</TableCell>
                      <TableCell>
                        <Tooltip title="Edit">
                          <IconButton color="primary" onClick={() => openEditDialog(prop)}>
                            <Edit />
                          </IconButton>
                        </Tooltip>
                       
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ backgroundColor: '#e0e5e757' }}>
                      <TableCell colSpan={9} sx={{ p: 0, border: 0 }}>
                        <Collapse in={expandedRow === prop.id} timeout="auto" unmountOnExit>
                          <Box margin={2}>
                            <Typography variant="subtitle2" fontWeight="bold" mb={2} gutterBottom>
                              Property Details
                            </Typography>
                            <Table size="small" sx={{ mb: 2 }}>
                              <TableBody>
                                <TableRow>
                                  <TableCell><strong>Landlord:</strong></TableCell>
                                  <TableCell>{prop.landlord?.full_name || prop.landlord?.email || '-'}</TableCell>
                                  <TableCell><strong>Tenant:</strong></TableCell>
                                  <TableCell>{prop.tenant?.full_name || prop.tenant?.email || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell><strong>Lease Start:</strong></TableCell>
                                  <TableCell>{prop.lease_start_date || '-'}</TableCell>
                                  <TableCell><strong>Lease End:</strong></TableCell>
                                  <TableCell>{prop.lease_end_date || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell><strong>Next Inspection:</strong></TableCell>
                                  <TableCell>{prop.next_inspection_date || '-'}</TableCell>
                                  <TableCell><strong>Land Area (Cents):</strong></TableCell>
                                  <TableCell>{prop.land_area_cents}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell><strong>Service Charge:</strong></TableCell>
                                  <TableCell>{prop.igen_service_charge}</TableCell>
                                  <TableCell><strong>Status:</strong></TableCell>
                                  <TableCell>{prop.status || '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell><strong>Address:</strong></TableCell>
                                  <TableCell colSpan={3}>
                                    {`${prop.address_line1 || ''}, ${prop.address_line2 || ''}, ${prop.city || ''}, ${prop.state || ''} - ${prop.pincode || ''}, ${prop.country || ''}`}
                                  </TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell><strong>Remarks:</strong></TableCell>
                                  <TableCell colSpan={3}>{prop.remarks || 'None'}</TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell><strong>Key Date:</strong></TableCell>
                                  <TableCell>{prop.key_date_label || '-'} - {prop.key_date_due || '-'}</TableCell>
                                  <TableCell><strong>Key Remarks:</strong></TableCell>
                                  <TableCell>{prop.key_date_remarks || '-'}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                            <Box>
                              <Typography sx={{ fontWeight: 'bold', mb: 1 }}>Document Preview</Typography>
                              {Array.isArray(prop.document_urls) && prop.document_urls.length > 0 ? (
                                <Grid container spacing={2}>
                                  {prop.document_urls.map((doc, index) => {
                                    const fullUrl = doc.file_url?.startsWith('http') ? doc.file_url : `http://localhost:8000${doc.file_url}`;
                                    const isPDF = fullUrl.toLowerCase().endsWith('.pdf');
                                    if (!doc.file_url) return null;

                                    return (
                                      <Grid item xs={6} sm={4} md={3} key={index}>
                                        <Box
                                          sx={{
                                            border: '1px solid #ddd',
                                            borderRadius: 2,
                                            p: 1,
                                            boxShadow: 1,
                                            backgroundColor: '#fafafa',
                                            textAlign: 'center',
                                            transition: 'transform 0.2s',
                                            '&:hover': { transform: 'scale(1.03)', boxShadow: 3 }
                                          }}
                                        >
                                          <Typography variant="body2" sx={{ mb: 1 }}>{doc.file_name}</Typography>
                                          {isPDF ? (
                                            <Box
                                              sx={{
                                                height: 60,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: '#f5f5f5',
                                                borderRadius: 6,
                                                fontWeight: 'bold',
                                                color: '#1976d2',
                                                fontSize: 14
                                              }}
                                            >
                                              PDF Document
                                            </Box>
                                          ) : (
                                            <img
                                              src={fullUrl}
                                              alt={`Document ${index + 1}`}
                                              style={{
                                                width: '100%',
                                                height: 60,
                                                objectFit: 'cover',
                                                borderRadius: 6
                                              }}
                                              onError={(e) => {
                                                e.target.style.display = 'none';
                                              }}
                                            />
                                          )}
                                          <Link
                                            href={fullUrl}
                                            target="_blank"
                                            rel="noopener"
                                            underline="hover"
                                            sx={{ display: 'block', mt: 1, fontSize: 13 }}
                                          >
                                            View / Download
                                          </Link>
                                        </Box>
                                      </Grid>
                                    );
                                  })}
                                </Grid>
                              ) : (
                                <Typography sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                                  No documents available
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredProperties.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionComponent={Transition}
        keepMounted
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>{isEditMode ? 'Edit Property' : 'Add Property'}</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  StepIconProps={{
                    sx: {
                      color: activeStep === index ? '#00b16a' : 'rgba(0, 0, 0, 0.38)'
                    }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
          {renderStepContent(activeStep)}
        </DialogContent>
        <DialogActions>
          {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}
          <Button variant="contained" onClick={handleNext} disabled={!isStepValid() || uploading}>
            {activeStep === steps.length - 1 ? (isEditMode ? 'Update' : 'Save') : 'Next'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}>
        <DialogTitle>Confirm Deactivation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to deactivate this property?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>Cancel</Button>
          <Button
            onClick={() => proceedToggle(confirmDialog.id, confirmDialog.isActive)}
            color="error"
            variant="contained"
          >
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'end' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}