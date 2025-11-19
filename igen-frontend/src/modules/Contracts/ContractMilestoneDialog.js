// src/modules/Contracts/ContractMilestoneDialog.js
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Table, TableHead, TableBody, TableRow, TableCell,
  Select, FormControl, InputLabel, Stack, Snackbar, Alert, Paper, IconButton, Tooltip
} from '@mui/material';
import { format } from 'date-fns';
import API from '../../api/axios';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const STATUS_OPTIONS = ['Pending', 'Completed', 'Paid', 'Cancelled'];

// Normalize various API shapes to an array
const toArray = (d) => {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

// ---- API helpers (nested first, fallback to legacy) ----
const listMilestones = async (contractId) => {
  try {
    const res = await API.get(`contracts/${contractId}/milestones/`);
    return toArray(res.data);
  } catch (err) {
    if (err?.response?.status === 404) {
      // old path: contracts/contract-milestones/?contract=<id>
      const res2 = await API.get(`contracts/contract-milestones/?contract=${contractId}`);
      return toArray(res2.data);
    }
    throw err;
  }
};

const createMilestone = async (contractId, payload) => {
  try {
    await API.post(`contracts/${contractId}/milestones/`, payload);
  } catch (err) {
    if (err?.response?.status === 404) {
      await API.post('contracts/contract-milestones/', payload);
    } else {
      throw err;
    }
  }
};

const updateMilestone = async (contractId, milestoneId, payload) => {
  try {
    await API.patch(`contracts/${contractId}/milestones/${milestoneId}/`, payload);
  } catch (err) {
    if (err?.response?.status === 404) {
      await API.patch(`contracts/contract-milestones/${milestoneId}/`, payload);
    } else {
      throw err;
    }
  }
};

const deleteMilestone = async (contractId, milestoneId) => {
  try {
    await API.delete(`contracts/${contractId}/milestones/${milestoneId}/`);
  } catch (err) {
    if (err?.response?.status === 404) {
      await API.delete(`contracts/contract-milestones/${milestoneId}/`);
    } else {
      throw err;
    }
  }
};

const ContractMilestoneDialog = ({ open, handleClose, contract }) => {
  const [milestones, setMilestones] = useState([]);
  const [formData, setFormData] = useState({
    milestone_name: '',
    due_date: '',
    amount: '',
    status: 'Pending',
    remarks: '',
  });
  const [editingId, setEditingId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (contract?.id && open) {
      fetchMilestones();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract, open]);

  const fetchMilestones = () => {
    listMilestones(contract.id)
      .then(setMilestones)
      .catch(() => showSnackbar('Error fetching milestones', 'error'));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      milestone_name: '',
      due_date: '',
      amount: '',
      status: 'Pending',
      remarks: '',
    });
    setEditingId(null);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSave = async () => {
    if (!formData.milestone_name || !formData.due_date || !formData.amount) {
      showSnackbar('Please fill all required fields: Name, Due Date, Amount', 'error');
      return;
    }

    const parsedAmount = parseFloat(formData.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      showSnackbar('Please enter a valid positive amount', 'error');
      return;
    }

    const payload = {
      ...formData,
      contract: contract.id,      // accepted by fallback legacy path
      amount: parsedAmount,
    };

    try {
      if (editingId) {
        await updateMilestone(contract.id, editingId, payload);
        showSnackbar('Milestone updated successfully');
      } else {
        await createMilestone(contract.id, payload);
        showSnackbar('Milestone added successfully');
      }
      fetchMilestones();
      resetForm();
    } catch {
      showSnackbar('Failed to save milestone', 'error');
    }
  };

  const handleEdit = (m) => {
    setFormData({
      milestone_name: m.milestone_name,
      due_date: m.due_date,           // keep as yyyy-MM-dd for <input type="date" />
      amount: m.amount,
      status: m.status,
      remarks: m.remarks || '',
    });
    setEditingId(m.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this milestone?')) return;
    try {
      await deleteMilestone(contract.id, id);
      setMilestones(prev => prev.filter(m => m.id !== id));
      if (editingId === id) resetForm();
      showSnackbar('Milestone deleted successfully');
    } catch {
      showSnackbar('Failed to delete milestone', 'error');
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3, p: 2 } }}>
        <DialogTitle>Manage Milestones for {contract?.vendor_name || 'Contract'}</DialogTitle>
        <DialogContent>
          <Paper variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#e3f2fd' }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {milestones.length > 0 ? (
                  milestones.map(m => (
                    <TableRow key={m.id} hover>
                      <TableCell>{m.milestone_name}</TableCell>
                      <TableCell>{m.due_date ? format(new Date(m.due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell>
                        {(Number(m.amount) || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </TableCell>
                      <TableCell>{m.status}</TableCell>
                      <TableCell>{m.remarks || '—'}</TableCell>
                      <TableCell>
                        <Tooltip title="Edit Milestone">
                          <IconButton color="primary" size="small" onClick={() => handleEdit(m)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Milestone">
                          <IconButton color="error" size="small" onClick={() => handleDelete(m.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No milestones found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Milestone Name"
                name="milestone_name"
                value={formData.milestone_name}
                onChange={handleChange}
                fullWidth
                required
              />
              <TextField
                type="date"
                label="Due Date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
                required
              />
              <TextField
                label="Amount"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                fullWidth
                required
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select name="status" value={formData.status} onChange={handleChange} label="Status">
                  {STATUS_OPTIONS.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                fullWidth
                multiline
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { resetForm(); handleClose(); }}>Close</Button>
          <Button variant="contained" onClick={handleSave}>
            {editingId ? 'Update' : 'Add'} Milestone
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
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
    </>
  );
};

export default ContractMilestoneDialog;
