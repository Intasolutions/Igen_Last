import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, CardContent, Typography, TextField, MenuItem,
  Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Box, Alert, Stack,Select
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import API from '../../api/axios';

// ---------- helpers ----------
const isDDMMYYYY = (s) => /^\d{2}-\d{2}-\d{4}$/.test(s);
const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const toISODate = (d) => {
  if (!d) return '';
  const s = String(d);
  if (isYYYYMMDD(s)) return s;
  if (isDDMMYYYY(s)) {
    const [dd, mm, yyyy] = s.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const getId = (obj) =>
  obj?.id ?? obj?.entity_id ?? obj?.cost_centre_id ?? obj?.transaction_type_id;

const getName = (obj) =>
  obj?.name ??
  obj?.entity_name ??
  obj?.cost_centre_name ??
  obj?.transaction_type_name ??
  '';

const formatINR = (amount) => {
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  if (!Number.isFinite(n)) return '₹0.00';
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
};

const useParamBuilder = (filters) =>
  useMemo(
    () =>
      (overrides = {}) => {
        const base = { ...filters, ...overrides };
        const normalized = {
          ...base,
          start_date: toISODate(base.start_date),
          end_date: toISODate(base.end_date),
        };
        return Object.fromEntries(
          Object.entries(normalized).filter(
            ([, v]) => v !== '' && v !== null && v !== undefined
          )
        );
      },
    [filters]
  );

// ---------- component ----------
export default function EntityWiseReport() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const firstDayISO = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [filters, setFilters] = useState({
    start_date: firstDayISO,
    end_date: todayISO,
    entity: '',
    cost_centre: '',
    transaction_type: '',
    source: '',
    min_amount: '',
    max_amount: '',
  });

  const buildParams = useParamBuilder(filters);

  const [entities, setEntities] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ total_credit: 0, total_debit: 0, net: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ---------- master data ----------
  useEffect(() => {
    (async () => {
      try {
        const [e, c, t] = await Promise.all([
          API.get('entities/'),
          API.get('cost-centres/'),
          API.get('transaction-types/'),
        ]);
        setEntities(e.data?.results ?? e.data ?? []);
        setCostCentres(c.data?.results ?? c.data ?? []);
        setTransactionTypes(t.data?.results ?? t.data ?? []);
      } catch (err) {
        console.error('Failed to load master data', err);
        setError('Failed to load master data.');
      }
    })();
  }, []);

  // ---------- actions ----------
  const validate = () => {
    if (!filters.start_date || !filters.end_date) {
      setError('Please select both Start Date and End Date.');
      return false;
    }
    const sd = toISODate(filters.start_date);
    const ed = toISODate(filters.end_date);
    if (!sd || !ed) {
      setError('Invalid date(s). Use DD-MM-YYYY or YYYY-MM-DD.');
      return false;
    }
    if (sd > ed) {
      setError('Start Date cannot be after End Date.');
      return false;
    }
    if (!filters.entity) {
      setError('Entity is required.');
      return false;
    }
    setError('');
    return true;
  };

  const fetchReport = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const list = await API.get('reports/entity-report/', {
        params: { ...buildParams(), page_size: 1000 },
      });
      setData(list.data?.results ?? list.data ?? []);

      const sum = await API.get('reports/entity-report/summary/', {
        params: buildParams(),
      });
      setSummary(sum.data ?? { total_credit: 0, total_debit: 0, net: 0 });
    } catch (err) {
      console.error('Error fetching report:', err);
      const detail = err?.response?.data?.detail;
      setError(detail || 'Failed to fetch report.');
      setData([]);
      setSummary({ total_credit: 0, total_debit: 0, net: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!validate()) return;
    try {
      const response = await API.get('reports/entity-report/export/', {
        params: buildParams(),
        responseType: 'blob',
      });
      if (response.status === 204) {
        alert('No data to export.');
        return;
      }
      const cd = response.headers?.['content-disposition'] || '';
      const match = /filename\*?=(?:UTF-8''|")?([^"]+)/i.exec(cd);
      const filename = match ? decodeURIComponent(match[1]) : 'entity_wise_report.xlsx';

      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
    }
  };

  const bindAuto = (list, valueId, onChange) => {
    const selected =
      list.find((item) => String(getId(item)) === String(valueId)) ?? null;
    return {
      options: list,
      value: selected,
      getOptionLabel: (option) => getName(option) || '',
      isOptionEqualToValue: (opt, val) => String(getId(opt)) === String(getId(val)),
      onChange: (_e, val) => onChange(val ? getId(val) : ''),
      renderInput: (params) => <TextField {...params} fullWidth />,
    };
  };

  // ---------- render ----------
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Filter Section */}
<Paper
  elevation={0}
  sx={{
    p: 3,
    mb: 3,
    borderRadius: 4,
    border: '1px solid rgba(0,0,0,0.03)',
    bgcolor: '#ffffff',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    transition: 'all 0.3s ease',
    '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.1)' }
  }}
