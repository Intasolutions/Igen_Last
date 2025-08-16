import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Table, TableHead, TableBody, TableRow, TableCell,
  Select, FormControl, InputLabel, Stack, Snackbar, Alert, Paper
} from '@mui/material';
import { format } from 'date-fns';
import API from '../../api/axios';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { IconButton, Tooltip } from '@mui/material';


const STATUS_OPTIONS = ['Pending', 'Completed', 'Paid', 'Cancelled'];

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
  }, [contract, open]);

  const fetchMilestones = () => {
    API.get(`contract-milestones/?contract=${contract.id}`)
      .then(res => setMilestones(res.data))
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

  const handleSave = () => {
    if (!formData.milestone_name || !formData.due_date || !formData.amount) {
      showSnackbar("Please fill all required fields: Name, Due Date, Amount", "error");
      return;
    }

    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      showSnackbar("Please enter a valid positive amount", "error");
      return;
    }

    const payload = { ...formData, contract: contract.id, amount: parsedAmount };

    const request = editingId
      ? API.patch(`contract-milestones/${editingId}/`, payload)
      : API.post('contract-milestones/', payload);

    request
      .then(() => {
        fetchMilestones();
        resetForm();
        showSnackbar(editingId ? 'Milestone updated successfully' : 'Milestone added successfully');
      })
      .catch(() => showSnackbar('Failed to save milestone', 'error'));
  };

  const handleEdit = (milestone) => {
    setFormData({
      milestone_name: milestone.milestone_name,
      due_date: milestone.due_date,
      amount: milestone.amount,
      status: milestone.status,
      remarks: milestone.remarks || ''
    });
    setEditingId(milestone.id);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this milestone?')) {
      API.delete(`contract-milestones/${id}/`)
        .then(() => {
          setMilestones(prev => prev.filter(m => m.id !== id));
          if (editingId === id) resetForm();
          showSnackbar('Milestone deleted successfully');
        })
        .catch(() => showSnackbar('Failed to delete milestone', 'error'));
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md"  PaperProps={{ sx: { borderRadius: 3, p: 2 } }}>
        <DialogTitle>
          Manage Milestones for {contract?.vendor_name || 'Contract'}
        </DialogTitle>
        <DialogContent>

          {/* Table */}
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
                {milestones.length > 0 ? milestones.map(m => (
                  <TableRow key={m.id} hover>
                    <TableCell>{m.milestone_name}</TableCell>
                    <TableCell>{m.due_date ? format(new Date(m.due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell>{m.amount?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</TableCell>
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
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No milestones found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          {/* Form */}
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Milestone Name" name="milestone_name" value={formData.milestone_name} onChange={handleChange} fullWidth required />
              <TextField type="date" label="Due Date" name="due_date" value={formData.due_date} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} required />
              <TextField label="Amount" name="amount" type="number" value={formData.amount} onChange={handleChange} fullWidth required />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select name="status" value={formData.status} onChange={handleChange}>
                  {STATUS_OPTIONS.map(status => (
                    <MenuItem key={status} value={status}>{status}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} fullWidth multiline />
            </Stack>
          </Stack>

        </DialogContent>
        <DialogActions>
          <Button onClick={() => { resetForm(); handleClose(); }}>Close</Button>
          <Button variant="contained" onClick={handleSave}>{editingId ? 'Update' : 'Add'} Milestone</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ContractMilestoneDialog;
