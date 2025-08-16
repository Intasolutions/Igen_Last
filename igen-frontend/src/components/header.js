import React, { useState } from 'react';
import {
  AppBar, Toolbar, Box, Avatar, IconButton,
  Menu, MenuItem, Tooltip, Typography, Divider, ListItemIcon
} from '@mui/material';
import { styled } from '@mui/material/styles';

import LogoutIcon from '@mui/icons-material/Logout';


const IconBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  paddingRight: 16,
}));

export default function Header({ darkMode, setDarkMode, user = { name: 'Admin', role: 'SUPER_USER' } }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleAvatarClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleMenuClose();
    console.log('Logging out...');
    // Insert logout logic here
  };

  return (
    <AppBar position="static" elevation={0} sx={{
      backgroundColor: 'transparent',
      boxShadow: 'none',
      py: 1
    }}>
     <Toolbar sx={{
  display: 'flex',
  justifyContent: 'space-between', // Changed from flex-end to space-between
  alignItems: 'center',
  borderRadius: 3,
  background: '#1f2937',
  mx: 2,
  px: 3,
  py: 1,
  boxShadow: '0px 2px 10px rgba(0,0,0,0.05)'
}}>
  {/* Logo on the left */}
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    <img src="/logo/igen2.png" alt="Logo" style={{ width:50, height:50 }} /> {/* ✅ Replace with actual logo path */}
  </Box>

  {/* Avatar and Menu on the right */}
  <IconBox>
    <Tooltip title="Account">
      <IconButton onClick={handleAvatarClick}>
        <Avatar src="https://i.pravatar.cc/300" alt="profile" sx={{ width: 40, height: 40 }} />
      </IconButton>
    </Tooltip>
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{ sx: { minWidth: 200 } }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" fontWeight="bold">{user.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
          {user.role.replace('_', ' ').toLowerCase()}
        </Typography>
      </Box>
      <Divider />
      <MenuItem onClick={handleLogout}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        Logout
      </MenuItem>
    </Menu>
  </IconBox>
</Toolbar>

    </AppBar>
  );
}
