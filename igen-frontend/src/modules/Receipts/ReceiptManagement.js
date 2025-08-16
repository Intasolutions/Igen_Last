// src/pages/ReceiptManagement.js
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem
} from '@mui/material';

export default function ReceiptManagement() {
  const [receipts, setReceipts] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [entities, setEntities] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [banks, setBanks] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [document, setDocument] = useState(null);

  const [form, setForm] = useState({
    transaction_type: '',
    date: '',
    amount: '',
    reference: '',
    entity: '',
    company: '',
    bank: '',
    cost_centre: '',
    notes: ''
  });

  useEffect(() => {
    fetchReceipts();
    fetchTransactionTypes();
    fetchEntities();
    fetchCompanies();
    fetchBanks();
    fetchCostCentres();
  }, []);

  const fetchReceipts = async () => {
    const res = await API.get('receipts/');
    setReceipts(res.data);
  };

  const fetchTransactionTypes = async () => {
    const res = await API.get('transaction-types/?direction=Credit&status=Active');
    setTransactionTypes(res.data);
  };

  const fetchEntities = async () => {
    const res = await API.get('entities/');
    setEntities(res.data);
  };

  const fetchCompanies = async () => {
    const res = await API.get('companies/');
    setCompanies(res.data);
  };

  const fetchBanks = async () => {
    const res = await API.get('banks/');
    setBanks(res.data);
  };

  const fetchCostCentres = async () => {
    const res = await API.get('cost-centres/');
    setCostCentres(res.data);
  };

  const resetForm = () => {
    setForm({
      transaction_type: '',
      date: '',
      amount: '',
      reference: '',
      entity: '',
      company: '',
      bank: '',
      cost_centre: '',
      notes: ''
    });
    setDocument(null);
  };

  const handleSubmit = async () => {
    const formData = new FormData();

    if (form.transaction_type) formData.append('transaction_type_id', form.transaction_type);
    if (form.cost_centre) formData.append('cost_centre_id', form.cost_centre);
    formData.append('amount', form.amount);
    formData.append('date', form.date);
    formData.append('reference', form.reference);
    formData.append('entity', form.entity);
    formData.append('company', form.company);
    formData.append('bank', form.bank);
    formData.append('notes', form.notes);
    if (document) formData.append('document', document);

    try {
      if (editing) {
        await API.put(`receipts/${editing.id}/`, formData);
        alert('Receipt updated');
      } else {
        await API.post('receipts/', formData);
        alert('Receipt added');
      }
      fetchReceipts();
      resetForm();
      setOpen(false);
      setEditing(null);
    } catch (err) {
      console.error(err.response?.data || err);
      alert('Failed to save receipt');
    }
  };

  const handleDeleteReceipt = async (id) => {
    if (!window.confirm('Delete this receipt?')) return;
    try {
      await API.delete(`receipts/${id}/`);
      fetchReceipts();
    } catch (err) {
      alert('Delete failed');
    }
  };

  const openEditDialog = (receipt) => {
    setEditing(receipt);
    setForm({
      transaction_type: receipt.transaction_type_id || '',
      date: receipt.date || '',
      amount: receipt.amount || '',
      reference: receipt.reference || '',
      entity: receipt.entity || '',
      company: receipt.company || '',
      bank: receipt.bank || '',
      cost_centre: receipt.cost_centre_id || '',
      notes: receipt.notes || ''
    });
    setOpen(true);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Receipt Management</h2>
      <Button variant="contained" onClick={() => { resetForm(); setOpen(true); setEditing(null); }}>
        Add New Receipt
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? 'Edit Receipt' : 'Add New Receipt'}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth margin="dense" label="Transaction Type"
            value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
            <MenuItem value="">Select</MenuItem>
            {transactionTypes.map((t) => (
              <MenuItem key={t.transaction_type_id || t.id} value={t.transaction_type_id || t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField fullWidth margin="dense" label="Date (YYYY-MM-DD)"
            value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <TextField fullWidth margin="dense" label="Amount" type="number"
            value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField fullWidth margin="dense" label="Reference"
            value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />

          <TextField select fullWidth margin="dense" label="Entity"
            value={form.entity} onChange={(e) => setForm({ ...form, entity: e.target.value })}>
            <MenuItem value="">Select</MenuItem>
            {entities.map((e) => (
              <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>
            ))}
          </TextField>

          <TextField select fullWidth margin="dense" label="Company"
            value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}>
            <MenuItem value="">Select</MenuItem>
            {companies.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
            ))}
          </TextField>

          <TextField select fullWidth margin="dense" label="Bank"
            value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}>
            <MenuItem value="">Select</MenuItem>
            {banks.map((b) => (
              <MenuItem key={b.id} value={b.id}>{b.bank_name || b.name || `Bank ${b.id}`}</MenuItem>
            ))}
          </TextField>

          <TextField select fullWidth margin="dense" label="Cost Centre"
            value={form.cost_centre} onChange={(e) => setForm({ ...form, cost_centre: e.target.value })}>
            <MenuItem value="">Select</MenuItem>
            {costCentres.map((c) => (
              <MenuItem key={c.cost_centre_id || c.id} value={c.cost_centre_id || c.id}>{c.name}</MenuItem>
            ))}
          </TextField>

          <TextField fullWidth margin="dense" multiline label="Notes"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />

          <input type="file" onChange={(e) => setDocument(e.target.files[0])} style={{ marginTop: 10 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>{editing ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      <table border="1" width="100%" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Reference</th>
            <th>Entity</th>
            <th>Company</th>
            <th>Bank</th>
            <th>Cost Centre</th>
            <th>Notes</th>
            <th>Document</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.transaction_type_name || r.transaction_type}</td>
              <td>{r.date}</td>
              <td>{r.amount}</td>
              <td>{r.reference}</td>
              <td>{r.entity_name || r.entity}</td>
              <td>{r.company_name || r.company}</td>
              <td>{r.bank_name || r.bank}</td>
              <td>{r.cost_centre_name || r.cost_centre}</td>
              <td>{r.notes}</td>
              <td>
                {r.document ? (
                  <a href={r.document} target="_blank" rel="noopener noreferrer">View</a>
                ) : (
                  'No File'
                )}
              </td>
              <td>
                <Button size="small" onClick={() => openEditDialog(r)}>Edit</Button>
                <Button size="small" color="error" onClick={() => handleDeleteReceipt(r.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
