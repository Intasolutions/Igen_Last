import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Card, CardContent, Typography, IconButton,
  Snackbar, Alert, Tooltip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
  Switch, Chip, Box
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import SearchBar from '../../components/SearchBar';

export default function TransactionTypeManagement() {
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [filteredTransactionTypes, setFilteredTransactionTypes] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [open, setOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');

  const defaultForm = {
    company: '',
    cost_centre: '',
    name: '',
    direction: '',
    gst_applicable: false,
    is_active: true,
    remarks: ''
  };

  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchTransactionTypes();
    fetchCompanies();
    fetchCostCentres();
  }, []);

  useEffect(() => {
    // Filter transaction types based on search query
    const filtered = transactionTypes.filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.cost_centre_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredTransactionTypes(filtered);
    setPage(0); // Reset to first page when filtering
  }, [searchQuery, transactionTypes]);

  const fetchTransactionTypes = async () => {
    try {
      const res = await API.get('transaction-types/');
      // Map status to is_active for internal use
      const mappedData = res.data.map(t => ({
        ...t,
        is_active: t.status === 'Active'
      }));
      setTransactionTypes(mappedData);
      setFilteredTransactionTypes(mappedData);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error fetching transaction types', severity: 'error' });
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await API.get('companies/');
      setCompanies(res.data);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error fetching companies', severity: 'error' });
    }
  };

  const fetchCostCentres = async () => {
    try {
      const res = await API.get('cost-centres/');
      setCostCentres(res.data);
    } catch (err) {
      setSnackbar({ open: true, message: 'Error fetching cost centres', severity: 'error' });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!form.company) newErrors.company = 'Company is required';
    if (!form.cost_centre) newErrors.cost_centre = 'Cost Centre is required';
    if (!form.name) newErrors.name = 'Name is required';
    else if (form.name.length > 255) newErrors.name = 'Name too long (max 255 characters)';
    if (!form.direction) newErrors.direction = 'Direction is required';
    else if (!['Credit', 'Debit'].includes(form.direction)) newErrors.direction = 'Invalid direction';
    if (typeof form.is_active !== 'boolean') newErrors.is_active = 'Status must be Active or Inactive';

    // Check for duplicate under same company
    const duplicate = transactionTypes.find(t =>
      t.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
      t.company === form.company &&
      (!isEditMode || t.transaction_type_id !== editId)
    );
    if (duplicate) {
      newErrors.name = 'A transaction type with the same name under the same company already exists';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRealTimeValidation = (field, value) => {
    const updatedForm = { ...form, [field]: value };
    setForm(updatedForm);
    const newErrors = {};

    if (!updatedForm.company) newErrors.company = 'Company is required';
    if (!updatedForm.cost_centre) newErrors.cost_centre = 'Cost Centre is required';
    if (!updatedForm.name) newErrors.name = 'Name is required';
    else if (updatedForm.name.length > 255) newErrors.name = 'Name too long (max 255 characters)';
    if (!updatedForm.direction) newErrors.direction = 'Direction is required';
    else if (!['Credit', 'Debit'].includes(updatedForm.direction)) newErrors.direction = 'Invalid direction';
    if (typeof updatedForm.is_active !== 'boolean') newErrors.is_active = 'Status must be Active or Inactive';

    const duplicate = transactionTypes.find(t =>
      t.name.trim().toLowerCase() === updatedForm.name.trim().toLowerCase() &&
      t.company === updatedForm.company &&
      (!isEditMode || t.transaction_type_id !== editId)
    );
    if (duplicate) {
      newErrors.name = 'A transaction type with the same name under the same company already exists';
    }

    setErrors(newErrors);
  };

  const handleSubmitTransactionType = async () => {
    if (!validateForm()) return;

    try {
      // Map is_active to status for API
      const payload = {
        ...form,
        status: form.is_active ? 'Active' : 'Inactive'
      };
      delete payload.is_active;

      if (isEditMode) {
        await API.put(`transaction-types/${editId}/`, payload);
        setSnackbar({ open: true, message: 'Transaction Type updated successfully', severity: 'success' });
      } else {
        await API.post('transaction-types/', payload);
        setSnackbar({ open: true, message: 'Transaction Type added successfully', severity: 'success' });
      }
      fetchTransactionTypes();
      setOpen(false);
      resetForm();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.detail || 'Operation failed', severity: 'error' });
    }
  };

  const resetForm = () => {
    setForm(defaultForm);
    setErrors({});
    setIsEditMode(false);
    setEditId(null);
  };

  const deleteTransactionType = async (id) => {
    try {
      await API.delete(`transaction-types/${id}/`);
      setSnackbar({ open: true, message: 'Transaction Type deleted (soft)', severity: 'success' });
      fetchTransactionTypes();
    } catch (err) {
      setSnackbar({ open: true, message: 'Delete failed', severity: 'error' });
    }
  };

  const openEditDialog = (transaction) => {
    setForm({
      company: transaction.company,
      cost_centre: transaction.cost_centre,
      name: transaction.name,
      direction: transaction.direction,
      gst_applicable: transaction.gst_applicable,
      is_active: transaction.status === 'Active',
      remarks: transaction.remarks || ''
    });
    setEditId(transaction.transaction_type_id);
    setIsEditMode(true);
    setOpen(true);
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <div className="p-[25px]">
       <Typography variant="h5" fontWeight="bold">Transaction Type Management</Typography>
      <div className="flex justify-between items-center mb-6 mt-6">
       
        <div className="flex-1 max-w-sm">
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, or cost centre..."
          />
          </div>
          <Button variant="contained" color="primary" onClick={() => { setOpen(true); resetForm(); }}>
            Add Transaction Type
          </Button>
        
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>
          {isEditMode ? 'Edit Transaction Type' : 'Add Transaction Type'}
        </DialogTitle>
        <DialogContent sx={{ px: 3, py: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1, color: 'primary.main' }}>
            Transaction Type Details
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, }}>
            <TextField
              select
              fullWidth
              label="Company"
              sx={{ my: 1.5 }}
              value={form.company}
              onChange={(e) => handleRealTimeValidation('company', e.target.value)}
              error={!!errors.company}
              helperText={errors.company}
            >
              {companies.map(c => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Cost Centre"
              sx={{ my: 1.5 }}
              value={form.cost_centre}
              onChange={(e) => handleRealTimeValidation('cost_centre', e.target.value)}
              error={!!errors.cost_centre}
              helperText={errors.cost_centre}
            >
              {costCentres.map(cc => (
                <MenuItem key={cc.cost_centre_id} value={cc.cost_centre_id}>{cc.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Name"
              sx={{ my: 1.5 }}
              value={form.name}
              onChange={(e) => handleRealTimeValidation('name', e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
            />

            <TextField
              fullWidth
              label="Remarks"
              sx={{ my: 1.5 }}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              multiline
            />
          </Box>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: 20 }}>
            <TextField
              select
              label="Direction"
              value={form.direction}
              onChange={(e) => handleRealTimeValidation('direction', e.target.value)}
              error={!!errors.direction}
              helperText={errors.direction}
              sx={{ flex: 1 }}
            >
              <MenuItem value="Credit">Credit</MenuItem>
              <MenuItem value="Debit">Debit</MenuItem>
            </TextField>

            <FormControlLabel
              control={
                <Switch
                  checked={form.gst_applicable}
                  onChange={(e) => setForm({ ...form, gst_applicable: e.target.checked })}
                  color="success"
                />
              }
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  GST Applicable
                  <Tooltip title="Toggle if GST is applicable to this transaction type">
                    <span style={{ fontSize: '16px', cursor: 'help' }}>🛈</span>
                  </Tooltip>
                </div>
              }
              sx={{ mt: 1 }}
            />
          </div>

          <FormControl component="fieldset" margin="dense" sx={{ mt: 2 }}>
            <FormLabel component="legend">Status</FormLabel>
            <RadioGroup
              row
              value={form.is_active}
              onChange={(e) => {
                console.log('Setting is_active to:', e.target.value === 'true');
                setForm({ ...form, is_active: e.target.value === 'true' });
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
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            onClick={() => {
              setOpen(false);
              setErrors({});
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
            onClick={handleSubmitTransactionType}
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
            {isEditMode ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Card sx={{ boxShadow: 3, borderRadius: 3 }}>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ backgroundColor: '#e3f2fd' }}>
                <TableRow>
                  <TableCell><strong>#</strong></TableCell>
                  <TableCell><strong>Company</strong></TableCell>
                  <TableCell><strong>Cost Centre</strong></TableCell>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell><strong>Direction</strong></TableCell>
                  <TableCell><strong>GST</strong></TableCell>
                  <TableCell><strong>Remarks</strong></TableCell>
                  <TableCell align="center"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactionTypes.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((t, index) => (
                  <TableRow
                    key={t.transaction_type_id || index}
                    sx={{
                      backgroundColor: t.status === 'Active' ? '#e8f5e9' : '#fffde7',
                      transition: 'background-color 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: t.status === 'Active' ? '#c8e6c9' : '#fff9c4'
                      }
                    }}
                  >
                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                    <TableCell>{t.company_name}</TableCell>
                    <TableCell>{t.cost_centre_name}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.direction}</TableCell>
                    <TableCell>
                      <Chip label={t.gst_applicable ? 'Yes' : 'No'} color={t.gst_applicable ? 'success' : 'error'} size="small" />
                    </TableCell>
                    <TableCell>{t.remarks}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit">
                        <IconButton color="primary" onClick={() => openEditDialog(t)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      {/* <Tooltip title="Delete">
                        <IconButton color="error" onClick={() => deleteTransactionType(t.transaction_type_id)}>
                          <Delete />
                        </IconButton>
                      </Tooltip> */}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTransactionTypes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center">No data found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredTransactionTypes.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
            />
          </TableContainer>
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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