>
  <Stack
    direction={{ xs: 'column', md: 'row' }}
    spacing={2}
    alignItems="center"
    useFlexGap
    flexWrap="wrap"
    sx={{
      '& > *': {
        transition: 'all 0.2s ease',
        '&:focus-within': {
          transform: 'translateY(-2px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }
    }}
  >
    {/* <Typography variant="h6" className="font-semibold text-gray-800 mb-2 md:mb-0">
      Entity-Wise Ledger Report
    </Typography> */}
    <TextField
      type="date"
      size="small"
      label="Start Date"
      InputLabelProps={{ shrink: true, sx: { color: 'grey.600', fontWeight: 500 } }}
      value={toISODate(filters.start_date)}
      onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
      sx={{
        width: 160,
        '& .MuiInputBase-root': {
          borderRadius: 4,
          bgcolor: '#f5f5f5',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': { bgcolor: '#eceff1' },
          '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
          fontSize: '0.9rem',
          height: 44,
          '& input': { py: 1.4 }
        }
      }}
    />
    <TextField
      type="date"
      size="small"
      label="End Date"
      InputLabelProps={{ shrink: true, sx: { color: 'grey.600', fontWeight: 500 } }}
      value={toISODate(filters.end_date)}
      onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
      sx={{
        width: 160,
        '& .MuiInputBase-root': {
          borderRadius: 4,
          bgcolor: '#f5f5f5',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': { bgcolor: '#eceff1' },
          '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
          fontSize: '0.9rem',
          height: 44,
          '& input': { py: 1.4 }
        }
      }}
    />
    <Autocomplete
      {...bindAuto(entities, filters.entity, (val) =>
        setFilters((f) => ({ ...f, entity: val }))
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Entity"
          required
          error={!filters.entity}
         
          size="small"
          sx={{
            width: 160,
        '& .MuiInputBase-root': {
          borderRadius: 4,
          bgcolor: '#f5f5f5',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': { bgcolor: '#eceff1' },
          '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
          fontSize: '0.9rem',
          height: 44,
          '& input': { py: 1.4 }
        }
      }}
        />
      )}
    />
    <Autocomplete
      {...bindAuto(costCentres, filters.cost_centre, (val) =>
        setFilters((f) => ({ ...f, cost_centre: val }))
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Cost Centre"
          size="small"
          sx={{
            width: 160,
            '& .MuiInputBase-root': {
              borderRadius: 4,
              bgcolor: '#f5f5f5',
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&:hover': { bgcolor: '#eceff1' },
              '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
              fontSize: '0.9rem',
              height: 44,
              '& input': { py: 1.4 }
            },
            '& .MuiInputLabel-root': { color: 'grey.600', fontWeight: 500 }
          }}
        />
      )}
    />
    <Autocomplete
      {...bindAuto(transactionTypes, filters.transaction_type, (val) =>
        setFilters((f) => ({ ...f, transaction_type: val }))
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Transaction Type"
          size="small"
          sx={{
            width: 160,
            '& .MuiInputBase-root': {
              borderRadius: 4,
              bgcolor: '#f5f5f5',
              '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
              '&:hover': { bgcolor: '#eceff1' },
              '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
              fontSize: '0.9rem',
              height: 44,
              '& input': { py: 1.4 }
            },
            '& .MuiInputLabel-root': { color: 'grey.600', fontWeight: 500 }
          }}
        />
      )}
    />
    <Select
      size="small"
      value={filters.source || ''}
      onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
      label="Source" // Added label
      sx={{
        minWidth: 140,
        borderRadius: 4,
        bgcolor: '#f5f5f5',
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '&:hover': { bgcolor: '#eceff1' },
        '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
        fontSize: '0.9rem',
        height: 44,
        '& .MuiSelect-select': { py: 1.4, pl: 2 },
        '& .MuiSvgIcon-root': { color: 'grey.500' }
      }}
    >
      <MenuItem value="" label="Cash/Bank">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round" />
          </svg>
          All
        </Box>
      </MenuItem>
      <MenuItem value="BANK">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Bank
        </Box>
      </MenuItem>
      <MenuItem value="CASH">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="2">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
          Cash
        </Box>
      </MenuItem>
    </Select>
    <TextField
      size="small"
      label="Min Amount"
      value={filters.min_amount}
      onChange={(e) => setFilters((f) => ({ ...f, min_amount: e.target.value }))}
      InputLabelProps={{ sx: { color: 'grey.600', fontWeight: 500 } }}
      sx={{
        width: 140,
        '& .MuiInputBase-root': {
          borderRadius: 4,
          bgcolor: '#f5f5f5',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': { bgcolor: '#eceff1' },
          '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
          fontSize: '0.9rem',
          height: 44,
          '& input': { py: 1.4 }
        }
      }}
    />
    <TextField
      size="small"
      label="Max Amount"
      value={filters.max_amount}
      onChange={(e) => setFilters((f) => ({ ...f, max_amount: e.target.value }))}
      InputLabelProps={{ sx: { color: 'grey.600', fontWeight: 500 } }}
      sx={{
        width: 140,
        '& .MuiInputBase-root': {
          borderRadius: 4,
          bgcolor: '#f5f5f5',
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
          '&:hover': { bgcolor: '#eceff1' },
          '&.Mui-focused': { bgcolor: '#ffffff', boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)' },
          fontSize: '0.9rem',
          height: 44,
          '& input': { py: 1.4 }
        }
      }}
    />
    <Button
      variant="contained"
      onClick={fetchReport}
      disabled={!filters.entity}
      sx={{
        borderRadius: 4,
        bgcolor: '#1976d2',
        '&:hover': { bgcolor: '#1565c0' },
        '&:disabled': { bgcolor: 'grey.400', color: 'grey.800' },
        height: 44,
        px: 3,
        fontWeight: 500,
        fontSize: '0.9rem',
        textTransform: 'none'
      }}
    >
      Apply
    </Button>
    {/* <Button
      variant="outlined"
      onClick={handleExport}
      disabled={!filters.entity}
      sx={{
        borderRadius: 4,
        borderColor: 'grey.300',
        color: '#1976d2',
        bgcolor: '#f5f5f5',
        '&:hover': { bgcolor: '#e3f2fd', borderColor: '#1976d2' },
        '&:disabled': { bgcolor: 'grey.200', color: 'grey.500' },
        height: 44,
        px: 3,
        fontWeight: 500,
        fontSize: '0.9rem',
        textTransform: 'none'
      }}
    >
      Export
    </Button> */}
    <Button
      variant="outlined"
      onClick={() => setFilters({
        start_date: firstDayISO,
        end_date: todayISO,
        entity: '',
        cost_centre: '',
        transaction_type: '',
        source: '',
        min_amount: '',
        max_amount: '',
      })}
      disabled={loading}
      sx={{
        borderRadius: 4,
        borderColor: 'grey.300',
        color: '#424242',
        bgcolor: '#f5f5f5',
        '&:hover': { bgcolor: '#eceff1', borderColor: '#424242' },
        '&:disabled': { bgcolor: 'grey.200', color: 'grey.500' },
        height: 44,
        px: 3,
        fontWeight: 500,
        fontSize: '0.9rem',
        textTransform: 'none'
      }}
    >
      Reset Filters
    </Button>
  </Stack>
  {error && (
    <Stack className="mt-4">
      <Alert severity="error" onClose={() => setError('')} className="rounded-lg shadow-sm bg-red-50">
        {error}
      </Alert>
    </Stack>
  )}
</Paper>
<style jsx>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-in;
  }
`}</style>

      {/* Total Credit/Debit/Net Summary */}
      <Card className="mb-6 shadow-lg rounded-xl animate-fade-in">
        <CardContent className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <Typography variant="subtitle1" className="font-semibold mb-2 sm:mb-0">
              Total Credit: <span className="font-bold">{formatINR(summary.total_credit)}</span>
            </Typography>
            <Typography variant="subtitle1" className="font-semibold mb-2 sm:mb-0">
              Total Debit: <span className="font-bold">{formatINR(summary.total_debit)}</span>
            </Typography>
            <Typography variant="subtitle1" className="font-semibold">
              Net: <span className="font-bold">{formatINR(summary.net)}</span>
            </Typography>
          </div>
        </CardContent>
      </Card>

      {/* Table Section */}
      {loading ? (
        <Box className="flex justify-center py-8">
          <CircularProgress className="text-blue-600" />
        </Box>
      ) : (
        <Card className="shadow-lg rounded-xl animate-fade-in">
          <CardContent>
            {data.length === 0 ? (
              <Typography className="text-center py-4 text-gray-500 font-medium">
                No records found for selected filters.
              </Typography>
            ) : (
              <TableContainer component={Paper} className="shadow-md rounded-lg">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow className="bg-blue-50">
                      <TableCell className="font-bold text-gray-800">Date</TableCell>
                      <TableCell className="font-bold text-gray-800">Source</TableCell>
                      <TableCell className="font-bold text-gray-800" align="right">Amount (Cr)</TableCell>
                      <TableCell className="font-bold text-gray-800" align="right">Amount (Dr)</TableCell>
                      <TableCell className="font-bold text-gray-800">Cost Centre</TableCell>
                      <TableCell className="font-bold text-gray-800">Entity</TableCell>
                      <TableCell className="font-bold text-gray-800">Transaction Type</TableCell>
                      <TableCell className="font-bold text-gray-800">Asset</TableCell>
                      <TableCell className="font-bold text-gray-800">Contract</TableCell>
                      <TableCell className="font-bold text-gray-800">Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.map((row, idx) => {
                      const amt = typeof row.amount === 'number' ? row.amount : parseFloat(row.amount);
                      const credit = amt > 0 ? amt : null;
                      const debit = amt < 0 ? Math.abs(amt) : null;
                      return (
                        <TableRow
                          key={idx}
                          className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.source || '-'}</TableCell>
                          <TableCell align="right">{credit ? formatINR(credit) : '-'}</TableCell>
                          <TableCell align="right">{debit ? formatINR(debit) : '-'}</TableCell>
                          <TableCell>{row.cost_centre_name || row.cost_centre?.name || '-'}</TableCell>
                          <TableCell>{row.entity_name || row.entity?.name || '-'}</TableCell>
                          <TableCell>{row.transaction_type_name || row.transaction_type?.name || '-'}</TableCell>
                          <TableCell>{row.asset_name || row.asset?.name || '-'}</TableCell>
                          <TableCell>{row.contract_name || row.contract?.name || '-'}</TableCell>
                          <TableCell>{row.remarks || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-blue-100 font-bold">
                      <TableCell colSpan={2} className="text-gray-800">
                        Total
                      </TableCell>
                      <TableCell align="right" className="text-gray-800">
                        {formatINR(summary.total_credit)}
                      </TableCell>
                      <TableCell align="right" className="text-gray-800">
                        {formatINR(summary.total_debit)}
                      </TableCell>
                      <TableCell colSpan={6} className="text-gray-800">
                        Net: {formatINR(summary.net)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in;
        }
      `}</style>
    </div>
  );
}