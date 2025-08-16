import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button,
  IconButton, Box
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloseIcon from '@mui/icons-material/Close';

const BulkUploadDialog = ({
  open,
  onClose,
  onFileChange,
  onUpload,
  file,
  sampleLink = '/sample/sample.csv',
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, px: 3, pt: 3, pb: 1 }}>
        Upload File
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Typography variant="body2" mb={2}>
          Add your files or documents here
        </Typography>

        <Box
          component="label"
          htmlFor="file-upload"
          sx={{
            border: '2px dashed #d0a9f5',
            borderRadius: 2,
            backgroundColor: '#faf7ff',
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: '0.2s',
            '&:hover': { backgroundColor: '#f3eaff' }
          }}
        >
          <input
            id="file-upload"
            type="file"
            hidden
            accept=".csv,.docx,.png,.webp,.txt,.zip"
            onChange={onFileChange}
          />
          <UploadFileIcon sx={{ fontSize: 50, color: '#a24dff', mb: 1 }} />
          <Typography variant="body1" fontWeight={500}>
            {file ? file.name : 'Drop your files here, '}
            {!file && (
              <span style={{ color: '#a24dff', cursor: 'pointer', textDecoration: 'underline' }}>
                or click to browse
              </span>
            )}
          </Typography>
        </Box>

        <Box className="flex justify-between mt-2 text-sm text-gray-500">
          <Typography variant="caption">
            Upload format must follow our{' '}
            <a href={sampleLink} download style={{ color: '#a24dff', textDecoration: 'underline' }}>
              sample CSV
            </a>
          </Typography>
          <Typography variant="caption">Max size: 10MB</Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!file}
          onClick={onUpload}
          sx={{
            background: 'linear-gradient(to right, #a24dff, #c06cfc)',
            borderRadius: 3,
            textTransform: 'none',
            fontWeight: 600,
            py: 1.2,
            fontSize: 16,
            '&:hover': {
              background: 'linear-gradient(to right, #9130ff, #b950fc)',
            },
          }}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkUploadDialog;
