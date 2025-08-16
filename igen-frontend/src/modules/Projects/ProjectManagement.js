import React, { useState, useEffect, useMemo } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Card, CardContent, Typography, IconButton,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Tooltip, Snackbar, Alert, Slide, MenuItem, Checkbox, ListItemText,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,Box
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DownloadIcon from '@mui/icons-material/Download';
import BulkUploadDialog from '../../components/BulkUploadDialog';
import TablePaginationComponent from '../../components/TablePaginationComponent';
import SearchBar from '../../components/SearchBar';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function ProjectManagement() {
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [projectManagers, setProjectManagers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    stakeholders: [],
    expected_return: '',
    project_status: 'proposed',
    landmark: '',
    pincode: '',
    city: '',
    district: '',
    state: 'Kerala',
    country: 'India',
    company_id: '',
    property_manager: '',
    key_stakeholder: '',
    project_type: '',
    is_active: true
  });

  useEffect(() => {
    fetchProjects();
    fetchContacts();
    fetchProjectManagers();
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      const companiesData = Array.isArray(res.data) ? res.data : res.data.results || [];
      setCompanies(companiesData);
      console.log('Fetched companies:', companiesData); // Debug log
    } catch {
      showSnackbar('Error fetching companies', 'error');
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await API.get('projects/');
      const projectsData = Array.isArray(res.data) ? res.data : res.data.results || [];
      setProjects(projectsData);
      console.log('Fetched projects:', projectsData); // Debug log
    } catch {
      showSnackbar('Error fetching projects', 'error');
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await API.get('contacts/');
      setContacts(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      showSnackbar('Error fetching contacts', 'error');
    }
  };

  const fetchProjectManagers = async () => {
    try {
      const res = await API.get('users/?role=PROPERTY_MANAGER');
      setProjectManagers(Array.isArray(res.data) ? res.data : res.data.results || []);
    } catch {
      showSnackbar('Error fetching property managers', 'error');
    }
  };

  const handleAddOrUpdateProject = async () => {
    const errors = {};

    if (!form.name?.trim()) errors.name = 'Project name is required';
    if (!form.start_date) errors.start_date = 'Start date is required';
    if (!form.company_id) errors.company_id = 'Company is required';
    if (!form.project_type) errors.project_type = 'Project type is required';
    if (!form.project_status) errors.project_status = 'Project status is required';
    if (!form.property_manager) errors.property_manager = 'Property manager is required';
    if (typeof form.is_active !== 'boolean') errors.is_active = 'Status must be Active or Inactive';

    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      showSnackbar('Please correct the highlighted fields', 'warning');
      return;
    }

    const payload = {
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date || null,
      project_type: form.project_type || null,
      expected_return: form.expected_return || null,
      project_status: form.project_status || 'proposed',
      landmark: form.landmark || '',
      pincode: form.pincode || '',
      city: form.city || '',
      district: form.district || '',
      state: form.state || '',
      country: form.country || '',
      company: form.company_id || null,
      stakeholder_ids: form.stakeholders.filter(Boolean),
      property_manager_id: form.property_manager || null,
      key_stakeholder_id: form.key_stakeholder || null,
      is_active: form.is_active
    };

    try {
      if (editingId) {
        await API.put(`projects/${editingId}/`, payload);
        showSnackbar('Project updated');
      } else {
        await API.post('projects/', payload);
        showSnackbar('Project added');
      }

      fetchProjects();
      setOpen(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error("Failed to save project:", err?.response?.data || err.message);
      showSnackbar(err?.response?.data?.detail || 'Failed to save project', 'error');
    }
  };

  const resetForm = () => setForm({
    name: '',
    start_date: '',
    end_date: '',
    stakeholders: [],
    expected_return: '',
    project_status: 'proposed',
    landmark: '',
    pincode: '',
    city: '',
    district: '',
    state: 'Kerala',
    country: 'India',
    company_id: '',
    property_manager: '',
    key_stakeholder: '',
    project_type: '',
    is_active: true
  });

  const handleEdit = (project) => {
    console.log('Editing project:', project); // Debug log
    const companyId = project.company || project.company?.id || project.company_id || project.companyId || project.company_ref || '';
    if (!companies.length) {
      showSnackbar('Companies not loaded yet, please try again', 'warning');
      return;
    }
    if (!companyId) {
      showSnackbar('No company associated with this project. Please assign a company in the backend.', 'error');
      return;
    }
    setForm({
      ...project,
      company_id: companyId,
      property_manager: project.property_manager?.id ?? '',
      key_stakeholder: project.key_stakeholder?.contact_id ?? '',
      stakeholders: Array.isArray(project.stakeholders) ? project.stakeholders.map(s => s.contact_id ?? '') : [],
      is_active: project.is_active ?? true
    });
    setEditingId(project.id);
    setOpen(true);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.size <= 10 * 1024 * 1024) {
      setCsvFile(selectedFile);
    } else {
      showSnackbar('File must be under 10MB', 'warning');
    }
  };

  const handleBulkUpload = async () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    try {
      await API.post('projects/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSnackbar('Bulk upload successful');
      fetchProjects();
      setUploadDialogOpen(false);
      setCsvFile(null);
    } catch (error) {
      console.error(error);
      showSnackbar('Bulk upload failed', 'error');
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Start Date', 'End Date', 'Project Type', 'Expected Return', 'Status'];
    const rows = projects.map(p => [
      p.name,
      p.start_date,
      p.end_date,
      p.project_type,
      p.expected_return,
      p.project_status
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'projects.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
  }, [search, projects]);

  const paginatedProjects = useMemo(() => {
    const start = page * rowsPerPage;
    const end = rowsPerPage === -1 ? filteredProjects.length : start + rowsPerPage;
    return filteredProjects.slice(start, end);
  }, [page, rowsPerPage, filteredProjects]);

  const keralaDistricts = [
    'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
    'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
    'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'
  ];

  return (
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight={600}>Project Management</Typography>

      <div className="flex justify-between items-center mb-6 mt-6">
        <SearchBar
          label="Search Projects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-3">
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              px: 2,
              bgcolor: '#e3f2fd',
              '&:hover': {
                bgcolor: '#bbdefb',
              },
            }}
          >
            Bulk Upload
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
            color='success'
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              px: 2,
              bgcolor: '#e8f5e9',
              '&:hover': {
                bgcolor: '#c8e6c9',
              },
            }}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            color="primary"
            onClick={() => {
              setOpen(true);
              resetForm();
              setEditingId(null);
            }}
          >
            Add Project
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Manager</TableCell>
                  <TableCell>Stakeholder</TableCell>
                  <TableCell>City</TableCell>
                  <TableCell>District</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedProjects.length > 0 ? paginatedProjects.map((p, i) => (
                  <TableRow key={p.id} sx={{ backgroundColor: p.is_active ? '#e8f5e9' : '#fffde7' }}>
                    <TableCell>{page * rowsPerPage + i + 1}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.start_date}</TableCell>
                    <TableCell>{p.end_date || '-'}</TableCell>
                    <TableCell>{p.project_type || '-'}</TableCell>
                    <TableCell>{p.project_status}</TableCell>
                    <TableCell>{p.property_manager?.full_name || p.property_manager?.username || '-'}</TableCell>
                    <TableCell>{p.key_stakeholder?.full_name || '-'}</TableCell>
                    <TableCell>{p.city || '-'}</TableCell>
                    <TableCell>{p.district || '-'}</TableCell>
                    <TableCell>{p.state || '-'}</TableCell>
                    <TableCell>{p.country || '-'}</TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton color='primary' onClick={() => handleEdit(p)}><EditIcon /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={13} align="center">No projects found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationComponent
            count={filteredProjects.length}
            page={page}
            rowsPerPage={rowsPerPage}
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
        onClose={() => {
          setOpen(false);
          resetForm();
          setEditingId(null);
        }}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Transition}
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle>{editingId ? 'Edit Project' : 'Add Project'}</DialogTitle>
        <DialogContent style={{ maxHeight: '70vh', overflowY: 'auto' }}  sx={{
    maxHeight: '70vh',
    overflowY: 'auto',
    scrollbarWidth: 'none', // Firefox
    '&::-webkit-scrollbar': {
      display: 'none' // Chrome, Safari
    }
  }}>
              <Typography variant="subtitle1" sx={{ mb: 1 ,color:'primary.main'}}>Project Details</Typography>
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
            label="Company"
            required
            fullWidth
            margin="normal"
            value={form.company_id || ''}
            onChange={(e) => {
              setForm({ ...form, company_id: e.target.value });
              setValidationErrors({ ...validationErrors, company_id: '' });
            }}
            error={!!validationErrors.company_id}
            helperText={validationErrors.company_id || (form.company_id && !companies.find(c => c.id === form.company_id) ? 'Company not found' : '')}
          >
            <MenuItem value="">Select Company</MenuItem>
            {companies.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Name"
            required
            fullWidth
            margin="normal"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              setValidationErrors({ ...validationErrors, name: '' });
            }}
            error={!!validationErrors.name}
            helperText={validationErrors.name}
          />

          <TextField
            label="Start Date"
            type="date"
            required
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            value={form.start_date}
            onChange={(e) => {
              setForm({ ...form, start_date: e.target.value });
              setValidationErrors({ ...validationErrors, start_date: '' });
            }}
            error={!!validationErrors.start_date}
            helperText={validationErrors.start_date}
          />

          <TextField
            label="End Date"
            type="date"
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />

          <TextField
            select
            label="Project Type"
            required
            fullWidth
            margin="normal"
            value={form.project_type}
            onChange={(e) => {
              setForm({ ...form, project_type: e.target.value });
              setValidationErrors({ ...validationErrors, project_type: '' });
            }}
            error={!!validationErrors.project_type}
            helperText={validationErrors.project_type}
          >
            <MenuItem value="">Select Type</MenuItem>
            {['internal', 'construction', 'interior'].map(type => (
              <MenuItem key={type} value={type}>{type}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Stakeholders"
            fullWidth
            margin="normal"
            SelectProps={{
              multiple: true,
              renderValue: (selected) =>
                contacts
                  .filter(c => selected.includes(String(c.contact_id)))
                  .map(c => c.full_name || c.email)
                  .join(', ')
            }}
            value={form.stakeholders.map(String)}
            onChange={(e) =>
              setForm({
                ...form,
                stakeholders: e.target.value.map(String)
              })
            }
          >
            {contacts.map(c => (
              <MenuItem key={c.contact_id} value={String(c.contact_id)}>
                <Checkbox checked={form.stakeholders.map(String).includes(String(c.contact_id))} />
                <ListItemText primary={c.full_name || c.email || `Contact ${c.contact_id}`} />
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Property Manager"
            required
            fullWidth
            margin="normal"
            value={form.property_manager}
            onChange={(e) => {
              setForm({ ...form, property_manager: e.target.value });
              setValidationErrors({ ...validationErrors, property_manager: '' });
            }}
            error={!!validationErrors.property_manager}
            helperText={validationErrors.property_manager}
          >
            <MenuItem value="">Select Manager</MenuItem>
            {projectManagers.map(u => (
              <MenuItem key={u.id} value={u.id}>{u.full_name || u.username} ({u.email})</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Key Stakeholder"
            fullWidth
            margin="normal"
            value={form.key_stakeholder}
            onChange={(e) => setForm({ ...form, key_stakeholder: e.target.value })}
          >
            <MenuItem value="">Select Key Stakeholder</MenuItem>
            {contacts.map(c => (
              <MenuItem key={c.contact_id} value={c.contact_id}>
                {c.full_name || c.email || `Contact ${c.contact_id}`}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            required
            fullWidth
            margin="normal"
            value={form.project_status}
            onChange={(e) => {
              setForm({ ...form, project_status: e.target.value });
              setValidationErrors({ ...validationErrors, project_status: '' });
            }}
            error={!!validationErrors.project_status}
            helperText={validationErrors.project_status}
          >
            <MenuItem value="">Select Status</MenuItem>
            <MenuItem value="proposed">Proposed</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
          </TextField>

          <FormControl component="fieldset" margin="normal" sx={{ mt: 2 }}>
            <FormLabel component="legend">Active Status</FormLabel>
            <RadioGroup
              row
              value={form.is_active}
              onChange={(e) => {
                console.log('Setting is_active to:', e.target.value === 'true');
                setForm({ ...form, is_active: e.target.value === 'true' });
                setValidationErrors({ ...validationErrors, is_active: '' });
              }}
              sx={{ gap: 2 }}
            >
              <FormControlLabel
                value={true}
                control={<Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} />}
                label="Active"
                sx={{ '& .MuiFormControlLabel-label': { color: '#424242' } }}
              />
              <FormControlLabel
                value={false}
                control={<Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} />}
                label="Inactive"
                sx={{ '& .MuiFormControlLabel-label': { color: '#424242' } }}
              />
            </RadioGroup>
          </FormControl>
          </Box>
           <Typography variant="subtitle1" sx={{ mb: 1 ,color:'primary.main'}}>Address Details</Typography>

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
            label="Landmark"
            fullWidth
            margin="normal"
            value={form.landmark}
            onChange={(e) => setForm({ ...form, landmark: e.target.value })}
          />

          <TextField
            label="Pincode"
            fullWidth
            margin="normal"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
          />

          <TextField
            label="City"
            fullWidth
            margin="normal"
            value={form.city}
            onChange={(e) => {
              setForm({ ...form, city: e.target.value });
              setValidationErrors({ ...validationErrors, city: '' });
            }}
            error={!!validationErrors.city}
            helperText={validationErrors.city}
          />

          <TextField
            select
            label="District"
            fullWidth
            margin="normal"
            value={form.district}
            onChange={(e) => {
              setForm({ ...form, district: e.target.value });
              setValidationErrors({ ...validationErrors, district: '' });
            }}
            error={!!validationErrors.district}
            helperText={validationErrors.district}
          >
            <MenuItem value="">Select District</MenuItem>
            {keralaDistricts.map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="State"
            fullWidth
            margin="normal"
            value={form.state}
            onChange={(e) => {
              setForm({ ...form, state: e.target.value });
              setValidationErrors({ ...validationErrors, state: '' });
            }}
            error={!!validationErrors.state}
            helperText={validationErrors.state}
          />

          <TextField
            label="Country"
            fullWidth
            margin="normal"
            value={form.country}
            onChange={(e) => {
              setForm({ ...form, country: e.target.value });
              setValidationErrors({ ...validationErrors, country: '' });
            }}
            error={!!validationErrors.country}
            helperText={validationErrors.country}
          />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => {
            setOpen(false);
            resetForm();
            setEditingId(null);
          }} sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': {
                backgroundColor: '#f1f5f9',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddOrUpdateProject} sx={{
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
            }}>
            {editingId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>

      <BulkUploadDialog
        open={uploadDialogOpen}
        onClose={() => {
          setUploadDialogOpen(false);
          setCsvFile(null);
        }}
        onFileChange={handleFileChange}
        onUpload={handleBulkUpload}
        file={csvFile}
        sampleLink="/sample/project_sample.csv"
      />
    </div>
  );
}