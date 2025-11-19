// src/modules/Contracts/ContractDetails.js
import React, { useEffect, useState, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, CardContent, Typography, Stack, Divider, Button,
  Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Tooltip, CircularProgress, Snackbar, Alert
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { format } from 'date-fns';
import API from '../../api/axios';

const currency = (n) =>
  (Number(n) || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });

const toArray = (d) => {
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

export default function ContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [contract, setContract] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const load = async () => {
    try {
      setLoading(true);
      const [cRes, mRes] = await Promise.all([
        API.get(`contracts/${id}/`),
        API.get(`contract-milestones/?contract=${id}`),
      ]);
      setContract(cRes.data);
      setMilestones(toArray(mRes.data));
    } catch (err) {
      console.error(err);
      showSnackbar('Failed to load contract details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await API.get(`contracts/${id}/download/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contract?.vendor_name || 'contract'}_${id}.pdf`;
      a.click();
      showSnackbar('Document downloaded.', 'success');
    } catch (err) {
      console.error(err);
      showSnackbar('No document found or download failed.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center py-10">
        <CircularProgress />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-6">
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={load}>
            Retry
          </Button>
        </Stack>
        <Typography variant="h6">Contract not found.</Typography>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="p-6">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight="bold">
            Contract Summary — {contract.vendor_name || '—'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
              Back
            </Button>
            <Button startIcon={<RefreshIcon />} onClick={load}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {/* Overview */}
        <Card sx={{ borderRadius: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Contract Overview
            </Typography>

            <Stack spacing={0.5} sx={{ mb: 1 }}>
              <Typography>Vendor: <b>{contract.vendor_name || '—'}</b></Typography>
              <Typography>Cost Centre: <b>{contract.cost_centre_name || '—'}</b></Typography>
              <Typography>Entity: <b>{contract.entity_name || '—'}</b></Typography>
              <Typography>Description: <b>{contract.description || '—'}</b></Typography>
              <Typography>
                Contract Date: <b>{contract.contract_date ? format(new Date(contract.contract_date), 'dd/MM/yyyy') : '—'}</b>{'  '}
                Start Date: <b>{contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '—'}</b>{'  '}
                End Date: <b>{contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : '—'}</b>
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography>
                {contract.document ? 'View / Download Contract' : 'No document uploaded'}
              </Typography>
              {contract.document && (
                <Tooltip title="Download Document">
                  <IconButton size="small" color="primary" onClick={handleDownload}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Milestones + Totals */}
        <Card sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Payment Milestones
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Due Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {milestones.length ? (
                  milestones.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell>{m.milestone_name}</TableCell>
                      <TableCell>{m.due_date ? format(new Date(m.due_date), 'dd/MM/yyyy') : '—'}</TableCell>
                      <TableCell>{currency(m.amount)}</TableCell>
                      <TableCell>{m.status}</TableCell>
                      <TableCell>{m.remarks || '—'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No milestones yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={0.5}>
              <Typography>Total Contract Value: <b>{currency(contract.total_contract_value)}</b></Typography>
              <Typography>Total Paid: <b>{currency(contract.total_paid)}</b></Typography>
              <Typography>Total Due: <b>{currency(contract.total_due)}</b></Typography>
            </Stack>
          </CardContent>
        </Card>
      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
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
    </Fragment>
  );
}
