import React, { useState, useEffect } from 'react';
import {
  Button, Table, TableBody, TableCell, TableHead, TableRow, Typography, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Grid, MenuItem,
  Snackbar, Alert, Card, CardContent, Chip, TablePagination, Stack, Stepper, Step, StepLabel, Box, Slide, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchBar from '../../components/SearchBar';
import API from '../../api/axios';
import FileUploader from '../../components/FileUploader';
import ConfirmDialog from '../../components/ConfirmDialog';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function AssetManagement() {
  const [assets, setAssets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const response = await API.get('assets/');
      setAssets(response.data);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      setSnackbar({ open: true, message: 'Failed to fetch assets', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddSuccess = () => {
    setOpen(false);
    setEditAsset(null);
    fetchAssets();
  };

  const handleEdit = (asset) => {
    setEditAsset(asset);
    setOpen(true);
  };

  const confirmDeactivateAsset = async () => {
    try {
      await API.patch(`assets/${selectedAssetId}/`, { is_active: false });
      setSnackbar({ open: true, message: 'Asset deactivated', severity: 'success' });
      fetchAssets();
    } catch (error) {
      console.error('Failed to deactivate asset:', error);
      setSnackbar({ open: true, message: 'Failed to deactivate asset', severity: 'error' });
    } finally {
      setConfirmOpen(false);
      setSelectedAssetId(null);
    }
  };

  const promptDeactivateAsset = (id) => {
    setSelectedAssetId(id);
    setConfirmOpen(true);
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Asset Management
      </Typography>

      <Box marginTop={3} display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <SearchBar
          label="Search by Name"
          placeholder="search Type asset name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setEditAsset(null);
              setOpen(true);
            }}
          >
            Add Asset
          </Button>
        </Stack>
      </Box>

      <AddAssetDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setEditAsset(null);
        }}
        onSuccess={handleAddSuccess}
        initialData={editAsset}
        setSnackbar={setSnackbar}
        assets={assets}
      />

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                {['#', 'Name', 'Tag ID', 'Company', 'Property', 'Project', 'Purchase Date', 'Warranty Expiry', 'Location', 'Documents', 'Service Dues', 'Actions'].map((header, index) => (
                  <TableCell key={index}>{header}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAssets.length > 0 ? (
                filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((asset, index) => (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{ backgroundColor: asset.is_active === false ? '#fff9c4' : '#e8f5e9', transition: 'background-color 0.2s' }}
                  >
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{asset.tag_id || 'N/A'}</TableCell>
                    <TableCell>{asset.company_name || 'N/A'}</TableCell>
                    <TableCell>{asset.property_name || '-'}</TableCell>
                    <TableCell>{asset.project_name || '-'}</TableCell>
                    <TableCell>{asset.purchase_date || '-'}</TableCell>
                    <TableCell>{asset.warranty_expiry || '-'}</TableCell>
                    <TableCell>{asset.location || '-'}</TableCell>
                    <TableCell>
                      {asset.documents?.length > 0 ? (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {asset.documents.map((doc, i) => {
                            const fileUrl = `${process.env.REACT_APP_API_BASE_URL}${doc.document}`;
                            const fileName = fileUrl.split('/').pop();
                            const ext = fileName?.split('.').pop().toLowerCase();

                            const getIcon = () => {
                              if (ext === 'pdf') return <PictureAsPdfIcon fontSize="small" color="error" />;
                              if (['doc', 'docx'].includes(ext)) return <DescriptionIcon fontSize="small" color="primary" />;
                              return <InsertDriveFileIcon fontSize="small" />;
                            };

                            return (
                              <Tooltip title={fileName} key={i}>
                                <Chip
                                  icon={getIcon()}
                                  label={fileName}
                                  component="a"
                                  href={fileUrl}
                                  target="_blank"
                                  clickable
                                  size="small"
                                  sx={{
                                    mb: 0.5,
                                    maxWidth: 140,
                                    textOverflow: 'ellipsis',
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap'
                                  }}
                                />
                              </Tooltip>
                            );
                          })}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">No Docs</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {asset.service_dues?.length > 0 ? (
                        asset.service_dues.map((due, i) => (
                          <Typography key={i} variant="caption" display="block" sx={{ color: '#444' }}>
                            {due.due_date} — {due.description}
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">No Dues</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton onClick={() => handleEdit(asset)} color="primary">
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={12} align="center">
                    <Typography variant="body2" color="textSecondary">No active assets found.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={filteredAssets.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
          />
        </CardContent>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
        </Snackbar>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDeactivateAsset}
        title="Deactivate Asset"
        content="Are you sure you want to deactivate this asset?"
      />
    </Box>
  );
}

function AddAssetDialog({ open, onClose, onSuccess, initialData, setSnackbar, assets }) {
  const [companies, setCompanies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState(false);

  const [formData, setFormData] = useState({
    company: '',
    linkType: 'property',
    property: '',
    project: '',
    name: '',
    category: '',
    purchase_date: '',
    purchase_price: '',
    warranty_expiry: '',
    location: '',
    maintenance_frequency: '',
    tag_id: '',
    is_active: true,
    notes: '',
    service_schedule: [{ due_date: '', description: '' }],
    files: null,
  });

  useEffect(() => {
    if (open) {
      fetchDropdownData();
      if (initialData) {
        setFormData({
          ...formData,
          ...initialData,
          company: initialData.company || '',
          property: initialData.property || '',
          project: initialData.project || '',
          linkType: initialData.property ? 'property' : initialData.project ? 'project' : 'property',
          service_schedule: initialData.service_dues || [{ due_date: '', description: '' }],
          files: null
        });
      } else {
        setFormData({
          company: '',
          linkType: 'property',
          property: '',
          project: '',
          name: '',
          category: '',
          purchase_date: '',
          purchase_price: '',
          warranty_expiry: '',
          location: '',
          maintenance_frequency: '',
          tag_id: '',
          is_active: true,
          notes: '',
          service_schedule: [{ due_date: '', description: '' }],
          files: null,
        });
      }
    }
  }, [open, initialData]);

  const fetchDropdownData = async () => {
    try {
      const [companyRes, propertyRes, projectRes] = await Promise.all([
        API.get('companies/'),
        API.get('properties/'),
        API.get('projects/')
      ]);
      setCompanies(companyRes.data || []);
      setProperties(propertyRes.data || []);
      setProjects(projectRes.data || []);
    } catch (err) {
      console.error("Dropdown fetch failed:", err);
      setSnackbar({ open: true, message: 'Failed to load dropdowns', severity: 'error' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'is_active' ? value === 'true' : value
    }));
  };

  const handleFileChange = (e) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024;

    for (let file of e.target.files) {
      if (!allowedTypes.includes(file.type)) {
        setSnackbar({ open: true, message: 'Only PDF, JPG, or PNG files are allowed.', severity: 'error' });
        return;
      }
      if (file.size > maxSize) {
        setSnackbar({ open: true, message: `File "${file.name}" exceeds 5MB limit.`, severity: 'error' });
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      files: e.target.files
    }));
  };

  const handleScheduleChange = (index, field, value) => {
    const updated = [...formData.service_schedule];
    updated[index][field] = value;
    setFormData({ ...formData, service_schedule: updated });
  };

  const addServiceDate = () => {
    setFormData({
      ...formData,
      service_schedule: [...formData.service_schedule, { due_date: '', description: '' }]
    });
  };

  const deleteServiceDate = (index) => {
    if (formData.service_schedule.length > 1) {
      const updated = formData.service_schedule.filter((_, i) => i !== index);
      setFormData({ ...formData, service_schedule: updated });
    } else {
      setSnackbar({ open: true, message: 'At least one service due entry is required.', severity: 'warning' });
    }
  };

  const handleSubmit = async () => {
    try {
      const errors = {};
      if (!formData.name) errors.name = 'Asset Name is required';
      if (!formData.company) errors.company = 'Company is required';
      if (!formData.purchase_date) errors.purchase_date = 'Purchase Date is required';
      if (!formData.property && !formData.project) errors.project_property = 'Either Property or Project is required';
      if (!initialData && assets.some(a => a.tag_id === formData.tag_id)) errors.tag_id = 'Tag ID must be unique';
      if (formData.warranty_expiry && formData.purchase_date > formData.warranty_expiry) errors.warranty_expiry = 'Warranty must be after purchase date';

      formData.service_schedule.forEach((entry, i) => {
        if ((entry.due_date && !entry.description) || (!entry.due_date && entry.description)) {
          errors[`service_${i}`] = 'Complete both fields for service due';
        }
      });

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        setTouched(true);
        return;
      }
      setFormErrors({});

      const form = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'files' || key === 'service_schedule') return;
        form.append(key, value);
      });
      form.append('service_dues', JSON.stringify(formData.service_schedule));
      if (formData.files && formData.files.length > 0) {
        for (let file of formData.files) {
          form.append('documents', file);
        }
      }

      if (initialData?.id) {
        await API.put(`assets/${initialData.id}/`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSnackbar({ open: true, message: 'Asset updated successfully', severity: 'success' });
      } else {
        await API.post('assets/', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSnackbar({ open: true, message: 'Asset created successfully', severity: 'success' });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Submit error:", err.response?.data || err.message);
      setSnackbar({ open: true, message: 'Failed to save asset', severity: 'error' });
    }
  };

  const steps = ['Basic Details', 'Service Dues', 'Documents'];
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep === 0) {
      const errors = {};
      if (!formData.name) errors.name = 'Asset Name is required';
      if (!formData.company) errors.company = 'Company is required';
      if (!formData.purchase_date) errors.purchase_date = 'Purchase Date is required';
      if (!formData.property && !formData.project) errors.project_property = 'Either Property or Project is required';
      if (!initialData && assets.some(a => a.tag_id === formData.tag_id)) errors.tag_id = 'Tag ID must be unique';
      if (formData.warranty_expiry && formData.purchase_date > formData.warranty_expiry)
        errors.warranty_expiry = 'Warranty must be after purchase date';

      setFormErrors(errors);
      setTouched(true);

      if (Object.keys(errors).length > 0) return;
    }

    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleDeleteUploadedDoc = async (docId) => {
    try {
      await API.delete(`asset-documents/${docId}/`);
      setSnackbar({ open: true, message: 'Document deleted', severity: 'success' });
      if (initialData) {
        initialData.documents = initialData.documents.filter(doc => doc.id !== docId);
        setFormData(prev => ({ ...prev }));
      }
    } catch (err) {
      console.error("Delete error:", err);
      setSnackbar({ open: true, message: 'Failed to delete document', severity: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
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
      <DialogTitle
        sx={{
          fontWeight: 'bold',
          fontSize: '1.4rem',
          mb: 1,
          color: 'primary.main'
        }}
      >
        {initialData ? 'Edit Asset' : 'Add Asset'}
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          overflowY: 'auto',
          '&::-webkit-scrollbar': { display: 'none' },
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none'
        }}
      >
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
              Basic Details
            </Typography>
            <Box
              component="form"
              noValidate
              autoComplete="off"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 2
              }}
            >
              <TextField
                select
                label="Company *"
                name="company"
                value={formData.company}
                onChange={handleChange}
                error={touched && !!formErrors.company}
                helperText={touched && formErrors.company}
              >
                <MenuItem value="">Select</MenuItem>
                {companies.map(c => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </TextField>

              <TextField
                label="Asset Name *"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={touched && !!formErrors.name}
                helperText={touched && formErrors.name}
              />

              <TextField
                label="Category"
                name="category"
                value={formData.category}
                onChange={handleChange}
              />

              <TextField
                label="Purchase Price"
                name="purchase_price"
                type="number"
                InputLabelProps={{ shrink: true }}
                value={formData.purchase_price}
                onChange={handleChange}
              />

              <TextField
                label="Purchase Date *"
                name="purchase_date"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.purchase_date}
                onChange={handleChange}
                error={touched && !!formErrors.purchase_date}
                helperText={touched && formErrors.purchase_date}
              />

              <TextField
                label="Warranty Expiry"
                name="warranty_expiry"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.warranty_expiry}
                onChange={handleChange}
                error={touched && !!formErrors.warranty_expiry}
                helperText={touched && formErrors.warranty_expiry}
              />

              <TextField
                label="Location"
                name="location"
                value={formData.location}
                onChange={handleChange}
              />

              <TextField
                label="Maintenance Frequency"
                name="maintenance_frequency"
                value={formData.maintenance_frequency}
                onChange={handleChange}
              />

              <TextField
                label="Tag ID (Barcode/RFID)"
                name="tag_id"
                value={formData.tag_id}
                onChange={handleChange}
                error={touched && !!formErrors.tag_id}
                helperText={touched && formErrors.tag_id}
              />

              <FormControl component="fieldset" margin="normal">
                <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                  Status *
                </FormLabel>
                <RadioGroup
                  row
                  name="is_active"
                  value={formData.is_active.toString()}
                  onChange={handleChange}
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

              <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main', gridColumn: '1 / -1' }}>
                Linked To
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, gridColumn: '1 / -1' }}>
                <FormControlLabel
                  control={
                    <Radio
                      checked={formData.linkType === 'property'}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          linkType: 'property',
                          property: '',
                          project: ''
                        })
                      }
                      value="property"
                    />
                  }
                  label="Property"
                />
                <FormControlLabel
                  control={
                    <Radio
                      checked={formData.linkType === 'project'}
                      onChange={() =>
                        setFormData({
                          ...formData,
                          linkType: 'project',
                          property: '',
                          project: ''
                        })
                      }
                      value="project"
                    />
                  }
                  label="Project"
                />
              </Box>

              {formData.linkType === 'property' && (
                <TextField
                  select
                  fullWidth
                  label="Select Property"
                  name="property"
                  value={formData.property}
                  onChange={handleChange}
                  error={touched && !!formErrors.project_property}
                  helperText={touched && formErrors.project_property}
                >
                  <MenuItem value="">Select</MenuItem>
                  {properties.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {formData.linkType === 'project' && (
                <TextField
                  select
                  fullWidth
                  label="Select Project"
                  name="project"
                  value={formData.project}
                  onChange={handleChange}
                  error={touched && !!formErrors.project_property}
                  helperText={touched && formErrors.project_property}
                >
                  <MenuItem value="">Select</MenuItem>
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
          </>
        )}

        {activeStep === 1 && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
              Service Due Dates
            </Typography>
            <Box sx={{ gridColumn: '1 / -1' }}>
              {formData.service_schedule.map((entry, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
                    gap: 2,
                    mb: 2,
                    alignItems: 'center'
                  }}
                >
                  <TextField
                    type="date"
                    label="Key Date"
                    InputLabelProps={{ shrink: true }}
                    value={entry.due_date}
                    onChange={(e) => handleScheduleChange(index, 'due_date', e.target.value)}
                    error={touched && !!formErrors[`service_${index}`]}
                    helperText={touched && formErrors[`service_${index}`]}
                  />
                  <TextField
                    label="Description"
                    value={entry.description}
                    onChange={(e) => handleScheduleChange(index, 'description', e.target.value)}
                    error={touched && !!formErrors[`service_${index}`]}
                    helperText={touched && formErrors[`service_${index}`]}
                  />
                  <IconButton
                    color="error"
                    onClick={() => deleteServiceDate(index)}
                    disabled={formData.service_schedule.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              <Button onClick={addServiceDate} variant="outlined">+ Add Due</Button>
            </Box>
          </>
        )}

        {activeStep === 2 && (
          <>
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
              Documents
            </Typography>
            <Box sx={{ gridColumn: '1 / -1' }}>
              {initialData?.documents?.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                  {initialData.documents.map((doc) => {
                    const fileUrl = `${process.env.REACT_APP_API_BASE_URL}${doc.document}`;
                    const fileName = fileUrl.split('/').pop();
                    return (
                      <Chip
                        key={doc.id}
                        label={fileName}
                        onDelete={() => handleDeleteUploadedDoc(doc.id)}
                        icon={<InsertDriveFileIcon />}
                        variant="outlined"
                        clickable
                        component="a"
                        href={fileUrl}
                        target="_blank"
                        sx={{ maxWidth: 200 }}
                      />
                    );
                  })}
                </Stack>
              )}
              <FileUploader
                mode={initialData ? 'edit' : 'add'}
                uploading={false}
                selectedFiles={Array.from(formData.files || [])}
                setSelectedFiles={(files) => setFormData((prev) => ({ ...prev, files }))}
                onFilesChange={(files) => setFormData((prev) => ({ ...prev, files }))}
                onUpload={(files) => setFormData((prev) => ({ ...prev, files }))}
              />
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {activeStep > 0 && <Button onClick={handleBack}>Back</Button>}
        <Button variant="contained" onClick={handleNext}>
          {activeStep === steps.length - 1 ? 'Save' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}