// src/modules/Contracts/ContractManagement.js
import React, { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Button, Table, TableHead, TableBody, TableCell, TableRow, TableContainer,
  Paper, CircularProgress, Typography, Card, CardContent, IconButton, Tooltip,
  TablePagination, Snackbar, Alert, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, RadioGroup, Radio, FormControlLabel, Divider, Box, Stack,
  TextField, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import AddContractDialog from './AddContractDialog';
import ContractMilestoneDialog from './ContractMilestoneDialog';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import TaskIcon from '@mui/icons-material/Task';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import SearchBar from '../../components/SearchBar';
import FileUploader from '../../components/FileUploader';
import { canCreate, canUpdate } from '../../utils/perm';

// ---------- helpers ----------
const toArray = (d) => {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};
const deriveIsActive = (row) => {
  if (typeof row?.is_active === 'boolean') return row.is_active;
  if (row?.status) return String(row.status).toLowerCase() === 'active';
  return true;
};
const inr = (n) => `₹ ${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function ContractManagement() {
  const CAN_ADD  = canCreate('contracts');
  const CAN_EDIT = canUpdate('contracts');

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editStatus, setEditStatus] = useState('active'); // active | inactive
  const [editForm, setEditForm] = useState({
    vendor: '',
    cost_centre: '',
    entity: '',
    description: '',
    contract_date: '',
    start_date: '',
    end_date: '',
  });
  const [editFiles, setEditFiles] = useState([]);

  // masters for selects
  const [vendors, setVendors] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [entities, setEntities] = useState([]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  const filtered = contracts.filter(c =>
    (c.vendor_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ---------- data ----------
  const fetchContracts = () => {
    setLoading(true);
    API.get('contracts/')
      .then((res) => setContracts(toArray(res.data)))
      .catch((err) => {
        console.error('Error fetching contracts:', err);
        setContracts([]);
        showSnackbar('Failed to load contracts.', 'error');
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { fetchContracts(); }, []);

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const downloadContract = (id, vendorName = '') => {
    API.get(`contracts/${id}/download/`, { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download',
          vendorName ? `${vendorName.replace(/\s+/g, '_')}_contract.pdf` : `contract_${id}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSnackbar('Document downloaded successfully.', 'success');
      })
      .catch((err) => {
        console.error('Download failed', err);
        showSnackbar('Failed to download document.', 'error');
      });
  };

  const previewContract = (id) => {
    API.get(`contracts/${id}/download/`, { responseType: 'blob' })
      .then((res) => {
        const file = new Blob([res.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        window.open(fileURL, '_blank');
        showSnackbar('Preview opened.', 'info');
      })
      .catch((err) => { console.error('Preview failed', err); showSnackbar('Failed to preview document.', 'error'); });
  };

  const handleOpenMilestoneDialog = (contract) => {
    if (!CAN_EDIT) { showSnackbar('You do not have permission to manage milestones.', 'warning'); return; }
    setSelectedContract(contract);
    setMilestoneDialogOpen(true);
  };

  const handleDeleteContract = (id) => {
    if (!CAN_EDIT) { showSnackbar('You do not have permission to delete contracts.', 'warning'); return; }
    if (window.confirm('Are you sure you want to delete this contract?')) {
      API.delete(`contracts/${id}/`)
        .then(() => { showSnackbar('Contract deleted successfully.', 'success'); fetchContracts(); })
        .catch((err) => { console.error('Error deleting contract:', err); showSnackbar('Failed to delete contract.', 'error'); });
    }
  };

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); };

  // ---------- edit dialog ----------
  const loadMastersIfNeeded = async () => {
    try {
      if (!vendors.length) {
        const v = await API.get('vendors/');
        setVendors(toArray(v.data));
      }
      if (!costCentres.length) {
        const cc = await API.get('cost-centres/');
        setCostCentres(toArray(cc.data));
      }
      if (!entities.length) {
        const en = await API.get('entities/');
        setEntities(toArray(en.data));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openEdit = async (row) => {
    if (!CAN_EDIT) { showSnackbar('You do not have permission to edit.', 'warning'); return; }
    setEditRow(row);
    setEditStatus(deriveIsActive(row) ? 'active' : 'inactive');
    setEditFiles([]);
    setEditForm({
      vendor: row.vendor ?? '',
      cost_centre: row.cost_centre ?? '',
      entity: row.entity ?? '',
      description: row.description ?? '',
      contract_date: row.contract_date ?? '',
      start_date: row.start_date ?? '',
      end_date: row.end_date ?? '',
    });
    await loadMastersIfNeeded();
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    const wantActive = editStatus === 'active';
    const hasFile = editFiles && editFiles.length > 0;

    try {
      if (hasFile) {
        const fd = new FormData();
        fd.append('is_active', wantActive);
        // If your API uses string status instead of boolean:
        // fd.append('status', wantActive ? 'Active' : 'Inactive');

        if (editForm.vendor) fd.append('vendor', parseInt(editForm.vendor, 10));
        if (editForm.cost_centre) fd.append('cost_centre', parseInt(editForm.cost_centre, 10));
        if (editForm.entity) fd.append('entity', parseInt(editForm.entity, 10));
        if (typeof editForm.description === 'string') fd.append('description', editForm.description.trim());
        if (editForm.contract_date) fd.append('contract_date', editForm.contract_date);
        if (editForm.start_date) fd.append('start_date', editForm.start_date);
        if (editForm.end_date) fd.append('end_date', editForm.end_date);
        fd.append('document', editFiles[0]);

        await API.patch(`contracts/${editRow.id}/`, fd);
      } else {
        const payload = {
          is_active: wantActive,
          // status: wantActive ? 'Active' : 'Inactive',
        };
        if (editForm.vendor) payload.vendor = parseInt(editForm.vendor, 10);
        if (editForm.cost_centre) payload.cost_centre = parseInt(editForm.cost_centre, 10);
        if (editForm.entity) payload.entity = parseInt(editForm.entity, 10);
        if (typeof editForm.description === 'string') payload.description = editForm.description.trim();
        if (editForm.contract_date) payload.contract_date = editForm.contract_date;
        if (editForm.start_date) payload.start_date = editForm.start_date;
        if (editForm.end_date) payload.end_date = editForm.end_date;

        await API.patch(`contracts/${editRow.id}/`, payload);
      }

      showSnackbar('Contract updated.', 'success');
      setEditOpen(false);
      setEditRow(null);
      fetchContracts();
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to update contract.', 'error');
    }
  };

  return (
    <div className="p-6">
      <Typography variant="h5" component="h2" fontWeight="bold">Contract Management</Typography>

      <div className="flex justify-between items-center my-6 gap-4 flex-wrap">
        <SearchBar
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          label="Search Contracts"
          placeholder="Search by vendor or description"
        />
        {CAN_ADD && (
          <Button variant="contained" color="primary" onClick={() => setDialogOpen(true)}>
            Add Contract
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><CircularProgress /></div>
      ) : (
        <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
          <CardContent>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Cost Centre</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Contract Date</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Total Value</TableCell>
                    <TableCell>Paid</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Document</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.length > 0 ? (
                    filtered
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((c, index) => (
                        <TableRow key={c.id} hover>
                          <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                          <TableCell>{c.vendor_name || '—'}</TableCell>
                          <TableCell>{c.cost_centre_name || '—'}</TableCell>
                          <TableCell>{c.entity_name || '—'}</TableCell>
                          <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.description || '—'}
                          </TableCell>
                          <TableCell>{c.contract_date ? format(new Date(c.contract_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{c.start_date ? format(new Date(c.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{c.end_date ? format(new Date(c.end_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{inr(c.total_contract_value)}</TableCell>
                          <TableCell>{inr(c.total_paid)}</TableCell>
                          <TableCell>{inr(c.total_due)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={deriveIsActive(c) ? 'Active' : 'Inactive'}
                              color={deriveIsActive(c) ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {c.document ? (
                              <Tooltip title="Download Document">
                                <IconButton color="primary" size="small" onClick={() => downloadContract(c.id, c.vendor_name || '')}>
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">N/A</Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View">
                              <IconButton color="primary" size="small" onClick={() => navigate(`/contracts/${c.id}`)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {CAN_EDIT && (
                              <Tooltip title="Milestones">
                                <IconButton color="primary" size="small" onClick={() => handleOpenMilestoneDialog(c)}>
                                  <TaskIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            {CAN_EDIT && (
                              <Tooltip title="Edit">
                                <IconButton color="primary" size="small" onClick={() => openEdit(c)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            
      
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={14} align="center" sx={{ py: 4 }}>
                        No contracts found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={(_e, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[5, 10, 25]}
              />
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Add Contract */}
      <AddContractDialog
        open={dialogOpen}
        handleClose={() => setDialogOpen(false)}
        onContractAdded={() => { fetchContracts(); showSnackbar('Contract added successfully!', 'success'); }}
        readOnly={!CAN_ADD}
      />

      {/* Milestones */}
      <ContractMilestoneDialog
        open={milestoneDialogOpen}
        handleClose={() => { setMilestoneDialogOpen(false); fetchContracts(); }}
        contract={selectedContract}
        readOnly={!CAN_EDIT}
      />

      {/* Edit dialog — DIRECTLY EDITABLE */}
      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditRow(null); }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 4, p: 3, backgroundColor: '#fafafa', boxShadow: 10, overflowY: 'hidden' } }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1.5rem', color: '#1e293b' }}>
          Edit Contract
        </DialogTitle>
        <DialogContent
          sx={{ p: 3, overflowY: 'auto', maxHeight: '70vh',
                '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none', '-ms-overflow-style': 'none' }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
            <Typography variant="subtitle2" sx={{ color: '#475569' }}>Status</Typography>
            <RadioGroup row value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              <FormControlLabel value="active" control={<Radio />} label="Active" />
              <FormControlLabel value="inactive" control={<Radio />} label="Inactive" />
            </RadioGroup>

            <Divider sx={{ my: 1 }} />

            {/* Editable fields */}
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Vendor</InputLabel>
                  <Select
                    label="Vendor"
                    value={editForm.vendor}
                    onChange={(e) => setEditForm((p) => ({ ...p, vendor: e.target.value }))}
                  >
                    {vendors.map(v => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.vendor_name ?? v.name ?? `Vendor ${v.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Cost Centre</InputLabel>
                  <Select
                    label="Cost Centre"
                    value={editForm.cost_centre}
                    onChange={(e) => setEditForm((p) => ({ ...p, cost_centre: e.target.value }))}
                  >
                    {costCentres.map(cc => (
                      <MenuItem key={cc.cost_centre_id ?? cc.id} value={cc.cost_centre_id ?? cc.id}>
                        {cc.name ?? cc.code ?? `CC ${cc.id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <FormControl fullWidth>
                <InputLabel>Entity</InputLabel>
                <Select
                  label="Entity"
                  value={editForm.entity}
                  onChange={(e) => setEditForm((p) => ({ ...p, entity: e.target.value }))}
                >
                  {entities.map(en => (
                    <MenuItem key={en.id} value={en.id}>
                      {en.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Description"
                fullWidth
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  type="date"
                  label="Contract Date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  value={editForm.contract_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, contract_date: e.target.value }))}
                />
                <TextField
                  type="date"
                  label="Start Date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  value={editForm.start_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, start_date: e.target.value }))}
                />
                <TextField
                  type="date"
                  label="End Date"
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  value={editForm.end_date}
                  onChange={(e) => setEditForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </Stack>

              {/* Optional: upload a replacement document */}
              <FileUploader
                mode="add"
                selectedFiles={editFiles}
                setSelectedFiles={setEditFiles}
                onFilesChange={setEditFiles}
              />
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => { setEditOpen(false); setEditRow(null); }}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 500, color: '#64748b',
              '&:hover': { backgroundColor: '#f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveEdit} disabled={!CAN_EDIT}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 500, backgroundColor: '#2196f3',
              boxShadow: '0 4px 12px rgba(33,150,243,0.4)', '&:hover': { backgroundColor: '#1976d2', boxShadow: '0 6px 16px rgba(33,150,243,0.5)' } }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant="filled" sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
