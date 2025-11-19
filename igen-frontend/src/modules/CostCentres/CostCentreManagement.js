import React, { useState, useEffect, forwardRef } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Card, CardContent, Typography, IconButton,
  Snackbar, Alert, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, Slide,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { Edit } from '@mui/icons-material';
import SearchBar from '../../components/SearchBar';
import { canCreate, canUpdate } from '../../utils/perm'; // role-aware gating

const Transition = forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// helper to convert dropdown value to query boolean
const statusToIsActive = (status) =>
  status === 'active' ? true : status === 'inactive' ? false : null;

export default function CostCentreManagement() {
  // ---- role gates (evaluate from token/localStorage) ----
  const CAN_ADD  = canCreate('cost_centres'); // SU/ACCOUNTANT
  const CAN_EDIT = canUpdate('cost_centres'); // SU/ACCOUNTANT

  const [companies, setCompanies] = useState([]);
  const [costCentres, setCostCentres] = useState([]);

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [searchQuery, setSearchQuery] = useState('');

  // active/inactive filter ('', 'active', 'inactive')
  const [selectedStatus, setSelectedStatus] = useState('');

  const [form, setForm] = useState({
    company: '',
    name: '',
    transaction_direction: '',
    notes: '',
  });

  const [editForm, setEditForm] = useState({
    cost_centre_id: '',
    company: '',
    name: '',
    transaction_direction: '',
    notes: '',
    is_active: true
  });

  const [formErrors, setFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const fetchCostCentres = async () => {
    try {
      const params = { include_inactive: true };
      const isActive = statusToIsActive(selectedStatus);
      if (isActive !== null) params.is_active = isActive;

      const res = await API.get('cost-centres/', { params });
      setCostCentres(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      setSnackbar({ open: true, message: 'Error fetching cost centres', severity: 'error' });
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      setCompanies(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      setSnackbar({ open: true, message: 'Error fetching companies', severity: 'error' });
    }
  };

  useEffect(() => {
    fetchCostCentres();
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // refetch when status filter changes (server filtering)
  useEffect(() => {
    fetchCostCentres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  const validateForm = (data, isEdit = false) => {
    const errors = {};
    if (!isEdit && !data.company) errors.company = 'Company is required';
    if (!data.name) errors.name = 'Name is required';
    else if (data.name.length > 255) errors.name = 'Name too long (max 255 characters)';
    if (!data.transaction_direction) errors.transaction_direction = 'Transaction direction is required';
    else if (!['Credit', 'Debit', 'Both'].includes(data.transaction_direction)) {
      errors.transaction_direction = 'Invalid transaction direction';
    }
    return errors;
  };

  const defaultForm = {
    company: '',
    name: '',
    transaction_direction: '',
    notes: ''
  };

  const defaultEditForm = {
    cost_centre_id: '',
    company: '',
    name: '',
    transaction_direction: '',
    notes: '',
    is_active: true
  };

  const handleAddCostCentre = async () => {
    if (!CAN_ADD) {
      setSnackbar({ open: true, message: 'You do not have permission to add cost centres.', severity: 'warning' });
      return;
    }
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    try {
      await API.post('cost-centres/', form);
      setSnackbar({ open: true, message: 'Cost Centre added successfully!', severity: 'success' });
      fetchCostCentres();
      setOpen(false);
      setForm(defaultForm);
      setFormErrors({});
    } catch (err) {
      if (err.response?.status === 400) {
        const backendErrors = err.response.data;
        const newFormErrors = { ...formErrors };
        if (backendErrors.name) newFormErrors.name = backendErrors.name[0];
        setFormErrors(newFormErrors);
      } else {
        setSnackbar({
          open: true,
          message: err.response?.data?.detail || 'Failed to add cost centre',
          severity: 'error',
        });
      }
    }
  };

  const handleRealTimeValidation = (field, value, setter, current, setErrors) => {
    const updated = { ...current, [field]: value };
    setter(updated);
    const errors = validateForm(updated, current === editForm);
    setErrors(errors);
  };

  const openEditModal = (costCentre) => {
    if (!CAN_EDIT) return; // hard block if no permission
    setEditForm({
      cost_centre_id: costCentre.cost_centre_id,
      company: costCentre.company,
      name: costCentre.name,
      transaction_direction: costCentre.transaction_direction,
      notes: costCentre.notes,
      is_active: costCentre.is_active
    });
    setEditFormErrors({});
    setEditOpen(true);
  };

  const handleEditCostCentre = async () => {
    if (!CAN_EDIT) {
      setSnackbar({ open: true, message: 'You do not have permission to edit cost centres.', severity: 'warning' });
      return;
    }
    const errors = validateForm(editForm, true);
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }
    try {
      await API.put(`cost-centres/${editForm.cost_centre_id}/`, editForm);
      setSnackbar({ open: true, message: 'Cost Centre updated successfully!', severity: 'success' });
      fetchCostCentres();
      setEditOpen(false);
    } catch (err) {
      if (err.response?.status === 400) {
        const backendErrors = err.response.data;
        const newFormErrors = { ...editFormErrors };
        if (backendErrors.name) {
          newFormErrors.name = backendErrors.name[0];
          setSnackbar({ open: true, message: backendErrors.name[0], severity: 'error' });
        }
        setEditFormErrors(newFormErrors);
      } else {
        setSnackbar({
          open: true,
          message: err.response?.data?.detail || 'Failed to update cost centre',
          severity: 'error',
        });
      }
    }
  };

  // client-side filter on top of server results (keeps UI consistent)
  const filteredcostcenter = costCentres.filter((c) => {
    const matchesText =
      (c.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (c.company_name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
    const matchesStatus =
      selectedStatus === ''
        ? true
        : selectedStatus === 'active'
        ? !!c.is_active
        : !c.is_active;
    return matchesText && matchesStatus;
  });

  return (
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight="bold">Cost Centre Management</Typography>

      {/* Controls row: search on the left; status + add button (gated) on the right */}
      <div className="flex justify-between items-center mb-6 mt-6 gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px] max-w-sm">
          <SearchBar
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            label="Search Cost Centre"
            placeholder="Search by Cost Centre Name or Company"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Status filter (All / Active / Inactive) */}
          <TextField
            select
            size="small"
            label="Status"
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(0); }}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </TextField>

          {CAN_ADD && (
            <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
              Add Cost Centre
            </Button>
          )}
        </div>
      </div>

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Direction</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Notes</TableCell>
                  {CAN_EDIT && (
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredcostcenter
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((c, index) => (
                    <TableRow
                      key={c.cost_centre_id}
                      hover
                      sx={{ backgroundColor: c.is_active ? '#e8f5e9' : '#fffde7' }}
                    >
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell>{c.company_name}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.transaction_direction}</TableCell>
                      <TableCell>{c.notes}</TableCell>
                      {CAN_EDIT && (
                        <TableCell align="center">
                          <Tooltip title="Edit" arrow>
                            <span>
                              <IconButton
                                color="primary"
                                onClick={() => openEditModal(c)}
                                disabled={!CAN_EDIT}
                              >
                                <Edit />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredcostcenter.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
            showFirstButton
            showLastButton
          />
        </CardContent>
      </Card>

      {/* Add Dialog (rendered but only openable if CAN_ADD) */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
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
        <DialogTitle>Add Cost Centre</DialogTitle>
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
          <TextField
            select
            fullWidth
            margin="dense"
            label="Company"
            value={form.company}
            onChange={(e) => handleRealTimeValidation('company', e.target.value, setForm, form, setFormErrors)}
            error={!!formErrors.company}
            helperText={formErrors.company}
          >
            {companies.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            margin="dense"
            label="Name"
            value={form.name}
            onChange={(e) => handleRealTimeValidation('name', e.target.value, setForm, form, setFormErrors)}
            error={Boolean(formErrors.name)}
            helperText={formErrors.name}
          />

          <TextField
            select
            fullWidth
            margin="dense"
            label="Transaction Direction"
            value={form.transaction_direction}
            onChange={(e) => handleRealTimeValidation('transaction_direction', e.target.value, setForm, form, setFormErrors)}
            error={!!formErrors.transaction_direction}
            helperText={formErrors.transaction_direction}
          >
            <MenuItem value="Credit">Credit</MenuItem>
            <MenuItem value="Debit">Debit</MenuItem>
            <MenuItem value="Both">Both</MenuItem>
          </TextField>

          <TextField
            fullWidth
            margin="dense"
            label="Notes"
            multiline
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => {
              setOpen(false);
              setFormErrors({});
              setForm(defaultForm);
            }}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': {
                backgroundColor: '#f1f5f9',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCostCentre}
            sx={{
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
            }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog (rendered but only usable if CAN_EDIT) */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
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
        <DialogTitle>Edit Cost Centre</DialogTitle>
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
          <TextField
            fullWidth
            margin="dense"
            label="Name"
            value={editForm.name}
            onChange={(e) => handleRealTimeValidation('name', e.target.value, setEditForm, editForm, setEditFormErrors)}
            error={!!editFormErrors.name}
            helperText={editFormErrors.name}
          />

          <TextField
            select
            fullWidth
            margin="dense"
            label="Transaction Direction"
            value={editForm.transaction_direction}
            onChange={(e) => handleRealTimeValidation('transaction_direction', e.target.value, setEditForm, editForm, setEditFormErrors)}
            error={!!editFormErrors.transaction_direction}
            helperText={editFormErrors.transaction_direction}
          >
            <MenuItem value="Credit">Credit</MenuItem>
            <MenuItem value="Debit">Debit</MenuItem>
            <MenuItem value="Both">Both</MenuItem>
          </TextField>

          <TextField
            fullWidth
            margin="dense"
            label="Notes"
            multiline
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />

          <FormControl component="fieldset" margin="dense">
            <FormLabel component="legend">Status</FormLabel>
            <RadioGroup
              row
              value={editForm.is_active}
              onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}
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
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => {
              setEditOpen(false);
              setEditFormErrors({});
              setEditForm(defaultEditForm);
            }}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 500,
              color: '#64748b',
              '&:hover': {
                backgroundColor: '#f1f5f9',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEditCostCentre}
            sx={{
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
            }}
          >
            Save
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
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
