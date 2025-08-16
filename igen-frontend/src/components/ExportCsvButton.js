import React from 'react';
import { Button } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export default function ExportCsvButton({ data, headers, filename = 'data.csv' }) {
  const handleExport = () => {
    const csvRows = [
      headers.join(','), // header row
      ...data.map(row =>
        headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      variant="outlined"
      color="success"
      onClick={handleExport}
      startIcon={<UploadFileIcon />}
      sx={{
        borderRadius: 2,
        textTransform: 'none',
        fontWeight: 500,
        px: 2,
        bgcolor: '#e8f5e9',
        '&:hover': { bgcolor: '#c8e6c9' }
      }}
    >
      Export CSV
    </Button>
  );
}
