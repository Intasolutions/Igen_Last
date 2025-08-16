import React, { useEffect, useState } from 'react';
import API from '../../api/axios';
import {
  Button, Table, TableHead, TableBody, TableCell, TableRow, TableContainer,
  Paper, CircularProgress, Typography, Card, CardContent, IconButton, Tooltip,
  TablePagination, Snackbar, Alert
} from '@mui/material';
import { format } from 'date-fns';
import AddContractDialog from './AddContractDialog';
import ContractMilestoneDialog from './ContractMilestoneDialog';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteIcon from '@mui/icons-material/Delete';
import TaskIcon from '@mui/icons-material/Task';
import SearchBar from '../../components/SearchBar';

const ContractManagement = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const filteredContracts = contracts.filter(c =>
    (c.vendor_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (c.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchContracts = () => {
    setLoading(true);
    API.get('contracts/')
      .then((res) => {
        setContracts(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Error fetching contracts:', err);
        setContracts([]);
        showSnackbar('Failed to load contracts.', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const downloadContract = (id, vendorName = '') => {
    API.get(`contracts/${id}/download/`, { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        const filename = vendorName
          ? `${vendorName.replace(/\s+/g, '_')}_contract.pdf`
          : `contract_${id}.pdf`;
        link.href = url;
        link.setAttribute('download', filename);
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

  const handleOpenMilestoneDialog = (contract) => {
    setSelectedContract(contract);
    setMilestoneDialogOpen(true);
  };

  const handleDeleteContract = (id) => {
    if (window.confirm('Are you sure you want to delete this contract?')) {
      API.delete(`contracts/${id}/`)
        .then(() => {
          showSnackbar('Contract deleted successfully.', 'success');
          fetchContracts();
        })
        .catch((err) => {
          console.error('Error deleting contract:', err);
          showSnackbar('Failed to delete contract.', 'error');
        });
    }
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const previewContract = (id) => {
    API.get(`contracts/${id}/download/`, { responseType: 'blob' })
      .then((res) => {
        const file = new Blob([res.data], { type: 'application/pdf' });
        const fileURL = URL.createObjectURL(file);
        window.open(fileURL, '_blank');
        showSnackbar('Preview opened.', 'info');
      })
      .catch((err) => {
        console.error('Failed to preview document', err);
        showSnackbar('Failed to preview document.', 'error');
      });
  };

  return (
    <div className="p-6">
      {/* Header with Search and Add Button */}
      
        <Typography variant="h5" component="h2" fontWeight="bold">
          Contract Management
        </Typography>
        <div className="flex justify-between items-center my-6 gap-4 flex-wrap">
     
          <SearchBar
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            label="Search Contracts"
            placeholder="Search by vendor or description"
          />
          <Button variant="contained" color="primary" onClick={() => setDialogOpen(true)}>
            Add Contract
          </Button>
        
        </div>


      {loading ? (
        <div className="flex justify-center py-10">
          <CircularProgress />
        </div>
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
                    <TableCell>Document</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredContracts.length > 0 ? (
                    filteredContracts
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((contract, index) => (
                        <TableRow
                          key={contract.id}
                          hover
                          sx={{
                            backgroundColor: contract.total_due > 0 ? '#fff8e1' : 'inherit',
                            transition: 'background-color 0.3s ease-in-out',
                            '&:hover': {
                              backgroundColor: contract.total_due > 0 ? '#ffecb3' : '#f5f5f5',
                            },
                          }}
                        >
                          <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                          <TableCell>{contract.vendor_name || '—'}</TableCell>
                          <TableCell>{contract.cost_centre_name || '—'}</TableCell>
                          <TableCell>{contract.entity_name || '—'}</TableCell>
                          <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contract.description || '—'}
                          </TableCell>
                          <TableCell>{contract.contract_date ? format(new Date(contract.contract_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{contract.start_date ? format(new Date(contract.start_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{contract.end_date ? format(new Date(contract.end_date), 'dd/MM/yyyy') : '—'}</TableCell>
                          <TableCell>{contract.total_contract_value ?? 0}</TableCell>
                          <TableCell>{contract.total_paid ?? 0}</TableCell>
                          <TableCell>{contract.total_due ?? 0}</TableCell>
                          <TableCell>
                            {contract.document ? (
                              <Tooltip title="Download Document">
                                <IconButton
                                  color="primary"
                                  size="small"
                                  onClick={() => downloadContract(contract.id, contract.vendor_name || '')}
                                >
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                N/A
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Milestones">
                              <IconButton
                                color="primary"
                                size="small"
                                onClick={() => handleOpenMilestoneDialog(contract)}
                              >
                                <TaskIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Contract">
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => handleDeleteContract(contract.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={13} align="center" sx={{ py: 4 }}>
                        No contracts found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={filteredContracts.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25]}
              />
            </TableContainer>
          </CardContent>
        </Card>
      )}

      <AddContractDialog
        open={dialogOpen}
        handleClose={() => setDialogOpen(false)}
        onContractAdded={() => {
          fetchContracts();
          showSnackbar('Contract added successfully!', 'success');
        }}
      />

      <ContractMilestoneDialog
        open={milestoneDialogOpen}
        handleClose={() => {
          setMilestoneDialogOpen(false);
          fetchContracts();
        }}
        contract={selectedContract}
      />

      {/* Snackbar */}
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
    </div>
  );
};

export default ContractManagement;
