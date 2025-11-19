// src/modules/Companies/CompanyManagement.js
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';

import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Card, CardContent, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, TablePagination, Tooltip, Stack, Chip, Box,
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel, Slide,
  Snackbar, Alert, CircularProgress
} from '@mui/material';
import { Edit, UploadFile } from '@mui/icons-material';
import { Player } from '@lottiefiles/react-lottie-player';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchBar from '../../components/SearchBar';
import FileUploader from '../../components/FileUploader';
import StatusFilter, { statusToIsActive } from '../../components/StatusFilter';

// ⬇️ permission helpers
import { canCreate, canUpdate, canDelete } from '../../utils/perm';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function CompanyManagement() {
  // 🔒 compute once per render
  const canEditCompanies =
    canCreate('companies') || canUpdate('companies') || canDelete('companies');

  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(''); // '', 'active', 'inactive'
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [uploading, setUploading] = useState(false);

  const defaultForm = {
    name: '',
    pan: '',
    gst: '',
    mca: '',
    address: '',
    notes: '',
    documents: [],
    is_active: true
  };

  const [form, setForm] = useState({ ...defaultForm });

  // resets fields but DOES NOT toggle the dialog open/close
  const resetForm = () => {
    setForm({ ...defaultForm });
    setEditMode(false);
    setSelectedId(null);
    setSelectedFiles([]);
  };

  const fetchCompanies = async () => {
    try {
      const params = { include_inactive: true };
      const isActive = statusToIsActive(selectedStatus);
      if (typeof isActive === 'boolean') params.is_active = isActive;

      const res = await API.get('companies/', { params });
      const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const sorted = list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setCompanies(sorted);
    } catch {
      setSnackbar({ open: true, message: 'Error fetching companies', severity: 'error' });
    }
  };

  useEffect(() => { fetchCompanies(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { fetchCompanies(); /* eslint-disable-next-line */ }, [selectedStatus]);

  const cancelForm = () => {
    setOpen(false);
    resetForm();
  };

  const handleFormSubmit = async () => {
    if (!canEditCompanies) return; // guard in case someone opens dialog via devtools

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!form.name || !form.pan || !form.gst || !form.mca) {
      return setSnackbar({ open: true, message: 'Please fill all required fields.', severity: 'error' });
    }
    if (!panRegex.test(String(form.pan).toUpperCase())) {
      return setSnackbar({ open: true, message: 'Invalid PAN format.', severity: 'error' });
    }
    if (!gstRegex.test(String(form.gst).toUpperCase())) {
      return setSnackbar({ open: true, message: 'Invalid GST format.', severity: 'error' });
    }

    setLoading(true);
    try {
      let id = selectedId;
      const payload = {
        ...form,
        pan: String(form.pan).toUpperCase(),
        gst: String(form.gst).toUpperCase()
      };

      if (editMode) {
        await API.put(`companies/${id}/`, payload);
        setSnackbar({ open: true, message: 'Company updated successfully!', severity: 'success' });
      } else {
        const res = await API.post('companies/', payload);
        id = res.data.id;
        setSnackbar({ open: true, message: 'Company added successfully!', severity: 'success' });

        if (selectedFiles.length > 0) {
          await uploadDocuments(id);
        }

        setTimeout(() => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 2000);
        }, 300);
      }

      fetchCompanies();
      cancelForm();
    } catch {
      setSnackbar({ open: true, message: 'Operation failed!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocuments = async (companyId, files = selectedFiles) => {
    if (!canEditCompanies) return; // guard
    if (!files || files.length === 0) return;

    const formData = new FormData();
    files.forEach(file => formData.append('documents', file));

    setUploading(true);
    try {
      await API.post(`companies/${companyId}/upload_document/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSnackbar({ open: true, message: 'Documents uploaded successfully', severity: 'success' });
      setSelectedFiles([]);
      fetchCompanies();
    } catch {
      setSnackbar({ open: true, message: 'Document upload failed', severity: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (c) => {
    if (!canEditCompanies) return; // view-only users can't open edit
    setForm({ ...c, documents: c.documents || [], is_active: !!c.is_active });
    setSelectedId(c.id);
    setEditMode(true);
    setOpen(true);
  };

  // CSV upload UI
  const handleCsvButtonClick = () => {
    if (!canEditCompanies) return;
    const input = document.getElementById('csv-upload');
    if (input) input.click();
  };

  const handleUploadCSV = async (e) => {
    if (!canEditCompanies) return;
    const file = e.target.files?.[0];
    if (!file) return setSnackbar({ open: true, message: 'Please select a CSV file', severity: 'error' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await API.post('companies/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      fetchCompanies();
      let delay = 0;
      (res.data?.results || []).forEach((r) => {
        if (r.errors) {
          const messages = Object.entries(r.errors).map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(', ') : m}`).join(' | ');
          setTimeout(() => {
            setSnackbar({ open: true, message: `Row ${r.row} - ${messages}`, severity: 'error' });
          }, delay);
          delay += 3000;
        }
      });
      if (!(res.data?.results || []).some(r => r.errors)) {
        setSnackbar({ open: true, message: 'Bulk upload completed successfully', severity: 'success' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Bulk upload failed', severity: 'error' });
    } finally {
      e.target.value = '';
    }
  };

  const handleFileChange = async (e) => {
    if (!canEditCompanies) return;
    const files = Array.from(e.target.files || []);
    const valid = [];

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setSnackbar({ open: true, message: `${file.name} exceeds 5MB limit`, severity: 'error' });
      } else {
        valid.push(file);
      }
    }

    setSelectedFiles(valid);

    if (editMode && selectedId && valid.length > 0) {
      await uploadDocuments(selectedId);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!canEditCompanies) return;
    try {
      await API.delete(`companies/company-documents/${docId}/`);
      setForm((prev) => ({
        ...prev,
        documents: (prev.documents || []).filter((doc) => doc.id !== docId),
      }));
      setSnackbar({ open: true, message: 'Document deleted successfully', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete document', severity: 'error' });
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const q = (searchText || '').toLowerCase();
    const matchesSearch =
      (c.name || '').toLowerCase().includes(q) ||
      (c.pan || '').toLowerCase().includes(q) ||
      (c.gst || '').toLowerCase().includes(q) ||
      (c.mca || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q);

    const matchesStatus = selectedStatus
      ? selectedStatus === 'active'
        ? !!c.is_active
        : !c.is_active
      : true;

    return matchesSearch && matchesStatus;
  });

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <div className="p-[35px]">
      <h2 className="text-2xl font-bold">Company Management</h2>

      <div className="flex justify-between items-center my-6 gap-3 flex-wrap">
        <SearchBar
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setPage(0); }}
          label="Search by Name / PAN / GST / MCA"
          placeholder="Type to search..."
        />

        <div className="flex gap-3 items-center">
          <StatusFilter
            value={selectedStatus}
            onChange={(v) => { setSelectedStatus(v); setPage(0); }}
          />

          {/* 🔒 Show upload/add only if user has edit rights */}
          {canEditCompanies && (
            <>
              <Button
                variant="outlined"
                startIcon={<UploadFile />}
                onClick={handleCsvButtonClick}
              >
                Upload CSV
              </Button>
              <input
                type="file"
                id="csv-upload"
                accept=".csv"
                hidden
                onChange={handleUploadCSV}
              />

              <Button
                variant="contained"
                onClick={() => { resetForm(); setOpen(true); }}
              >
                Add Company
              </Button>
            </>
          )}
        </div>
      </div>

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                <TableCell>#</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>PAN</TableCell>
                <TableCell>GST</TableCell>
                <TableCell>MCA</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Documents</TableCell>
                <TableCell>Status</TableCell>
                {canEditCompanies && <TableCell align="center">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {(rowsPerPage === -1 ? filteredCompanies : filteredCompanies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage))
                .map((c, index) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{
                      backgroundColor: c.is_active ? '#e8f5e9' : '#fffde7',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>{(rowsPerPage === -1 ? 0 : page * rowsPerPage) + index + 1}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.pan}</TableCell>
                    <TableCell>{c.gst}</TableCell>
                    <TableCell>{c.mca}</TableCell>
                    <TableCell>{c.address}</TableCell>
                    <TableCell>
                      {c.documents && c.documents.length > 0 ? (
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {c.documents.map((doc, i) => {
                            const fileUrl = doc.file;
                            const fileName = (fileUrl || '').split('/').pop();
                            const ext = (fileName || '').split('.').pop()?.toLowerCase();

                            const getIcon = () => {
                              if (ext === 'pdf') return <PictureAsPdfIcon fontSize="small" color="error" />;
                              if (['doc', 'docx'].includes(ext || '')) return <DescriptionIcon fontSize="small" color="primary" />;
                              return <InsertDriveFileIcon fontSize="small" />;
                            };

                            return (
                              <Tooltip title={fileName} key={doc.id}>
                                <Chip
                                  icon={getIcon()}
                                  label={`Doc ${i + 1}`}
                                  component="a"
                                  href={fileUrl}
                                  target="_blank"
                                  clickable
                                  size="small"
                                  sx={{ mb: 0.5 }}
                                />
                              </Tooltip>
                            );
                          })}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">No documents</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={c.is_active ? 'Active' : 'Inactive'}
                        color={c.is_active ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>

                    {canEditCompanies && (
                      <TableCell align="center">
                        <Tooltip title="Edit Company">
                          <IconButton onClick={() => handleEdit(c)} color="primary">
                            <Edit />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={filteredCompanies.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
          />
        </CardContent>
      </Card>

      {/* 🔒 Only render the dialog when editing is allowed */}
      {canEditCompanies && (
        <Dialog
          open={open}
          onClose={cancelForm}
          fullWidth
          maxWidth="sm"
          TransitionComponent={Transition}
          keepMounted
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
          <DialogTitle>{editMode ? 'Edit Company' : 'Add New Company'}</DialogTitle>
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
            <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>Company Details</Typography>
            <Box className="space-y-4">
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Company Name *"
                  fullWidth
                  value={form.name}
                  error={!form.name}
                  helperText={!form.name && 'Name is required'}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <TextField
                  label="PAN *"
                  fullWidth
                  value={form.pan}
                  error={!form.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(form.pan).toUpperCase())}
                  helperText={
                    !form.pan
                      ? 'PAN is required'
                      : !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(form.pan).toUpperCase()) && 'Invalid PAN format'
                  }
                  onChange={(e) => setForm({ ...form, pan: (e.target.value || '').toUpperCase() })}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="GSTIN *"
                  fullWidth
                  value={form.gst}
                  error={
                    !form.gst ||
                    !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(form.gst).toUpperCase())
                  }
                  helperText={
                    !form.gst
                      ? 'GST is required'
                      : !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(form.gst).toUpperCase()) &&
                        'Invalid GST format'
                  }
                  onChange={(e) => setForm({ ...form, gst: (e.target.value || '').toUpperCase() })}
                />
                <TextField
                  label="MCA Number *"
                  fullWidth
                  value={form.mca}
                  error={!form.mca}
                  helperText={!form.mca && 'MCA Number is required'}
                  onChange={(e) => setForm({ ...form, mca: e.target.value })}
                />
              </Box>

              <TextField
                label="Address"
                fullWidth
                multiline
                minRows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />

              <TextField
                label="Notes"
                fullWidth
                multiline
                minRows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <FormControl component="fieldset" sx={{ mt: 2 }}>
                <FormLabel component="legend">Status</FormLabel>
                <RadioGroup
                  row
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}
                >
                  <FormControlLabel
                    value="active"
                    control={<Radio sx={{ color: '#4caf50', '&.Mui-checked': { color: '#4caf50' } }} /> }
                    label="Active"
                  />
                  <FormControlLabel
                    value="inactive"
                    control={<Radio sx={{ color: '#ff9800', '&.Mui-checked': { color: '#ff9800' } }} /> }
                    label="Inactive"
                  />
                </RadioGroup>
              </FormControl>

              {editMode && form.documents?.length > 0 && (
                <Box sx={{ mt: 2, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Uploaded Documents
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                    {form.documents.map((doc) => {
                      const fileUrl = doc.file;
                      const fileName = (fileUrl || '').split('/').pop();
                      const ext = (fileName || '').split('.').pop()?.toLowerCase();

                      const getIcon = () => {
                        if (ext === 'pdf') return <PictureAsPdfIcon fontSize="small" color="error" />;
                        if (['doc', 'docx'].includes(ext || '')) return <DescriptionIcon fontSize="small" color="primary" />;
                        return <InsertDriveFileIcon fontSize="small" />;
                      };

                      return (
                        <Stack key={doc.id} direction="row" spacing={0.5} alignItems="center">
                          <Chip
                            icon={getIcon()}
                            label={fileName}
                            onDelete={() => handleDeleteDocument(doc.id)}
                            sx={{ mb: 1 }}
                            variant="outlined"
                          />
                          <IconButton
                            size="small"
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ mb: 1 }}
                          >
                            <InsertDriveFileIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              <FileUploader
                mode={editMode ? 'edit' : 'add'}
                uploading={uploading}
                selectedFiles={selectedFiles}
                setSelectedFiles={setSelectedFiles}
                onFilesChange={(files) => setSelectedFiles(files)}
                onUpload={(files) => uploadDocuments(selectedId, files)}
                onInputChange={handleFileChange}
              />
            </Box>
          </DialogContent>

          <DialogActions>
            <Button
              onClick={cancelForm}
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
              onClick={handleFormSubmit}
              variant="contained"
              disabled={loading}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 500,
                backgroundColor: '#2196f3',
                boxShadow: '0 4px 12px rgba(33, 150, 243, 0.4)',
                transition: 'all 0.3s ease',
                '&:hover': { backgroundColor: '#1976d2', boxShadow: '0 6px 16px rgba(33, 150, 243, 0.5)' },
              }}
            >
              {loading ? <CircularProgress size={24} /> : editMode ? 'Update' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

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

      {canEditCompanies && showSuccess && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40"
          style={{ zIndex: 1600 }}
        >
          <Card sx={{ p: 4, borderRadius: 4, boxShadow: 6, backgroundColor: 'white' }}>
            <Player
              autoplay
              loop={false}
              src="https://assets2.lottiefiles.com/packages/lf20_jbrw3hcz.json"
              style={{ height: '150px', width: '150px' }}
            />
            <Typography align="center" variant="h6" sx={{ mt: 2 }}>
              Company Added!
            </Typography>
          </Card>
        </div>
      )}
    </div>
  );
}
