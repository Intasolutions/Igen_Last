import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export default function SearchBar({
  value,
  onChange,
  label = 'Search',
  placeholder = 'Type to search...',
  className = '',
  sx = {},
}) {
  return (
    <div className={`flex-1 max-w-sm ${className}`}>
      <TextField
        label={label}
        variant="outlined"
        size="small"
        fullWidth
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon style={{ color: '#888' }} />
            </InputAdornment>
          ),
          sx: {
            borderRadius: 3,
            backgroundColor: '#fafafa',
            ...sx,
          },
        }}
      />
    </div>
  );
}