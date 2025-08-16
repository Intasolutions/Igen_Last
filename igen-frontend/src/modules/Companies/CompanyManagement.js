import React, { useState, useEffect } from 'react';
import API from '../../api/axios';


import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Card, CardContent, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, IconButton, TablePagination, Tooltip, Stack, Chip, Box,
  Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,Slide,
  colors
} from '@mui/material';
import { Edit } from '@mui/icons-material';

import { Snackbar, Alert, CircularProgress } from '@mui/material';
import { Player } from '@lottiefiles/react-lottie-player';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import SearchBar from '../../components/SearchBar';
import FileUploader from '../../components/FileUploader';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function CompanyManagement() {
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [uploadResults, setUploadResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [form, setForm] = useState({ name: '', pan: '', gst: '', mca: '', address: '', notes: '', documents: [], is_active: true });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [uploading, setUploading] = useState(false);

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      const sorted = res.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setCompanies(sorted);
    } catch {
      setSnackbar({ open: true, message: 'Error fetching companies', severity: 'error' });
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const cancelForm = () => {
    setOpen(false);
    setForm({ name: '', pan: '', gst: '', mca: '', address: '', notes: '', documents: [], is_active: true });
  };

  const handleFormSubmit = async () => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    if (!form.name || !form.pan || !form.gst || !form.mca) {
      return setSnackbar({ open: true, message: 'Please fill all required fields.', severity: 'error' });
    }
    if (!panRegex.test(form.pan)) {
      return setSnackbar({ open: true, message: 'Invalid PAN format.', severity: 'error' });
    }
    if (!gstRegex.test(form.gst)) {
      return setSnackbar({ open: true, message: 'Invalid GST format.', severity: 'error' });
    }

    setLoading(true);
    try {
      let id = selectedId;
      if (editMode) {
        await API.put(`companies/${id}/`, form);
        setSnackbar({ open: true, message: 'Company updated successfully!', severity: 'success' });
      } else {
        const res = await API.post('companies/', form);
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
      setOpen(false);
      setForm({ name: '', pan: '', gst: '', mca: '', address: '', notes: '', documents: [], is_active: true });
      setEditMode(false);
      setSelectedId(null);
      setSelectedFiles([]);
    } catch {
      setSnackbar({ open: true, message: 'Operation failed!', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const uploadDocuments = async (companyId, files = selectedFiles) => {
    if (!files || files.length === 0) {
      return;
    }

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
    setForm({ ...c, documents: c.documents || [], is_active: c.is_active });
    setSelectedId(c.id);
    setEditMode(true);
    setOpen(true);
  };

  const handleUploadCSV = async () => {
    const file = document.getElementById('csv-upload').files[0];
    if (!file) return setSnackbar({ open: true, message: 'Please select a CSV file', severity: 'error' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await API.post('companies/bulk_upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      fetchCompanies();
      let delay = 0;
      res.data.results.forEach((r) => {
        if (r.errors) {
          const messages = Object.entries(r.errors).map(([f, m]) => `${f}: ${m.join(', ')}`).join(' | ');
          setTimeout(() => {
            setSnackbar({ open: true, message: `Row ${r.row} - ${messages}`, severity: 'error' });
          }, delay);
          delay += 3000;
        }
      });
      if (!res.data.results.some(r => r.errors)) {
        setSnackbar({ open: true, message: 'Bulk upload completed successfully', severity: 'success' });
      }
    } catch {
      setSnackbar({ open: true, message: 'Bulk upload failed', severity: 'error' });
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
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
    try {
      await API.delete(`/companies/company-documents/${docId}/`);
      setForm((prev) => ({
        ...prev,
        documents: prev.documents.filter((doc) => doc.id !== docId),
      }));
      setSnackbar({ open: true, message: 'Document deleted successfully', severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete document', severity: 'error' });
    }
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };
  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-[35px]">
      <h2 className="text-2xl font-bold">Company Management</h2>

      <div className="flex justify-between items-center my-6">
        <SearchBar
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          label="Search by Name"
          placeholder="Type company name..."
        />

        <div className="flex gap-3">
          <Button variant="contained" onClick={() => setOpen(true)}>
            Add Company
          </Button>

          <label>
            <input
              type="file"
              id="csv-upload"
              accept=".csv"
              hidden
              onChange={handleUploadCSV}
            />
          </label>
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
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCompanies
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((c, index) => (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{
                      backgroundColor: c.is_active === false ? '#fff9c4' : '#e8f5e9',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
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
                            const fileName = fileUrl.split('/').pop();
                            const ext = fileName?.split('.').pop().toLowerCase();

                            const getIcon = () => {
                              if (ext === 'pdf') return <PictureAsPdfIcon fontSize="small" color="error" />;
                              if (['doc', 'docx'].includes(ext)) return <DescriptionIcon fontSize="small" color="primary" />;
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
                    <TableCell align="center">
                      <IconButton onClick={() => handleEdit(c)} color="primary"><Edit /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          <TablePagination
            component="div"
            count={companies.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
          />
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm"   TransitionComponent={Transition}
  keepMounted    PaperProps={{
          sx: {
            borderRadius: 4,
            p: 3,
            backgroundColor: '#fafafa',
            boxShadow: 10,
            overflowY: 'hidden'
          }
        }}>
        <DialogTitle>{editMode ? 'Edit Company' : 'Add New Company'}</DialogTitle>
      <DialogContent dividers  sx={{ 
          p: 3,
          overflowY: 'auto',
          maxHeight: '60vh', // Set a max height to enable scrolling
          '&::-webkit-scrollbar': {
            display: 'none', // Hide scrollbar for WebKit browsers
          },
          scrollbarWidth: 'none', // Hide scrollbar for Firefox
          '-ms-overflow-style': 'none', // Hide scrollbar for IE/Edge
        }} >
        <Typography variant="subtitle1" sx={{ mb: 1 ,color:'primary.main'}}>Company Details</Typography>
  <Box className="space-y-4">
    {/* Row 1 */}
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
        error={!form.pan || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan)}
        helperText={
          !form.pan
            ? 'PAN is required'
            : !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan) && 'Invalid PAN format'
        }
        onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
      />
    </Box>

    {/* Row 2 */}
    <Box sx={{ display: 'flex', gap: 2 }}>
      <TextField
        label="GSTIN *"
        fullWidth
        value={form.gst}
        error={
          !form.gst ||
          !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst)
        }
        helperText={
          !form.gst
            ? 'GST is required'
            : !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gst) &&
              'Invalid GST format'
        }
        onChange={(e) => setForm({ ...form, gst: e.target.value.toUpperCase() })}
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

    {/* Row 3 - Full width */}
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

    {/* Status */}
    <FormControl component="fieldset" sx={{ mt: 2 }}>
      <FormLabel component="legend">Status</FormLabel>
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

    {/* Uploaded Docs */}
    {editMode && form.documents?.length > 0 && (
   <Box sx={{ mt: 2, mb: 1 }}>
  <Typography variant="subtitle2" sx={{ mb: 1 }}>
    Uploaded Documents
  </Typography>
  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
    {form.documents.map((doc) => {
      const fileUrl = doc.file;
      const fileName = fileUrl.split('/').pop();
      const ext = fileName.split('.').pop().toLowerCase();

      const getIcon = () => {
        if (ext === 'pdf') return <PictureAsPdfIcon fontSize="small" color="error" />;
        if (['doc', 'docx'].includes(ext))
          return <DescriptionIcon fontSize="small" color="primary" />;
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

    {/* File Uploader */}
    <FileUploader
      mode={editMode ? 'edit' : 'add'}
      uploading={uploading}
      selectedFiles={selectedFiles}
      setSelectedFiles={setSelectedFiles}
      onFilesChange={(files) => setSelectedFiles(files)}
      onUpload={(files) => uploadDocuments(selectedId, files)}
    />
  </Box>
</DialogContent>


        <DialogActions>
          <Button onClick={() => cancelForm()}      sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': {
                backgroundColor: '#f1f5f9',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}>Cancel</Button>
          <Button onClick={handleFormSubmit} variant="contained" disabled={loading} sx={{
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
            {loading ? <CircularProgress size={24}    /> : editMode ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

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

      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40" style={{ zIndex: 1600 }}>
          <Card sx={{ p: 4, borderRadius: 4, boxShadow: 6, backgroundColor: 'white' }}>
            <Player autoplay loop={false} src="https://assets2.lottiefiles.com/packages/lf20_jbrw3hcz.json" style={{ height: '150px', width: '150px' }} />
            <Typography align="center" variant="h6" sx={{ mt: 2 }}>
              Company Added!
            </Typography>
          </Card>
        </div>
      )}
    </div>
  );
}