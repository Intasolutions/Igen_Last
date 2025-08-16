import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Box, Typography, Chip, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';

export default function FileUploader({
  mode = 'add',
  onFilesChange,
  onUpload,
  uploading,
  selectedFiles,
  setSelectedFiles
}) {
const onDrop = (acceptedFiles) => {
  const valid = [];

  for (const file of acceptedFiles) {
    if (file.size > 5 * 1024 * 1024) {
      alert(`${file.name} exceeds 5MB limit`);
    } else {
      valid.push(file);
    }
  }

  if (valid.length === 0) return;

  const updatedFiles = [...selectedFiles, ...valid]; // use props

  setSelectedFiles(updatedFiles); // from props

  // ✅ Pass the updated file list directly to onUpload
  if (mode === 'edit' && typeof onUpload === 'function') {
    onUpload(updatedFiles); // fixed!
  }

  // For add mode
  if (mode === 'add') {
    onFilesChange(updatedFiles);
  }
};



  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Upload New Documents</Typography>

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #90caf9',
          padding: 2,
          borderRadius: 2,
          textAlign: 'center',
          backgroundColor: '#f5f5f5',
          cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.csv" />
        <UploadFileIcon sx={{ fontSize: 40, color: '#90caf9' }} />
        <Typography variant="body2" sx={{ mt: 1 }}>Drag & Drop or Click to Upload</Typography>
      </Box>

      {selectedFiles?.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {selectedFiles.map((file, i) => (
            <Chip
              key={i}
              label={file.name}
              onDelete={() => {
                const updated = selectedFiles.filter((_, index) => index !== i);
                setSelectedFiles(updated);
              }}
              size="small"
            />
          ))}
        </Box>
      )}

      {uploading && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <CircularProgress size={20} />
          <Typography sx={{ ml: 1 }}>Uploading...</Typography>
        </Box>
      )}
    </Box>
  );
}
