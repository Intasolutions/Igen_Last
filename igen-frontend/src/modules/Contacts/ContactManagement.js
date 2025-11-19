import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/axios";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardContent,
  Typography,
  IconButton,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Tooltip,
  Snackbar,
  Alert,
  Slide,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Checkbox,
  ListItemText,
  OutlinedInput,
  ListSubheader,
  Radio,
  RadioGroup,
  FormControlLabel,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EditIcon from "@mui/icons-material/Edit";
import SearchBar from "../../components/SearchBar";
import TablePaginationComponent from "../../components/TablePaginationComponent";
import StatusFilter, { statusToIsActive } from "../../components/StatusFilter";
import { canCreate, canUpdate } from "../../utils/perm"; // ⬅️ role gating

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const stakeholderOptions = [
  "Landlord",
  "Tenant",
  "Vendor",
  "Buyer",
  "Seller",
  "Broker",
  "Key Holder",
  "Project Stakeholder",
  "Project Manager",
  "Other",
];

const defaultForm = {
  full_name: "",
  type: "Individual",
  stakeholder_types: [],
  phone: "",
  alternate_phone: "",
  email: "",
  address: "",
  pan: "",
  gst: "",
  notes: "",
  linked_properties: [],
  is_active: true,
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function ContactManagement() {
  // ---- role gates (Center Head should evaluate to false here) ----
  const CAN_ADD = canCreate("contacts");
  const CAN_EDIT = canUpdate("contacts");

  const [contacts, setContacts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedStakeholder, setSelectedStakeholder] = useState("");
  const [stakeholderSearch, setStakeholderSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(""); // '', 'active', 'inactive'

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [errors, setErrors] = useState({});

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  // -------- Fetches --------
  const fetchProperties = async () => {
    try {
      const res = await API.get("properties/properties/");
      const items = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setProperties(items || []);
    } catch {
      setProperties([]);
      showSnackbar("Failed to load properties", "error");
    }
  };

  const fetchContacts = async () => {
    try {
      const params = {};
      if (selectedStakeholder) params.stakeholder_types = selectedStakeholder;
      const isActive = statusToIsActive(selectedStatus);
      if (typeof isActive === "boolean") params.is_active = isActive;

      const res = await API.get("contacts/contacts/", { params });
      const items = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setContacts(items || []);
    } catch {
      setContacts([]);
      showSnackbar("Failed to load contacts", "error");
    }
  };

  useEffect(() => {
    fetchProperties();
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch whenever status changes (so server-side filtering is applied)
  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  // -------- Validation --------
  const validateForm = () => {
    const newErrors = {};

    if (!form.full_name) newErrors.full_name = "Full name is required";

    if (!form.phone) {
      newErrors.phone = "Phone number is required";
    }

    if (form.email && !emailRegex.test(form.email)) {
      newErrors.email = "Invalid email format";
    }

    if ((form.stakeholder_types || []).length === 0) {
      newErrors.stakeholder_types = "At least one stakeholder type is required";
    }

    if (form.pan && !panRegex.test(String(form.pan).toUpperCase())) {
      newErrors.pan = "Invalid PAN format (ABCDE1234F)";
    }

    if (form.type === "Company") {
      if (!form.gst) {
        newErrors.gst = "GST number is required for companies";
      } else if (!gstRegex.test(String(form.gst).toUpperCase())) {
        newErrors.gst = "Invalid GST format (22ABCDE1234F1Z5)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // -------- Create / Update --------
  const handleAddOrUpdate = async () => {
    // hard block by role (prevents programmatic opens/saves)
    if (editingId && !CAN_EDIT) {
      showSnackbar("You do not have permission to edit contacts.", "warning");
      return;
    }
    if (!editingId && !CAN_ADD) {
      showSnackbar("You do not have permission to add contacts.", "warning");
      return;
    }

    if (!validateForm()) return;

    const linkedIds = (form.linked_properties || []).map((p) =>
      typeof p === "object" ? p.id : p
    );
    const payload = { ...form, linked_property_ids: linkedIds };
    delete payload.linked_properties;

    try {
      if (editingId) {
        await API.put(`contacts/contacts/${editingId}/`, payload);
        showSnackbar("Contact updated");
      } else {
        await API.post("contacts/contacts/", payload);
        showSnackbar("Contact added");
      }
      await fetchContacts();
      setOpen(false);
      setForm(defaultForm);
      setEditingId(null);
      setErrors({});
    } catch (err) {
      const data = err?.response?.data || {};
      const fieldErrors = {};
      if (typeof data === "object") {
        Object.entries(data).forEach(([k, v]) => {
          if (Array.isArray(v)) fieldErrors[k] = v.join(" ");
          else if (typeof v === "string") fieldErrors[k] = v;
        });
      }
      if (Object.keys(fieldErrors).length)
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      showSnackbar("Save failed", "error");
    }
  };

  // -------- Edit helper --------
  const openEditorWithContact = (contact) => {
    if (!CAN_EDIT) {
      showSnackbar("You do not have permission to edit contacts.", "warning");
      return;
    }
    const lp = (contact.linked_properties || []).map((p) =>
      typeof p === "object" ? p : properties.find((x) => x.id === p) || { id: p, name: `#${p}` }
    );
    setForm({ ...defaultForm, ...contact, linked_properties: lp });
    setEditingId(contact.contact_id);
    setOpen(true);
  };

  // -------- Filtering & pagination --------
  const filteredContacts = useMemo(() => {
    const term = (search || "").toLowerCase();
    return (contacts || []).filter((c) => {
      const matchesSearch =
        (c.full_name || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term);
      const matchesStakeholder = selectedStakeholder
        ? (c.stakeholder_types || []).includes(selectedStakeholder)
        : true;
      const matchesStatus = selectedStatus
        ? (selectedStatus === "active" ? c.is_active : !c.is_active)
        : true;
      return matchesSearch && matchesStakeholder && matchesStatus;
    });
  }, [search, contacts, selectedStakeholder, selectedStatus]);

  const paginatedContacts = useMemo(() => {
    if (rowsPerPage === -1) return filteredContacts;
    const start = page * rowsPerPage;
    return filteredContacts.slice(start, start + rowsPerPage);
  }, [filteredContacts, page, rowsPerPage]);

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="p-[35px]">
      <Typography variant="h5" fontWeight={600}>Contact Management</Typography>

      <div className="flex justify-between items-center my-6 gap-4 flex-wrap">
        <SearchBar
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          label="Search by Name or Email"
          placeholder="Search contacts..."
        />

        <div className="flex gap-2">
          {/* Stakeholder filter */}
          <div className=" bg-white rounded-xl shadow-sm border border-gray-200">
            <FormControl size="small" sx={{ minWidth: 260 }} variant="outlined">
              <Select
                value={selectedStakeholder}
                onChange={(e) => {
                  setSelectedStakeholder(e.target.value);
                  setStakeholderSearch("");
                  setPage(0);
                }}
                displayEmpty
                renderValue={(selected) => selected || "All Stakeholders"}
                MenuProps={{
                  PaperProps: {
                    style: { maxHeight: 320, borderRadius: 12, padding: "4px 0" },
                    className: "shadow-md",
                  },
                }}
              >
                {/* Search inside dropdown */}
                <ListSubheader>
                  <Box sx={{ p: 1.2 }}>
                    <TextField
                      size="small"
                      placeholder="Search stakeholder..."
                      fullWidth
                      value={stakeholderSearch}
                      onChange={(e) => setStakeholderSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      variant="outlined"
                      InputProps={{
                        sx: { borderRadius: 2, fontSize: 14 },
                      }}
                    />
                  </Box>
                </ListSubheader>

                <MenuItem value="">
                  <em>All Stakeholders</em>
                </MenuItem>

                {stakeholderOptions
                  .filter((option) =>
                    option.toLowerCase().includes((stakeholderSearch || "").toLowerCase())
                  )
                  .map((type) => (
                    <MenuItem
                      key={type}
                      value={type}
                      sx={{ "&:hover": { backgroundColor: "rgba(25, 118, 210, 0.08)" } }}
                    >
                      {type}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </div>

          {/* Status filter (reusable component) */}
          <StatusFilter
            value={selectedStatus}
            onChange={(v) => {
              setSelectedStatus(v); // '' | 'active' | 'inactive'
              setPage(0);
            }}
          />

          {CAN_ADD && (
            <Button
              variant="contained"
              onClick={() => {
                if (!CAN_ADD) {
                  showSnackbar("You do not have permission to add contacts.", "warning");
                  return;
                }
                setForm(defaultForm);
                setEditingId(null);
                setErrors({});
                setOpen(true);
              }}
            >
              Add Contact
            </Button>
          )}
        </div>
      </div>

      <Card sx={{ boxShadow: 4, borderRadius: 3 }}>
        <CardContent>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ backgroundColor: "#e3f2fd" }}>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Full Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Stakeholder Type(s)</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Alternate</TableCell>
                  <TableCell>Email</TableCell>
                  {CAN_EDIT && <TableCell align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedContacts.map((c, index) => (
                  <React.Fragment key={c.contact_id}>
                    <TableRow
                      hover
                      sx={{
                        backgroundColor: c.is_active ? "#e8f5e9" : "#fffde7",
                        transition: "background-color 0.3s ease",
                      }}
                    >
                      <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                      <TableCell>{c.full_name}</TableCell>
                      <TableCell>{c.type}</TableCell>
                      <TableCell>{(c.stakeholder_types || []).join(", ")}</TableCell>
                      <TableCell>{c.phone}</TableCell>
                      <TableCell>{c.alternate_phone}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      {CAN_EDIT && (
                        <TableCell align="center">
                          <Tooltip title="Expand">
                            <IconButton onClick={() => toggleRow(c.contact_id)}>
                              {expandedRow === c.contact_id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Edit">
                            <span>
                              <IconButton onClick={() => openEditorWithContact(c)} disabled={!CAN_EDIT}>
                                <EditIcon color="primary" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>

                    {expandedRow === c.contact_id && (
                      <TableRow>
                        <TableCell colSpan={CAN_EDIT ? 8 : 7}>
                          <Typography variant="body2" gutterBottom>
                            Address: {c.address}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            PAN: {c.pan}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            GST: {c.gst}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            Notes: {c.notes}
                          </Typography>
                          <Typography variant="body2" gutterBottom>
                            Linked Properties:{" "}
                            {(c.linked_properties || [])
                              .map((p) =>
                                typeof p === "object"
                                  ? p.name ?? `#${p.id}`
                                  : properties.find((x) => x.id === p)?.name || String(p)
                              )
                              .join(", ")}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>

        <TablePaginationComponent
          count={filteredContacts.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_e, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Card>

      {/* Create / Edit dialog */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Transition}
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 3,
            backgroundColor: "#fafafa",
            boxShadow: 10,
            overflowY: "hidden",
          },
        }}
      >
        <DialogTitle>{editingId ? "Edit Contact" : "Add New Contact"}</DialogTitle>

        <DialogContent
          dividers
          sx={{
            p: 3,
            overflowY: "auto",
            maxHeight: "60vh",
            "&::-webkit-scrollbar": {
              display: "none",
            },
            scrollbarWidth: "none",
            "-ms-overflow-style": "none",
          }}
        >
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Full Name"
              fullWidth
              margin="normal"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              error={!!errors.full_name}
              helperText={errors.full_name}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Type</InputLabel>
              <Select
                value={form.type}
                label="Type"
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <MenuItem value="Individual">Individual</MenuItem>
                <MenuItem value="Company">Company</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <FormControl fullWidth margin="normal" error={!!errors.stakeholder_types}>
              <InputLabel>Stakeholder Type(s)</InputLabel>
              <Select
                multiple
                value={form.stakeholder_types}
                onChange={(e) => setForm({ ...form, stakeholder_types: e.target.value })}
                input={<OutlinedInput label="Stakeholder Type(s)" />}
                renderValue={(selected) => (selected || []).join(", ")}
              >
                {stakeholderOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    <Checkbox checked={(form.stakeholder_types || []).includes(option)} />
                    <ListItemText primary={option} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Phone"
              fullWidth
              margin="normal"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              error={!!errors.phone}
              helperText={errors.phone}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Alternate Phone"
              fullWidth
              margin="normal"
              value={form.alternate_phone}
              onChange={(e) => setForm({ ...form, alternate_phone: e.target.value })}
            />

            <TextField
              label="Email"
              fullWidth
              margin="normal"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              error={!!errors.email}
              helperText={errors.email}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Address"
              fullWidth
              margin="normal"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />

            <TextField
              label="PAN"
              fullWidth
              margin="normal"
              value={form.pan}
              onChange={(e) =>
                setForm({ ...form, pan: (e.target.value || "").toUpperCase() })
              }
              error={!!errors.pan}
              helperText={errors.pan}
            />
          </Box>

          {form.type === "Company" && (
            <TextField
              label="GST"
              fullWidth
              margin="normal"
              value={form.gst}
              onChange={(e) =>
                setForm({ ...form, gst: (e.target.value || "").toUpperCase() })
              }
              error={!!errors.gst}
              helperText={errors.gst}
            />
          )}

          {/* Linked Properties */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Linked Properties</InputLabel>
            <Select
              multiple
              value={form.linked_properties}
              onChange={(e) => setForm({ ...form, linked_properties: e.target.value })}
              input={<OutlinedInput label="Linked Properties" />}
              renderValue={(selected) =>
                (selected || [])
                  .map((p) =>
                    typeof p === "object"
                      ? p.name ?? `#${p.id}`
                      : properties.find((x) => x.id === p)?.name || String(p)
                  )
                  .join(", ")
              }
            >
              {properties.map((prop) => {
                const isChecked = (form.linked_properties || []).some(
                  (x) => (typeof x === "object" ? x.id : x) === prop.id
                );
                return (
                  <MenuItem key={prop.id} value={prop}>
                    <Checkbox checked={isChecked} />
                    <ListItemText primary={prop.name ?? `#${prop.id}`} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={2}
              margin="normal"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />

            <FormControl fullWidth margin="normal">
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Status
              </Typography>
              <RadioGroup
                row
                value={form.is_active ? "active" : "inactive"}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.value === "active" })
                }
              >
                <FormControlLabel
                  value="active"
                  control={<Radio sx={{ color: "#4caf50", "&.Mui-checked": { color: "#4caf50" } }} />}
                  label="Active"
                />
                <FormControlLabel
                  value="inactive"
                  control={<Radio sx={{ color: "#ff9800", "&.Mui-checked": { color: "#ff9800" } }} />}
                  label="Inactive"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddOrUpdate}>
            {editingId ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
