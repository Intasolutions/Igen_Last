import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Grid
} from '@mui/material';

export default function FormDialog({
  open,
  title,
  maxWidth = 'sm',
  onClose,
  onSubmit,
  children,
  actions = {}
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ maxHeight: '75vh', overflowY: 'auto' }}>
        <Grid container spacing={2}>
          {children}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{actions.cancelText || 'Cancel'}</Button>
        <Button variant="contained" onClick={onSubmit}>
          {actions.submitText || 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
