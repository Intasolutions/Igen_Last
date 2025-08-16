import React from 'react';
import { Switch } from '@mui/material'; // or whatever UI lib you're using

const StatusToggle = ({ checked, onChange, activeLabel = 'Active', inactiveLabel = 'Inactive' }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Switch
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        color="primary"
      />
      <span>{checked ? activeLabel : inactiveLabel}</span>
    </div>
  );
};

export default StatusToggle;
