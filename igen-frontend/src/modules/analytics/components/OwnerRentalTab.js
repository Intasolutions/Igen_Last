// src/modules/analytics/components/OwnerRentalTab.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../../api/axios";
import {
  Card,
  Button,
  Table,
  Pagination,
  Metric,
  ExportMenu,
  genCurrentMonth,
  inr,
  openPropertyStatementPDF,
  openPropertyStatementDOCX,
} from "./analyticsCommon";
import SearchBar from "../../../components/SearchBar"; // 🔁 adjust path if needed

function OwnerRentalTab() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState({});
  const [drafts, setDrafts] = useState({});

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // search
  const [search, setSearch] = useState("");

  // new: statement date range (from / to)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // reset page when data or search term changes
  useEffect(() => {
    setPage(1);
  }, [rows, search]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      (r.property_name || "").toLowerCase().includes(term)
    );
  }, [rows, search]);

  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page]
  );

  const load = async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        API.get("analytics/owner-rental/summary/"),
        API.get("analytics/owner-rental/properties/"),
      ]);
      setSummary(s.data);
      setRows(r.data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load owner rental data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEdit = (r) => {
    setEditing((s) => ({ ...s, [r.id]: true }));
    setDrafts((d) => ({
      ...d,
      [r.id]: {
        rent: r.rent ?? "",
        igen_service_charge: r.igen_service_charge ?? "",
        lease_start: r.lease_start ?? "",
        lease_expiry: r.lease_expiry ?? "",
        agreement_renewal_date: r.agreement_renewal_date ?? r.lease_expiry ?? "",
      },
    }));
  };

  const cancelEdit = (id) => {
    setEditing((s) => {
      const copy = { ...s };
      delete copy[id];
      return copy;
    });
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[id];
      return copy;
    });
  };

  const onDraftChange = (id, field, value) => {
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] || {}), [field]: value } }));
  };

  const saveEdit = async (id) => {
    const data = drafts[id];
    if (!data) return;
    setLoading(true);
    try {
      // 🔁 keep whatever URL is correct in your backend
      await API.patch(`analytics/owner-rental/property/${id}/`, {
        rent: data.rent,
        igen_service_charge: data.igen_service_charge,
        lease_start: data.lease_start || null,
        lease_expiry: data.lease_expiry || null,
        // agreement_renewal_date is read-only in UI now, so we don't send it
      });
      await load();
      cancelEdit(id);
    } catch (e) {
      console.error(e);
      alert("Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  // ---------- inline autosave toggles (accepts alias for txn) ----------
  const toggleFlag = async (id, fields, value) => {
    const keys = Array.isArray(fields) ? fields : [fields];
    let success = false;
    let lastErr = null;
    let appliedKey = null;

    for (const field of keys) {
      try {
        await API.patch(`analytics/owner-rental/property/${id}/`, {

          [field]: value,
        });
        appliedKey = field;
        success = true;
        break;
      } catch (e) {
        lastErr = e; // try next candidate
      }
    }

    if (success && appliedKey) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [appliedKey]: value } : r))
      );
    } else {
      console.error(lastErr);
      alert("Failed to update. Please retry.");
    }
  };

  // property-based statement, using from/to if present, else current month
  const generateRowStatement = async (propertyId, format) => {
    if (!propertyId) return;
    try {
      let params;
      if (fromDate && toDate) {
        params = { from: fromDate, to: toDate };
      } else {
        params = { month: genCurrentMonth() };
      }

      if (format === "word") {
        await openPropertyStatementDOCX(propertyId, params);
      } else {
        await openPropertyStatementPDF(propertyId, params);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate statement.");
    }
  };

  return (
    <>
      <Card
        title="Owner Dashboard – Rental"
        subtitle="Portfolio health at a glance"
        right={
          <div className="hidden sm:block">
            <Button variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        }
      >
        {summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Metric title="Total Properties" value={summary.total_properties} tone="blue" />
            <Metric title="Rented" value={summary.rented} tone="emerald" />
            <Metric title="Vacant" value={summary.vacant} tone="rose" />
            <Metric title="Care" value={summary.care} tone="amber" />
            <Metric title="Sale" value={summary.sale} tone="amber" />
            <Metric
              title="Expected Rent (This Month)"
              value={`₹ ${inr(summary.expected_rent_this_month)}`}
              tone="blue"
            />
            <Metric
              title="iGen Service Charge (This Month)"
              value={`₹ ${inr(summary.igen_sc_this_month)}`}
              tone="blue"
            />
            <Metric
              title="Inspections scheduled (30 days)"
              value={summary.inspections_30d}
              tone="emerald"
            />
            <Metric
              title="To be vacated (30 days)"
              value={summary.to_be_vacated_30d}
              tone="rose"
            />
          </div>
        ) : (
          <div className="text-gray-500">Loading…</div>
        )}
      </Card>

      <Card
        title="Property List (Detailed)"
        subtitle="Inline edit for Rent / iGen SC / Lease dates. Generate statement per property."
        right={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {/* From / To date range for statement */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-full sm:w-40">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none"
                />
              </div>
            </div>

            <div className="w-full sm:w-64">
              <SearchBar
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                label="Search"
                placeholder="Search by property name..."
              />
            </div>
          </div>
        }
      >
        <Table
          headers={[
            "Property",
            "Status",
            "Rent (₹)",
            "iGen SC (₹)",
            "Lease Start",
            "Lease Expiry",
            "Renewal",
            "Inspection",
            "Tenant/Owner",
            "Txn Scheduled",
            "Email Sent",
            "Actions",
          ]}
          foot={
            <tfoot>
              <tr>
                <td colSpan={12} className="px-3 py-2">
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={filteredRows.length}
                    onPageChange={setPage}
                  />
                </td>
              </tr>
            </tfoot>
          }
        >
          {loading && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={12}>
                Loading…
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={12}>
                No data
              </td>
            </tr>
          )}

          {!loading && rows.length > 0 && filteredRows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={12}>
                No results for your search
              </td>
            </tr>
          )}

          {!loading &&
            filteredRows.length > 0 &&
            paginatedRows.map((r) => {
              const isEditing = !!editing[r.id];
              const draft = drafts[r.id] || {};
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div
                      className="font-medium underline decoration-dotted underline-offset-4 cursor-pointer text-blue-600"
                      onClick={() => navigate(`/properties?editId=${r.id}`)}
                    >
                      {r.property_name}
                    </div>
                  </td>

                  <td className="px-3 py-2">{r.status}</td>

                  {/* Rent */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={draft.rent || ""}
                        onChange={(e) => onDraftChange(r.id, "rent", e.target.value)}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none w-28"
                      />
                    ) : (
                      <div>{r.rent ?? "—"}</div>
                    )}
                  </td>

                  {/* iGen SC */}
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input
                        type="text"
                        value={draft.igen_service_charge || ""}
                        onChange={(e) =>
                          onDraftChange(r.id, "igen_service_charge", e.target.value)
                        }
                        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none w-28"
                      />
                    ) : (
                      <div>{r.igen_service_charge ?? "—"}</div>
                    )}
                  </td>

                  {/* Lease Start */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        value={draft.lease_start || ""}
                        onChange={(e) => onDraftChange(r.id, "lease_start", e.target.value)}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none"
                      />
                    ) : (
                      <div>{r.lease_start || "—"}</div>
                    )}
                  </td>

                  {/* Lease Expiry */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        value={draft.lease_expiry || ""}
                        onChange={(e) => onDraftChange(r.id, "lease_expiry", e.target.value)}
                        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none"
                      />
                    ) : (
                      <div>{r.lease_expiry || "—"}</div>
                    )}
                  </td>

                  {/* Renewal (Read-only) */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>{r.agreement_renewal_date || r.lease_expiry || "—"}</div>
                  </td>

                  {/* Inspection (read-only) */}
                  <td className="px-3 py-2">{r.inspection_date || "—"}</td>

                  <td className="px-3 py-2">{r.tenant_or_owner || "—"}</td>

                  {/* inline toggles */}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!(r.transaction_scheduled ?? r.txn_scheduled)}
                      onChange={(e) =>
                        toggleFlag(
                          r.id,
                          ["transaction_scheduled", "txn_scheduled"],
                          e.target.checked
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!r.email_sent}
                      onChange={(e) => toggleFlag(r.id, "email_sent", e.target.checked)}
                    />
                  </td>

                  <td className="px-3 py-2 flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <Button variant="outline" onClick={() => startEdit(r)} title="Edit row">
                          Edit
                        </Button>
                        <ExportMenu
                          label="Generate"
                          title="Generate statement for this property (from/to or current month)"
                          options={[
                            {
                              label: "PDF",
                              onClick: () => generateRowStatement(r.id, "pdf"),
                            },
                            {
                              label: "Word",
                              onClick: () => generateRowStatement(r.id, "word"),
                            },
                          ]}
                        />
                      </>
                    ) : (
                      <>
                        <Button onClick={() => saveEdit(r.id)} disabled={loading}>
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => cancelEdit(r.id)}
                          disabled={loading}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
        </Table>
      </Card>
    </>
  );
}

export default OwnerRentalTab;
