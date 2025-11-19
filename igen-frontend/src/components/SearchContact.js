import React, { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import API from '../../api/axios';

/**
 * Async contact search (frontend-only):
 * - Calls /contacts/contacts/?search=<term>&is_active=true
 * - Filters results client-side by stakeholder type ("Landlord" | "Tenant")
 * - Optionally scopes by companyId (?company=<id>) if provided
 */
export default function SearchContact({
  label,
  valueId,            // UUID of the selected contact (what you store in form)
  onChangeId,          // (id | '') => void
  stakeholder,         // 'Landlord' | 'Tenant'
  companyId,           // optional: restrict search within a company
  minLength = 1,       // start searching after N chars
}) {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // fetch a single contact by id for edit-mode display (best-effort)
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!valueId) { setSelected(null); return; }
      try {
        setLoading(true);
        const { data } = await API.get(`contacts/contacts/${valueId}/`);
        if (!ignore) setSelected(data || null);
      } catch {
        // fallback: keep as null if not retrievable
        if (!ignore) setSelected(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [valueId]);

  // debounced search against backend; filter by stakeholder client-side
  useEffect(() => {
    let active = true;
    if (input.length < minLength) { setOptions([]); return; }

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('search', input);
        params.set('is_active', 'true');
        if (companyId) params.set('company', companyId);
        const { data } = await API.get('contacts/contacts/', { params });
        const list = Array.isArray(data) ? data : (data?.results || []);
        const filtered = list.filter(
          c => Array.isArray(c.stakeholder_types) && c.stakeholder_types.includes(stakeholder)
        );
        if (active) setOptions(filtered);
      } catch {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => { active = false; clearTimeout(t); };
  }, [input, stakeholder, companyId, minLength]);

  const labelOf = (o) => o?.full_name || o?.email || o?.phone || '';

  return (
    <Autocomplete
      options={options}
      value={selected}
      loading={loading}
      onChange={(e, newVal) => {
        setSelected(newVal);
        onChangeId(newVal ? (newVal.contact_id || newVal.id) : '');
      }}
      onInputChange={(e, v, reason) => {
        if (reason === 'input') setInput(v);
      }}
      getOptionLabel={labelOf}
      isOptionEqualToValue={(o, v) =>
        (o?.contact_id || o?.id) === (v?.contact_id || v?.id)
      }
      filterOptions={(x) => x} // don't double-filter; we already filtered
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          margin="dense"
          fullWidth
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          placeholder={`Search ${stakeholder?.toLowerCase()} by name/phone/email`}
        />
      )}
    />
  );
}
