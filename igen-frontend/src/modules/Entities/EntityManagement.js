import React, { useState, useEffect, useCallback } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Snackbar, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Card, CardContent, IconButton, Tooltip, FormControl, FormLabel,
  TablePagination, Radio, RadioGroup, FormControlLabel, Chip, Stack, Slide,
  Autocomplete
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { motion } from 'framer-motion';
import ExportCsvButton from '../../components/ExportCsvButton';
import FolderIcon from '@mui/icons-material/Folder';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import ConfirmDialog from '../../components/ConfirmDialog';
import { canCreate, canUpdate } from '../../utils/perm';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const EntitySchema = Yup.object().shape({
  company: Yup.string().required('Company is required'),
  name: Yup.string().required('Entity Name is required'),
  entity_type: Yup.string().oneOf(['Property', 'Project', 'Contact']).required(),
  linked_property: Yup.string().nullable(),
  linked_project: Yup.string().nullable(),
  linked_contact: Yup.string().nullable(),
  status: Yup.string().oneOf(['Active', 'Inactive']),
  remarks: Yup.string().nullable(),
});

// ---------- normalize helpers ----------
const toArray = (d) => {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

// Try a list of paths; return first success (silent if all fail)
const bestEffortGetList = async (paths) => {
  for (const p of paths) {
    try {
      const r = await API.get(p);
      return toArray(r.data); // stop on first success (even empty)
    } catch {}
  }
  return [];
};

export default function EntityManagement() {
  const CAN_ADD  = canCreate('entities');
  const CAN_EDIT = canUpdate('entities');

  const [entities, setEntities] = useState([]);
  const [companies, setCompanies] = useState([]);

  // Lazy lookups
  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]);
  const [contacts, setContacts] = useState([]);

  const [loadedProps, setLoadedProps] = useState(false);
  const [loadedProjs, setLoadedProjs] = useState(false);
  const [loadedContacts, setLoadedContacts] = useState(false);

  // Autocomplete open flags
  const [propOpen, setPropOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const [open, setOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');

  const [form, setForm] = useState({
    company: '',
    name: '',
    entity_type: 'Property',
    linked_property: '',
    linked_project: '',
    linked_contact: '',
    status: 'Active',
    remarks: ''
  });

  const [confirmDialog, setConfirmDialog] = useState({
    open: false, title: '', content: '', id: null, action: null,
  });

  const resetForm = () => setForm({
    company: '',
    name: '',
    entity_type: 'Property',
    linked_property: '',
    linked_project: '',
    linked_contact: '',
    status: 'Active',
    remarks: ''
  });

  // ---------- fetchers ----------
  const fetchEntities = useCallback(async () => {
    try {
      const res = await API.get('entities/');
      setEntities(toArray(res.data));
    } catch {
      setSnackbar({ open: true, message: 'Error fetching entities', severity: 'error' });
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await API.get('companies/');
      setCompanies(toArray(res.data));
    } catch {
      setSnackbar({ open: true, message: 'Error fetching companies', severity: 'error' });
    }
  }, []);

  const ensureProps = useCallback(async () => {
    if (loadedProps) return;
    const list = await bestEffortGetList(['properties/properties/', 'properties/']);
    setProperties(list);
    setLoadedProps(true);
  }, [loadedProps]);

  const ensureProjects = useCallback(async () => {
    if (loadedProjs) return;
    const list = await bestEffortGetList(['projects/projects/', 'projects/']);
    setProjects(list);
    setLoadedProjs(true);
  }, [loadedProjs]);

  const ensureContacts = useCallback(async () => {
    if (loadedContacts) return;
    const list = await bestEffortGetList(['contacts/contacts/', 'contacts/']);
    setContacts(list);
    setLoadedContacts(true);
  }, [loadedContacts]);

  // Initial load: entities + companies only (no 404 noise)
  useEffect(() => {
    fetchEntities();
    fetchCompanies();
  }, [fetchEntities, fetchCompanies]);

  // When there are property rows, preload properties so names show in the grid
  useEffect(() => {
    if (entities.some(e => e.entity_type === 'Property')) {
      ensureProps();
    }
  }, [entities, ensureProps]);

  // When dialog opens, preload the list for the chosen type
  useEffect(() => {
    if (!open) return;
    if (form.entity_type === 'Property') ensureProps();
    if (form.entity_type === 'Project')  ensureProjects();
    if (form.entity_type === 'Contact')  ensureContacts();
  }, [open, form.entity_type, ensureProps, ensureProjects, ensureContacts]);

  // ---------- actions ----------
  const handleConfirm = async () => {
    const { id, action } = confirmDialog;
    try {
      if (action === 'deactivate') {
        await API.patch(`entities/${id}/`, { status: 'Inactive' });
        setSnackbar({ open: true, message: 'Entity deactivated successfully', severity: 'success' });
      }
      fetchEntities();
    } catch {
      setSnackbar({ open: true, message: 'Action failed', severity: 'error' });
    } finally {
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  const openEditDialog = (entity) => {
    if (!CAN_EDIT) {
      setSnackbar({ open: true, message: 'You do not have permission to edit entities.', severity: 'warning' });
      return;
    }
    setForm({
      company: entity.company,
      name: entity.name,
      entity_type: entity.entity_type,
      linked_property: entity.linked_property || '',
      linked_project: entity.linked_project || '',
      linked_contact: entity.linked_contact || '',
      status: entity.status,
      remarks: entity.remarks || '',
    });
    setEditId(entity.id);
    setIsEditMode(true);
    setOpen(true);
  };

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // ---------- filtering ----------
  const filteredEntities = entities.filter((e) => {
    const matchesSearch = (e.name || '').toLowerCase().includes((search || '').toLowerCase());
    const matchesStatus = selectedStatus ? e.status === selectedStatus : true;
    const matchesType = selectedType ? e.entity_type === selectedType : true;
    const matchesCompany = selectedCompany ? String(e.company) === String(selectedCompany) : true;
    return matchesSearch && matchesStatus && matchesType && matchesCompany;
  });

  // Fallback helpers (used only if *_name isn’t present)
  const getProjectName  = (id) => projects.find(p => p.id === id)?.name || '';
  const getPropertyName = (id) => properties.find(p => p.id === id)?.name || '';
  const getContactName  = (id) => contacts.find(c => (c.contact_id || c.id) === id)?.full_name || '';

  return (
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight="bold">Entity Management</Typography>

      {/* Header: Search + Filters + Actions */}
      <div className="flex justify-between items-center mt-6 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <TextField
            label="Search by Name"
            variant="outlined"
            size="small"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Type entity name..."
            InputProps={{ sx: { borderRadius: 3, backgroundColor: '#fafafa' } }}
          />

          <TextField
            select
            label="Company"
            size="small"
            value={selectedCompany}
            onChange={(e) => { setSelectedCompany(e.target.value); setPage(0); }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All Companies</MenuItem>
            {companies.map((c) => (
              <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            size="small"
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Inactive">Inactive</MenuItem>
          </TextField>

          <TextField
            select
            label="Type"
            size="small"
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="Property">Property</MenuItem>
            <MenuItem value="Project">Project</MenuItem>
            <MenuItem value="Contact">Contact</MenuItem>
          </TextField>
        </div>

        <div className="flex gap-3">
          <ExportCsvButton
            data={filteredEntities.map(e => ({
              Company: e.company_name,
              'Entity Name': e.name,
              Type: e.entity_type,
              Status: e.status,
              Remarks: e.remarks || ''
            }))}
            headers={['Company', 'Entity Name', 'Type', 'Status', 'Remarks']}
            filename="entities.csv"
          />
          {CAN_ADD && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => { resetForm(); setOpen(true); setIsEditMode(false); }}
            >
              ADD ENTITY
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Transition}
        keepMounted
        PaperProps={{
          sx: { borderRadius: 4, p: 3, backgroundColor: '#fafafa', boxShadow: 10, overflowY: 'hidden' }
        }}
      >
        <Formik
          initialValues={form}
          enableReinitialize
          validationSchema={EntitySchema}
          onSubmit={async (values, { setSubmitting }) => {
            if (isEditMode && !CAN_EDIT) {
              setSnackbar({ open: true, message: 'You do not have permission to edit entities.', severity: 'warning' });
              setSubmitting(false);
              return;
            }
            if (!isEditMode && !CAN_ADD) {
              setSnackbar({ open: true, message: 'You do not have permission to add entities.', severity: 'warning' });
              setSubmitting(false);
              return;
            }

            // simple duplicate check
            if (entities.some(e =>
              e.company === values.company &&
              (e.name || '').trim().toLowerCase() === (values.name || '').trim().toLowerCase() &&
              (!isEditMode || e.id !== editId)
            )) {
              setSnackbar({ open: true, message: 'Entity name already exists for this company.', severity: 'error' });
              setSubmitting(false);
              return;
            }

            const payload = {
              ...values,
              linked_property: values.entity_type === 'Property' ? values.linked_property : null,
              linked_project:  values.entity_type === 'Project'  ? values.linked_project  : null,
              linked_contact:  values.entity_type === 'Contact'  ? values.linked_contact  : null,
            };

            try {
              if (isEditMode) {
                await API.put(`entities/${editId}/`, payload);
                setSnackbar({ open: true, message: 'Entity updated successfully', severity: 'success' });
              } else {
                await API.post('entities/', payload);
                setSnackbar({ open: true, message: 'Entity added successfully', severity: 'success' });
              }
              fetchEntities();
              setOpen(false);
              resetForm();
              setIsEditMode(false);
            } catch (err) {
              const message =
                err.response?.data?.name?.[0] ||
                err.response?.data?.detail ||
                'Failed to save entity';
              setSnackbar({ open: true, message, severity: 'error' });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ values, handleChange, setFieldValue, touched, errors }) => (
            <Form>
              <motion.div
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } }}
              >
                <DialogTitle>{isEditMode ? 'Edit Entity' : 'Add New Entity'}</DialogTitle>

                <DialogContent
                  dividers
                  sx={{
                    p: 3, overflowY: 'auto', maxHeight: '60vh',
                    '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', '-ms-overflow-style': 'none',
                  }}
                >
                  <TextField
                    select
                    margin="normal"
                    label="Company *"
                    name="company"
                    fullWidth
                    value={values.company}
                    onChange={handleChange}
                    error={touched.company && !!errors.company}
                    helperText={touched.company && errors.company}
                  >
                    {companies.map(c => (
                      <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    margin="normal"
                    label="Entity Name *"
                    name="name"
                    fullWidth
                    value={values.name}
                    onChange={handleChange}
                    error={touched.name && !!errors.name}
                    helperText={touched.name && errors.name}
                  />

                  <FormControl component="fieldset" sx={{ mt: 2 }}>
                    <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                      Entity Type *
                    </FormLabel>
                    <RadioGroup
                      row
                      name="entity_type"
                      value={values.entity_type}
                      onChange={async (e) => {
                        handleChange(e);
                        setFieldValue('linked_property', '');
                        setFieldValue('linked_project', '');
                        setFieldValue('linked_contact', '');
                        const next = e.target.value;
                        if (next === 'Property') await ensureProps();
                        if (next === 'Project')  await ensureProjects();
                        if (next === 'Contact')  await ensureContacts();
                      }}
                    >
                      <FormControlLabel value="Property" control={<Radio sx={{ color: "#1976d2", "&.Mui-checked": { color: "#0d47a1" } }} />} label="Property" />
                      <FormControlLabel value="Project"  control={<Radio sx={{ color: "#9c27b0", "&.Mui-checked": { color: "#6a1b9a" } }} />} label="Project" />
                      <FormControlLabel value="Contact"  control={<Radio sx={{ color: "#ff5722", "&.Mui-checked": { color: "#bf360c" } }} />} label="Contact" />
                    </RadioGroup>
                  </FormControl>

                  {values.entity_type === 'Property' && (
                    <Autocomplete
                      open={propOpen}
                      onOpen={async () => { setPropOpen(true); await ensureProps(); }}
                      onClose={() => setPropOpen(false)}
                      options={properties}
                      getOptionLabel={(option) => option?.name ?? ''}
                      isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          margin="normal"
                          label="Linked Property"
                          error={touched.linked_property && !!errors.linked_property}
                          helperText={touched.linked_property && errors.linked_property}
                        />
                      )}
                      value={properties.find(p => p.id === values.linked_property) || null}
                      onChange={(_e, newValue) => {
                        setFieldValue('linked_property', newValue ? newValue.id : '');
                      }}
                      renderOption={(props, option) => (
                        <li {...props}>
                          {option?.name} {option?.status === 'Inactive' && '(Inactive)'}
                        </li>
                      )}
                      sx={{ mt: 2 }}
                    />
                  )}

                  {values.entity_type === 'Project' && (
                    <Autocomplete
                      open={projOpen}
                      onOpen={async () => { setProjOpen(true); await ensureProjects(); }}
                      onClose={() => setProjOpen(false)}
                      options={projects}
                      getOptionLabel={(option) => option?.name ?? ''}
                      isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          margin="normal"
                          label="Linked Project"
                          error={touched.linked_project && !!errors.linked_project}
                          helperText={touched.linked_project && errors.linked_project}
                        />
                      )}
                      value={projects.find(p => p.id === values.linked_project) || null}
                      onChange={(_e, newValue) => {
                        setFieldValue('linked_project', newValue ? newValue.id : '');
                      }}
                      sx={{ mt: 2 }}
                    />
                  )}

                  {values.entity_type === 'Contact' && (
                    <Autocomplete
                      open={contactOpen}
                      onOpen={async () => { setContactOpen(true); await ensureContacts(); }}
                      onClose={() => setContactOpen(false)}
                      options={contacts}
                      getOptionLabel={(option) => option?.full_name ?? ''}
                      isOptionEqualToValue={(opt, val) =>
                        (opt?.contact_id || opt?.id) === (val?.contact_id || val?.id)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          margin="normal"
                          label="Linked Contact"
                          error={touched.linked_contact && !!errors.linked_contact}
                          helperText={touched.linked_contact && errors.linked_contact}
                        />
                      )}
                      value={
                        contacts.find(c => (c.contact_id || c.id) === values.linked_contact) || null
                      }
                      onChange={(_e, newValue) => {
                        setFieldValue('linked_contact', newValue ? (newValue.contact_id || newValue.id) : '');
                      }}
                      renderOption={(props, option) => (
                        <li {...props}>
                          {option?.full_name}{option?.phone ? ` — ${option.phone}` : ''}
                        </li>
                      )}
                      sx={{ mt: 2 }}
                    />
                  )}

                  <FormControl component="fieldset" margin="normal">
                    <FormLabel component="legend" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
                      Status *
                    </FormLabel>
                    <RadioGroup
                      row
                      name="status"
                      value={values.status}
                      onChange={handleChange}
                      sx={{ gap: 2 }}
                    >
                      <FormControlLabel value="Active"   control={<Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} />} label="Active" />
                      <FormControlLabel value="Inactive" control={<Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} />} label="Inactive" />
                    </RadioGroup>
                  </FormControl>

                  <TextField
                    margin="normal"
                    label="Remarks"
                    name="remarks"
                    fullWidth
                    multiline
                    minRows={2}
                    value={values.remarks}
                    onChange={handleChange}
                  />
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
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
                    type="submit"
                    variant="contained"
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
                    {isEditMode ? 'Update' : 'Add'}
                  </Button>
                </DialogActions>
              </motion.div>
            </Form>
          )}
        </Formik>
      </Dialog>

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Company</TableCell>
                  <TableCell>Entity Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                  {CAN_EDIT && <TableCell align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntities
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((e, idx) => (
                    <TableRow
                      key={e.id}
                      sx={{
                        backgroundColor: e.status === 'Active' ? '#e8f5e9' : '#fffde7',
                        transition: 'background-color 0.2s ease-in-out',
                        '&:hover': { backgroundColor: e.status === 'Active' ? '#c8e6c9' : '#fff9c4' }
                      }}
                    >
                      <TableCell>{page * rowsPerPage + idx + 1}</TableCell>
                      <TableCell>{e.company_name}</TableCell>
                      <TableCell>{e.name}</TableCell>
                      <TableCell align="center">
                        <Stack spacing={0.5}>
                          <Chip
                            label={e.entity_type}
                            color={
                              e.entity_type === 'Project'
                                ? 'primary'
                                : e.entity_type === 'Contact'
                                ? 'warning'
                                : 'secondary'
                            }
                            size="small"
                            icon={
                              e.entity_type === 'Project'
                                ? <FolderIcon />
                                : e.entity_type === 'Contact'
                                ? <PersonIcon />
                                : <HomeIcon />
                            }
                          />
                          {/* show backend-provided linked_*_name first; fall back to cached lists */}
                          {e.entity_type === 'Project' && (
                            <Typography variant="caption" color="text.secondary">
                              {e.linked_project_name || getProjectName(e.linked_project) || '-'}
                            </Typography>
                          )}
                          {e.entity_type === 'Property' && (
                            <Typography variant="caption" color="text.secondary">
                              {e.linked_property_name || getPropertyName(e.linked_property) || '-'}
                            </Typography>
                          )}
                          {e.entity_type === 'Contact' && (
                            <Typography variant="caption" color="text.secondary">
                              {e.linked_contact_name || getContactName(e.linked_contact) || '-'}
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>{e.status}</TableCell>
                      <TableCell>{e.remarks || '-'}</TableCell>
                      {CAN_EDIT && (
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <span>
                              <IconButton color="primary" onClick={() => openEditDialog(e)} disabled={!CAN_EDIT}>
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                {filteredEntities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={CAN_EDIT ? 7 : 6} align="center">No entities found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredEntities.length}
              page={page}
              onPageChange={(_e, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </TableContainer>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        content={confirmDialog.content}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
