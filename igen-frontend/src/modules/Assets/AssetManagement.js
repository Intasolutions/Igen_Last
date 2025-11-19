
import React, { useState, useEffect, useMemo } from 'react';
import {
  Button, Table, TableBody, TableCell, TableHead, TableRow, Typography, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Snackbar, Alert, Card, CardContent, Chip, TablePagination, Stack,
  Stepper, Step, StepLabel, Box, Slide, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, MenuItem,
  TableSortLabel, CircularProgress
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
import StatusFilter, { statusToIsActive } from '../../components/StatusFilter';
import { canCreate, canUpdate } from '../../utils/perm'; // ⬅️ role gates

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function AssetManagement() {
  // ---- role gates (Center Head should evaluate to false for these) ----
  const CAN_ADD  = canCreate('assets');
  const CAN_EDIT = canUpdate('assets');

  const [assets, setAssets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(''); // '', 'active', 'inactive'

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editAsset, setEditAsset] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState(null);

  // sorting
  const [orderBy, setOrderBy] = useState('created_at'); // default newest first
  const [order, setOrder] = useState('desc'); // 'asc' | 'desc'

  // --------- fetch list (handles index or list endpoint) ----------
  const fetchAssets = async () => {
    setLoading(true);
    try {
      let res = await API.get('assets/assets/');
      let list = Array.isArray(res.data) ? res.data : (res.data?.results || []);

      // fallback if someone hits the index by mistake
      if (!list.length && res.data && typeof res.data.assets === 'string') {
        const rel = res.data.assets.replace(API.defaults.baseURL || '', '');
        const res2 = await API.get(rel.startsWith('/') ? rel.slice(1) : rel);
        list = Array.isArray(res2.data) ? res2.data : (res2.data?.results || []);
      }

      setAssets(list || []);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      const errorMessage = error.response?.data?.detail
        ? error.response.data.detail
        : Object.values(error.response?.data || {}).flat().join(', ') || 'Failed to fetch assets';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      setAssets([]);
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
    if (!CAN_EDIT) {
      setSnackbar({ open: true, message: 'You do not have permission to edit assets.', severity: 'warning' });
      return;
    }
    setEditAsset(asset);
    setOpen(true);
  };

  const promptDeactivateAsset = (id) => {
    setSelectedAssetId(id);
    setConfirmOpen(true);
  };

  const confirmDeactivateAsset = async () => {
    try {
      await API.patch(`assets/assets/${selectedAssetId}/`, { is_active: false });
      setSnackbar({ open: true, message: 'Asset deactivated', severity: 'success' });
      fetchAssets();
    } catch (error) {
      console.error('Failed to deactivate asset:', error);
      const errorMessage = error.response?.data?.detail
        ? error.response.data.detail
        : Object.values(error.response?.data || {}).flat().join(', ') || 'Failed to deactivate asset';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setConfirmOpen(false);
      setSelectedAssetId(null);
    }
  };

  // ---- search + status filter ----
  const filteredAssets = useMemo(() => {
    const list = Array.isArray(assets) ? assets : [];
    const term = searchTerm.trim().toLowerCase();
    const isActive = statusToIsActive(selectedStatus); // true | false | undefined

    return list.filter((a) => {
      // status filter first
      if (typeof isActive === 'boolean' && !!a.is_active !== isActive) return false;

      if (!term) return true;

      const inDocs = Array.isArray(a.documents)
        ? (a.documents || []).some(d => (d.document || '').toLowerCase().includes(term))
        : false;

      const inDues = Array.isArray(a.service_dues)
        ? (a.service_dues || []).some(sd =>
            (sd.description || '').toLowerCase().includes(term) || String(sd.due_date || '').includes(term)
          )
        : false;

      return (
        (a.name || '').toLowerCase().includes(term) ||
        (a.tag_id || '').toLowerCase().includes(term) ||
        (a.company_name || '').toLowerCase().includes(term) ||
        (a.property_name || '').toLowerCase().includes(term) ||
        (a.project_name || '').toLowerCase().includes(term) ||
        (a.entity_name || '').toLowerCase().includes(term) ||
        (a.location || '').toLowerCase().includes(term) ||
        String(a.purchase_date || '').includes(term) ||
        String(a.warranty_expiry || '').includes(term) ||
        inDocs || inDues
      );
    });
  }, [assets, searchTerm, selectedStatus]);

  // ---- sorting helpers ----
  const getComparable = (row, key) => {
    switch (key) {
      case 'name': return (row.name || '').toString().toLowerCase();
      case 'tag_id': return (row.tag_id || '').toString().toLowerCase();
      case 'company_name': return (row.company_name || '').toString().toLowerCase();
      case 'property_name': return (row.property_name || '').toString().toLowerCase();
      case 'project_name': return (row.project_name || '').toString().toLowerCase();
      case 'entity_name': return (row.entity_name || '').toString().toLowerCase();
      case 'linked_to': {
        const s = (row.property_name || row.project_name || row.entity_name || '').toString().toLowerCase();
        return s;
      }
      case 'purchase_date': return row.purchase_date || '';
      case 'warranty_expiry': return row.warranty_expiry || '';
      case 'location': return (row.location || '').toString().toLowerCase();
      case 'is_active': return row.is_active ? 1 : 0;
      case 'created_at': return row.created_at || '';
      default: return (row[key] ?? '').toString().toLowerCase();
    }
  };

  const sortedAssets = useMemo(() => {
    const data = [...filteredAssets];
    data.sort((a, b) => {
      const av = getComparable(a, orderBy);
      const bv = getComparable(b, orderBy);
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [filteredAssets, orderBy, order]);

  const handleRequestSort = (property) => {
    if (orderBy === property) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(property);
      setOrder('asc');
    }
  };

  const pagedAssets = useMemo(() => {
    const start = page * rowsPerPage;
    const end = rowsPerPage === -1 ? undefined : start + rowsPerPage;
    return sortedAssets.slice(start, end);
  }, [sortedAssets, page, rowsPerPage]);

  // table columns
  const columns = [
    { id: 'rownum', label: '#', sortable: false },
    { id: 'name', label: 'Name', sortable: true },
    { id: 'tag_id', label: 'Tag ID', sortable: true },
    { id: 'company_name', label: 'Company', sortable: true },
    { id: 'linked_to', label: 'Linked To', sortable: true }, // unified column
    { id: 'purchase_date', label: 'Purchase Date', sortable: true },
    { id: 'warranty_expiry', label: 'Warranty Expiry', sortable: true },
    { id: 'location', label: 'Location', sortable: true },
    { id: 'documents', label: 'Documents', sortable: false },
    { id: 'service_dues', label: 'Service Dues', sortable: false },
    ...(CAN_EDIT ? [{ id: 'actions', label: 'Actions', sortable: false }] : []),
  ];

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Asset Management
      </Typography>

      <Box mt={3} display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <SearchBar
          label="Search by Name"
          placeholder="search asset name..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
        />

        <Stack direction="row" spacing={2} alignItems="center">
          <StatusFilter
            value={selectedStatus}
            onChange={(v) => { setSelectedStatus(v); setPage(0); }}
            size="small"
            sx={{ minWidth: 160 }}
            labelAll="All"
          />

          {CAN_ADD && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                if (!CAN_ADD) {
                  setSnackbar({ open: true, message: 'You do not have permission to add assets.', severity: 'warning' });
                  return;
                }
                setEditAsset(null);
                setOpen(true);
              }}
            >
              Add Asset
            </Button>
          )}
        </Stack>
      </Box>

      <AddAssetDialog
        open={open}
        onClose={() => { setOpen(false); setEditAsset(null); }}
        onSuccess={handleAddSuccess}
        initialData={editAsset}
        setSnackbar={setSnackbar}
        assets={assets}
        canAdd={CAN_ADD}
        canEdit={CAN_EDIT}
      />

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                {columns.map((col) => (
                  <TableCell key={col.id}>
                    {col.sortable ? (
                      <TableSortLabel
                        active={orderBy === col.id}
                        direction={orderBy === col.id ? order : 'asc'}
                        onClick={() => handleRequestSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    ) : (
                      col.label
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : pagedAssets.length > 0 ? (
                pagedAssets.map((asset, idx) => (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{
                      backgroundColor: asset.is_active === false ? '#fff9c4' : '#e8f5e9',
                      transition: 'background-color 0.2s',
                      '&:hover': {
                        backgroundColor: asset.is_active === false ? '#fff3bf' : '#c8e6c9',
                      },
                    }}
                  >
                    <TableCell>{page * (rowsPerPage === -1 ? pagedAssets.length : rowsPerPage) + idx + 1}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{asset.tag_id || 'N/A'}</TableCell>
                    <TableCell>{asset.company_name || 'N/A'}</TableCell>

                    <TableCell>
                      {asset.property_name || asset.project_name || asset.entity_name || '-'}
                    </TableCell>

                    <TableCell>{asset.purchase_date || '-'}</TableCell>
                    <TableCell>{asset.warranty_expiry || '-'}</TableCell>
                    <TableCell>{asset.location || '-'}</TableCell>

                    <TableCell>
                      {Array.isArray(asset.documents) && asset.documents.length ? (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {asset.documents.map((doc) => {
                            const fileUrl = `${process.env.REACT_APP_API_BASE_URL || ''}${doc.document}`;
                            const fileName = (fileUrl.split('/').pop() || '').trim();
                            const ext = (fileName.split('.').pop() || '').toLowerCase();

                            const icon =
                              ext === 'pdf'
                                ? <PictureAsPdfIcon fontSize="small" color="error" />
                                : (['doc', 'docx'].includes(ext)
                                    ? <DescriptionIcon fontSize="small" color="primary" />
                                    : <InsertDriveFileIcon fontSize="small" />);

                            return (
                              <Tooltip title={fileName} key={doc.id}>
                                <Chip
                                  icon={icon}
                                  label={fileName.replace(/<[^>]*>/g, '')}
                                  component="a"
                                  href={fileUrl}
                                  target="_blank"
                                  clickable
                                  size="small"
                                  sx={{
                                    mb: 0.5, maxWidth: 140, textOverflow: 'ellipsis',
                                    overflow: 'hidden', whiteSpace: 'nowrap'
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
                      {Array.isArray(asset.service_dues) && asset.service_dues.length ? (
                        asset.service_dues.map((due, i) => (
                          <Typography key={i} variant="caption" display="block" sx={{ color: '#444' }}>
                            {due.due_date} — {due.description}
                          </Typography>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">No Dues</Typography>
                      )}
                    </TableCell>

                    {CAN_EDIT && (
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          <Tooltip title="Edit">
                            <span>
                              <IconButton onClick={() => handleEdit(asset)} color="primary" disabled={!CAN_EDIT}>
                                <EditIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    <Typography variant="body2" color="textSecondary">
                      No assets found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={sortedAssets.length}
            page={page}
            onPageChange={(_e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
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

function AddAssetDialog({ open, onClose, onSuccess, initialData, setSnackbar, assets, canAdd, canEdit }) {
  const [companies, setCompanies] = useState([]);
  const [properties, setProperties] = useState([]);
  const [projects, setProjects] = useState([]);
  const [entities, setEntities] = useState([]); // NEW
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    company: '',
    linkType: 'property', // 'property' | 'project' | 'entity'
    property: '',
    project: '',
    entity: '', // NEW
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
    service_schedule: [{ id: Date.now(), due_date: '', description: '' }],
    files: null,
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        // companies list
        const c = await API.get('companies/');
        const companiesData = Array.isArray(c.data) ? c.data : (c.data?.results || []);
        setCompanies(companiesData || []);

        // properties list (handle index fallback)
        let p = await API.get('properties/properties/');
        let props = Array.isArray(p.data) ? p.data : (p.data?.results || []);
        if (!props.length && p.data && typeof p.data.properties === 'string') {
          const rel = p.data.properties.replace(API.defaults.baseURL || '', '');
          const p2 = await API.get(rel.startsWith('/') ? rel.slice(1) : rel);
          props = Array.isArray(p2.data) ? p2.data : (p2.data?.results || []);
        }
        setProperties(props || []);

        // projects list
        let pr = await API.get('projects/');
        let projs = Array.isArray(pr.data) ? pr.data : (pr.data?.results || []);
        if (!projs.length && pr.data && typeof pr.data.projects === 'string') {
          const rel = pr.data.projects.replace(API.defaults.baseURL || '', '');
          const pr2 = await API.get(rel.startsWith('/') ? rel.slice(1) : rel);
          projs = Array.isArray(pr2.data) ? pr2.data : (pr2.data?.results || []);
        }
        setProjects(projs || []);

        // entities list (NEW)
        let en = await API.get('entities/');
        let ents = Array.isArray(en.data) ? en.data : (en.data?.results || []);
        setEntities(ents || []);
      } catch (err) {
        console.error('Dropdown fetch failed:', err);
        const errorMessage = err.response?.data?.detail
          ? err.response.data.detail
          : Object.values(err.response?.data || {}).flat().join(', ') || 'Failed to load dropdowns';
        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
      } finally {
        setLoading(false);
      }
    })();

    if (initialData) {
      const scheduleWithIds = (initialData.service_dues || []).map(due => ({ ...due, id: Date.now() + Math.random() }));
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        company: initialData.company || '',
        property: initialData.property || '',
        project: initialData.project || '',
        entity: initialData.entity || '',
        linkType: initialData.property
          ? 'property'
          : (initialData.project ? 'project' : (initialData.entity ? 'entity' : 'property')),
        service_schedule: scheduleWithIds.length ? scheduleWithIds : [{ id: Date.now(), due_date: '', description: '' }],
        files: null
      }));
    } else {
      setFormData({
        company: '',
        linkType: 'property',
        property: '',
        project: '',
        entity: '',
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
        service_schedule: [{ id: Date.now(), due_date: '', description: '' }],
        files: null,
      });
    }
  }, [open, initialData, setSnackbar]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'is_active' ? value === 'true' : value
    }));
  };

  const handleScheduleChange = (idx, field, value) => {
    const updated = [...formData.service_schedule];
    updated[idx][field] = value;
    setFormData({ ...formData, service_schedule: updated });
  };

  const addServiceDate = () => {
    setFormData({
      ...formData,
      service_schedule: [...formData.service_schedule, { id: Date.now(), due_date: '', description: '' }]
    });
  };

  const deleteServiceDate = (idx) => {
    if (formData.service_schedule.length > 1) {
      setFormData({
        ...formData,
        service_schedule: formData.service_schedule.filter((_, i) => i !== idx)
      });
    } else {
      setSnackbar({ open: true, message: 'At least one service due entry is required.', severity: 'warning' });
    }
  };

  const validateStep0 = () => {
    const errors = {};
    if (!formData.name) errors.name = 'Asset Name is required';
    if (!formData.company) errors.company = 'Company is required';
    if (!formData.purchase_date) errors.purchase_date = 'Purchase Date is required';

    const picked = ['property', 'project', 'entity'].filter(k => !!formData[k]).length;
    if (picked !== 1) {
      errors.project_property = 'Pick exactly one: Property, Project, or Entity';
    }

    if (!initialData && (formData.tag_id || '').trim() && assets.some(a => (a.tag_id || '') === formData.tag_id)) {
      errors.tag_id = 'Tag ID must be unique';
    }
    if (formData.warranty_expiry && formData.purchase_date > formData.warranty_expiry) {
      errors.warranty_expiry = 'Warranty must be after purchase date';
    }
    return errors;
  };

  const handleSubmit = async () => {
    // enforce permissions here (center head: blocked)
    if (initialData && !canEdit) {
      setSnackbar({ open: true, message: 'You do not have permission to edit assets.', severity: 'warning' });
      return;
    }
    if (!initialData && !canAdd) {
      setSnackbar({ open: true, message: 'You do not have permission to add assets.', severity: 'warning' });
      return;
    }

    try {
      const errors = validateStep0();

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
        // ensure we only send exactly one link; empty others
        if (key === 'property' && formData.linkType !== 'property') value = '';
        if (key === 'project' && formData.linkType !== 'project') value = '';
        if (key === 'entity' && formData.linkType !== 'entity') value = '';
        form.append(key, value);
      });
      form.append('service_dues', JSON.stringify(formData.service_schedule.map(({ id, ...rest }) => rest)));
      if (formData.files && formData.files.length > 0) {
        for (let f of formData.files) form.append('documents', f);
      }

      if (initialData?.id) {
        await API.put(`assets/assets/${initialData.id}/`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSnackbar({ open: true, message: 'Asset updated successfully', severity: 'success' });
      } else {
        await API.post('assets/assets/', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        setSnackbar({ open: true, message: 'Asset created successfully', severity: 'success' });
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Submit error:', err?.response?.data || err.message);
      const errorMessage = err.response?.data?.detail
        ? err.response.data.detail
        : Object.values(err.response?.data || {}).flat().join(', ') || 'Failed to save asset';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };

  const steps = ['Basic Details', 'Service Dues', 'Documents'];
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep === 0) {
      const errors = validateStep0();
      setFormErrors(errors);
      setTouched(true);
      if (Object.keys(errors).length) return;
    }

    if (activeStep < steps.length - 1) {
      setActiveStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => setActiveStep((s) => s - 1);

  const handleDeleteUploadedDoc = async (docId) => {
    try {
      await API.delete(`assets/asset-documents/${docId}/`);
      setSnackbar({ open: true, message: 'Document deleted', severity: 'success' });
      if (initialData) {
        initialData.documents = initialData.documents.filter(d => d.id !== docId);
        setFormData(prev => ({ ...prev }));
      }
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err.response?.data?.detail
        ? err.response.data.detail
        : Object.values(err.response?.data || {}).flat().join(', ') || 'Failed to delete document';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
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
        sx: { borderRadius: 4, p: 3, backgroundColor: '#fafafa', boxShadow: 10, overflowY: 'hidden' }
      }}
    >
      <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.4rem', mb: 1, color: 'primary.main' }}>
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
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" p={3}>
            <CircularProgress />
            <Typography ml={2}>Loading...</Typography>
          </Box>
        ) : (
          <>
            <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
              {steps.map((label) => (
                <Step key={label}><StepLabel>{label}</StepLabel></Step>
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
                  sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
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
                    {companies.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                  </TextField>

                  <TextField label="Asset Name *" name="name" value={formData.name} onChange={handleChange}
                    error={touched && !!formErrors.name} helperText={touched && formErrors.name} />

                  <TextField label="Category" name="category" value={formData.category} onChange={handleChange} />

                  <TextField label="Purchase Price" name="purchase_price" type="number"
                    InputLabelProps={{ shrink: true }} value={formData.purchase_price} onChange={handleChange} />

                  <TextField label="Purchase Date *" name="purchase_date" type="date"
                    InputLabelProps={{ shrink: true }} value={formData.purchase_date} onChange={handleChange}
                    error={touched && !!formErrors.purchase_date} helperText={touched && formErrors.purchase_date} />

                  <TextField label="Warranty Expiry" name="warranty_expiry" type="date"
                    InputLabelProps={{ shrink: true }} value={formData.warranty_expiry} onChange={handleChange}
                    error={touched && !!formErrors.warranty_expiry} helperText={touched && formErrors.warranty_expiry} />

                  <TextField label="Location" name="location" value={formData.location} onChange={handleChange} />

                  <TextField label="Maintenance Frequency" name="maintenance_frequency"
                    value={formData.maintenance_frequency} onChange={handleChange} />

                  <TextField
                    label="Notes"
                    name="notes"
                    multiline
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    fullWidth
                    sx={{ gridColumn: '1 / -1' }}
                  />

                  <TextField label="Tag ID (Barcode/RFID)" name="tag_id" value={formData.tag_id} onChange={handleChange}
                    error={touched && !!formErrors.tag_id} helperText={touched && formErrors.tag_id} />

                  <FormControl component="fieldset" sx={{ gridColumn: '1 / -1' }}>
                    <FormLabel sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>Status *</FormLabel>
                    <RadioGroup
                      row
                      name="is_active"
                      value={formData.is_active.toString()}
                      onChange={handleChange}
                      sx={{ gap: 2 }}
                    >
                      <FormControlLabel value="true" control={<Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} />} label="Active" />
                      <FormControlLabel value="false" control={<Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} />} label="Inactive" />
                    </RadioGroup>
                  </FormControl>

                  <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main', gridColumn: '1 / -1' }}>
                    Linked To
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 2, gridColumn: '1 / -1' }}>
                    <FormControlLabel
                      control={<Radio checked={formData.linkType === 'property'}
                        onChange={() => setFormData({ ...formData, linkType: 'property', property: '', project: '', entity: '' })} value="property" />}
                      label="Property"
                    />
                    <FormControlLabel
                      control={<Radio checked={formData.linkType === 'project'}
                  onChange={() => setFormData({ ...formData, linkType: 'project', property: '', project: '', entity: '' })} value="project" />}
                      label="Project"
                    />
                    <FormControlLabel
                      control={<Radio checked={formData.linkType === 'entity'}
                        onChange={() => setFormData({ ...formData, linkType: 'entity', property: '', project: '', entity: '' })} value="entity" />}
                      label="Entity"
                    />
                  </Box>

                  {formData.linkType === 'property' && (
                    <TextField select fullWidth label="Select Property" name="property" value={formData.property}
                      onChange={handleChange} error={touched && !!formErrors.project_property} helperText={touched && formErrors.project_property}>
                      <MenuItem value="">Select</MenuItem>
                      {properties.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                  )}

                  {formData.linkType === 'project' && (
                    <TextField select fullWidth label="Select Project" name="project" value={formData.project}
                      onChange={handleChange} error={touched && !!formErrors.project_property} helperText={touched && formErrors.project_property}>
                      <MenuItem value="">Select</MenuItem>
                      {projects.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                    </TextField>
                  )}

                  {formData.linkType === 'entity' && (
                    <TextField select fullWidth label="Select Entity" name="entity" value={formData.entity}
                      onChange={handleChange} error={touched && !!formErrors.project_property} helperText={touched && formErrors.project_property}>
                      <MenuItem value="">Select</MenuItem>
                      {entities.map(e => <MenuItem key={e.id} value={e.id}>{e.name} ({e.entity_type})</MenuItem>)}
                    </TextField>
                  )}
                </Box>
              </>
            )}

            {activeStep === 1 && (
              <>
                <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>Service Due Dates</Typography>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  {formData.service_schedule.map((entry, index) => (
                    <Box
                      key={entry.id}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr auto' },
                        gap: 2, mb: 2, alignItems: 'center'
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
                      <IconButton color="error" onClick={() => deleteServiceDate(index)} disabled={formData.service_schedule.length === 1}>
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
                <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>Documents</Typography>
                <Box sx={{ gridColumn: '1 / -1' }}>
                  {Array.isArray(initialData?.documents) && initialData.documents.length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                      {initialData.documents.map((doc) => {
                        const fileUrl = `${process.env.REACT_APP_API_BASE_URL || ''}${doc.document}`;
                        const fileName = (fileUrl.split('/').pop() || '').trim().replace(/<[^>]*>/g, '');
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
                    selectedFiles={formData.files || []}
                    setSelectedFiles={(files) => setFormData((prev) => ({ ...prev, files }))}
                    onFilesChange={(files) => setFormData((prev) => ({ ...prev, files }))}
                    onUpload={(files) => setFormData((prev) => ({ ...prev, files }))}
                  />
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 500,
          color: '#64748b',
          '&:hover': {
            backgroundColor: '#f1f5f9',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          },
        }}>Cancel</Button>
        {activeStep > 0 && <Button onClick={handleBack} sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 500,
          color: '#64748b',
          '&:hover': {
            backgroundColor: '#f1f5f9',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          },
        }}>Back</Button>}
        <Button variant="contained" onClick={handleNext} sx={{
          borderRadius: 2,
          textTransform: 'none',
          fontWeight: 500,
        }}>
          {activeStep === 2 ? 'Save' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
