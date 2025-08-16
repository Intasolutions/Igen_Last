import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function NavBar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <AppBar position="static" style={{ marginBottom: '20px' }}>
      <Toolbar>
        <Typography
          variant="h6"
          style={{ flexGrow: 1, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          iGen Management
        </Typography>

        {/* Navigation buttons for each module */}
        <Button color="inherit" onClick={() => navigate('/dashboard')}>Dashboard</Button>
        <Button color="inherit" onClick={() => navigate('/users')}>Users</Button>
        <Button color="inherit" onClick={() => navigate('/companies')}>Companies</Button>
        <Button color="inherit" onClick={() => navigate('/banks')}>Banks</Button>
        <Button color="inherit" onClick={() => navigate('/cost-centres')}>Cost Centres</Button>
        <Button color="inherit" onClick={() => navigate('/transaction-types')}>Transaction Types</Button>
        <Button color="inherit" onClick={() => navigate('/transactions')}>Transactions</Button>
        <Button color="inherit" onClick={() => navigate('/projects')}>Projects</Button>
        <Button color="inherit" onClick={() => navigate('/properties')}>Properties</Button>
        <Button color="inherit" onClick={() => navigate('/entities')}>Entities</Button>
        <Button color="inherit" onClick={() => navigate('/receipts')}>Receipts</Button>
        <Button color="inherit" onClick={() => navigate('/assets')}>Assets</Button> {/* ✅ NEW: Assets */}
        
        <Button color="inherit" onClick={handleLogout}>Logout</Button>
      </Toolbar>
    </AppBar>
  );
}
