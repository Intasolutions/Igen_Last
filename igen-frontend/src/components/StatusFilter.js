import React from "react";
import { FormControl, Select, MenuItem } from "@mui/material";

/**
 * Reusable status filter: '', 'active', 'inactive'
 *
 * Props:
 * - value: '' | 'active' | 'inactive'
 * - onChange: (newValue) => void
 * - size: 'small' | 'medium' (default: 'small')
 * - sx: MUI sx styles (default: { minWidth: 180 })
 * - labelAll: string (default: 'All Statuses')
 * - className: wrapper class (default: a rounded white card)
 */
export default function StatusFilter({
  value = "",
  onChange,
  size = "small",
  sx = { minWidth: 180 },
  labelAll = "All Statuses",
  className = "bg-white rounded-xl shadow-sm border border-gray-200",
}) {
  return (
    <div className={className}>
      <FormControl size={size} sx={sx} variant="outlined">
        <Select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          displayEmpty
          renderValue={(v) => {
            if (!v) return labelAll;
            return v === "active" ? "Active" : "Inactive";
          }}
          MenuProps={{
            PaperProps: {
              style: { borderRadius: 12, padding: "4px 0" },
              className: "shadow-md",
            },
          }}
        >
          <MenuItem value="">
            <em>{labelAll}</em>
          </MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </Select>
      </FormControl>
    </div>
  );
}

/** Helper to convert UI value -> boolean for API params */
export const statusToIsActive = (value) =>
  value === "active" ? true : value === "inactive" ? false : undefined;
