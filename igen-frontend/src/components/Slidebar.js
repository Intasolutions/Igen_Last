import React, { useRef, useEffect, useState } from 'react';
import {
  Drawer, List, ListItem, ListItemIcon, ListItemText, Tooltip,
} from '@mui/material';
import {
  Dashboard, People, Business, AccountBalance, Category,
  ReceiptLong, Logout, Assignment, Apartment, BusinessCenter,
  Receipt, Inventory, Contacts, Store, Gavel, Assessment,
  UploadFile, // Bank Uploads
  Rule,       // ✅ NEW: icon for Review & Classify
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';

const allMenuItems = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard', roles: ['SUPER_USER', 'CENTER_HEAD', 'ACCOUNTANT'] },
  { text: 'Users', icon: <People />, path: '/users', roles: ['SUPER_USER'] },
  { text: 'Companies', icon: <Business />, path: '/companies', roles: ['SUPER_USER'] },
  { text: 'Banks', icon: <AccountBalance />, path: '/banks', roles: ['SUPER_USER', 'ACCOUNTANT'] },
    { text: 'Bank Uploads', icon: <UploadFile />, path: '/bank-uploads', roles: ['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD'] },
  { text: 'Cost Centres', icon: <Category />, path: '/cost-centres', roles: ['SUPER_USER', 'ACCOUNTANT'] },
  { text: 'Transaction Types', icon: <ReceiptLong />, path: '/transaction-types', roles: ['SUPER_USER', 'ACCOUNTANT'] },
    { text: 'Review & Classify', icon: <Rule />, path: '/tx-classify', roles: ['SUPER_USER', 'ACCOUNTANT', 'CENTER_HEAD'] },
  // { text: 'Transactions', icon: <Assignment />, path: '/transactions', roles: ['SUPER_USER', 'ACCOUNTANT'] },
  { text: 'Projects', icon: <Assignment />, path: '/projects', roles: ['SUPER_USER', 'CENTER_HEAD'] },
  { text: 'Properties', icon: <Apartment />, path: '/properties', roles: ['SUPER_USER', 'CENTER_HEAD', 'PROPERTY_MANAGER'] },
  { text: 'Entities', icon: <BusinessCenter />, path: '/entities', roles: ['SUPER_USER'] },
  // { text: 'Receipts', icon: <Receipt />, path: '/receipts', roles: ['SUPER_USER', 'ACCOUNTANT'] },
  { text: 'Assets', icon: <Inventory />, path: '/assets', roles: ['SUPER_USER', 'CENTER_HEAD', 'PROPERTY_MANAGER'] },
  { text: 'Contacts', icon: <Contacts />, path: '/contacts', roles: ['SUPER_USER', 'CENTER_HEAD'] },
  { text: 'Vendors', icon: <Store />, path: '/vendors', roles: ['SUPER_USER', 'PROPERTY_MANAGER'] },
  { text: 'Contracts', icon: <Gavel />, path: '/contracts', roles: ['SUPER_USER', 'ACCOUNTANT', 'PROPERTY_MANAGER'] },
  { text: 'Cash Ledger', icon: <Receipt />, path: '/cash-ledger', roles: ['SUPER_USER', 'ACCOUNTANT'] },

  { text: 'Entity Report', icon: <Assessment />, path: '/entity-report', roles: ['SUPER_USER', 'CENTER_HEAD', 'ACCOUNTANT'] },
  // ✅ NEW: Review & Classify

];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hovered, setHovered] = useState(false);
  const drawerRef = useRef(null);
  const textRefs = useRef([]);

  const userRole = localStorage.getItem('role') || '';
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { duration: 0.3, ease: 'power2.out' } });
    if (hovered) {
      tl.to(drawerRef.current, { width: 220 })
        .to(textRefs.current, { opacity: 1, x: 0, stagger: 0.05 }, '<');
    } else {
      tl.to(textRefs.current, { opacity: 0, x: -20, stagger: 0.03 })
        .to(drawerRef.current, { width: 72 }, '<');
    }
  }, [hovered]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // Highlight if current path starts with item.path (so /tx-classify/sub also highlights)
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <Drawer
      variant="permanent"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        width: 72,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: 72,
          boxSizing: 'border-box',
          backgroundColor: '#1F2937',
          color: '#FFFFFF',
          paddingRight: '18px',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'none',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      }}
      PaperProps={{ ref: drawerRef }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: 15 }}>
        <div
          ref={(el) => (textRefs.current[0] = el)}
          style={{
            marginLeft: 10,
            fontWeight: 600,
            fontSize: 25,
            whiteSpace: 'nowrap',
            opacity: 0,
            transform: 'translateX(-20px)',
          }}
        >
          IGen Panel
        </div>
      </div>

      <List sx={{ mt: 1 }}>
        {menuItems.map((item, index) => (
          <Tooltip key={item.text} title={!hovered ? item.text : ''} placement="right">
            <ListItem
              button
              onClick={() => navigate(item.path)}
              sx={{
                mx: 1,
                my: 0.5,
                borderRadius: '12px',
                paddingY: '8px',
                backgroundColor: isActive(item.path) ? '#3B82F6' : 'transparent',
                '&:hover': {
                  backgroundColor: '#3B82F6',
                  transform: 'scale(1.03)',
                },
                transition: 'all 0.25s ease-in-out',
              }}
            >
              <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  ref: (el) => (textRefs.current[index + 1] = el),
                  sx: {
                    opacity: 0,
                    transform: 'translateX(-20px)',
                    transition: 'none',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            </ListItem>
          </Tooltip>
        ))}
      </List>

      <div style={{ flexGrow: 1 }} />

      <List>
        <ListItem
          button
          onClick={handleLogout}
          sx={{
            mx: 1,
            mb: 2,
            borderRadius: '12px',
            paddingY: '8px',
            '&:hover': {
              backgroundColor: '#3B82F6',
              transform: 'scale(1.02)',
            },
            transition: 'all 0.25s ease-in-out',
          }}
        >
          <ListItemIcon sx={{ color: '#fff', minWidth: 40 }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            primaryTypographyProps={{
              ref: (el) => (textRefs.current[menuItems.length + 1] = el),
              sx: {
                opacity: 0,
                transform: 'translateX(-20px)',
                transition: 'none',
                whiteSpace: 'nowrap',
              },
            }}
          />
        </ListItem>
      </List>
    </Drawer>
  );
}