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

  const [showPending, setShowPending] = useState(false);
  const [pendingData, setPendingData] = useState({ rows: [], unmapped_received: 0 });
  const [pendingLoading, setPendingLoading] = useState(false);

  const [showInspections, setShowInspections] = useState(false);
  const [inspectionType, setInspectionType] = useState("upcoming"); // "upcoming" or "expired"
  const [inspectionData, setInspectionData] = useState({ rows: [] });
  const [inspectionLoading, setInspectionLoading] = useState(false);

  const [showRenewals, setShowRenewals] = useState(false);
  const [renewalType, setRenewalType] = useState("upcoming"); // "upcoming" or "expired"
  const [renewalData, setRenewalData] = useState({ rows: [] });
  const [renewalLoading, setRenewalLoading] = useState(false);

  const [showServiceCharge, setShowServiceCharge] = useState(false);
  const [serviceChargeData, setServiceChargeData] = useState({ rows: [], summaries: [], unmapped_total: 0 });
  const [serviceChargeLoading, setServiceChargeLoading] = useState(false);

  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintenanceData, setMaintenanceData] = useState({ rows: [] });
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [showMarginBreakdown, setShowMarginBreakdown] = useState(false);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
  const [showExpenseBreakdown, setShowExpenseBreakdown] = useState(false);

  // Pagination states for drill-downs
  const [pendingPage, setPendingPage] = useState(1);
  const [scPage, setScPage] = useState(1);
  const [maintPage, setMaintPage] = useState(1);
  const [insPage, setInsPage] = useState(1);
  const [renPage, setRenPage] = useState(1);
  const DRILL_PAGE_SIZE = 10;

  const [editing, setEditing] = useState({});
  const [drafts, setDrafts] = useState({});

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // search
  const [search, setSearch] = useState("");

  // filters
  const [selectedMonth, setSelectedMonth] = useState(genCurrentMonth());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // reset page when search term changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPendingPage(1);
    setScPage(1);
    setMaintPage(1);
    setInsPage(1);
    setRenPage(1);
  }, [selectedMonth]);

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

  // Memos for drill-down pagination
  const paginatedPending = useMemo(() => {
    const r = pendingData.rows || [];
    return r.slice((pendingPage - 1) * DRILL_PAGE_SIZE, pendingPage * DRILL_PAGE_SIZE);
  }, [pendingData.rows, pendingPage]);

  const paginatedSC = useMemo(() => {
    const r = serviceChargeData.rows || [];
    return r.slice((scPage - 1) * DRILL_PAGE_SIZE, scPage * DRILL_PAGE_SIZE);
  }, [serviceChargeData.rows, scPage]);

  const paginatedMaint = useMemo(() => {
    const r = maintenanceData.rows || [];
    return r.slice((maintPage - 1) * DRILL_PAGE_SIZE, maintPage * DRILL_PAGE_SIZE);
  }, [maintenanceData.rows, maintPage]);

  const paginatedIns = useMemo(() => {
    const r = inspectionData.rows || [];
    return r.slice((insPage - 1) * DRILL_PAGE_SIZE, insPage * DRILL_PAGE_SIZE);
  }, [inspectionData.rows, insPage]);

  const paginatedRen = useMemo(() => {
    const r = renewalData.rows || [];
    return r.slice((renPage - 1) * DRILL_PAGE_SIZE, renPage * DRILL_PAGE_SIZE);
  }, [renewalData.rows, renPage]);

  const load = async (monthOverride) => {
    const month = monthOverride || selectedMonth;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        API.get("analytics/owner-rental/summary/", { params: { month } }),
        API.get("analytics/owner-rental/properties/", { params: { month } }),
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

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const res = await API.get("analytics/owner-rental/pending-list/", {
        params: { month: selectedMonth },
      });
      setPendingData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load pending list.");
    } finally {
      setPendingLoading(false);
    }
  };

  const loadInspections = async (typeOverride) => {
    const type = typeOverride || inspectionType;
    setInspectionLoading(true);
    try {
      const res = await API.get("analytics/owner-rental/inspection-list/", {
        params: {
          type,
          company_id: summary?.company_id || ""
        },
      });
      setInspectionData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load inspection list.");
    } finally {
      setInspectionLoading(false);
    }
  };

  const loadRenewals = async (typeOverride) => {
    const type = typeOverride || renewalType;
    setRenewalLoading(true);
    try {
      const res = await API.get("analytics/owner-rental/agreement-expiry-list/", {
        params: {
          type,
          company_id: summary?.company_id || ""
        },
      });
      setRenewalData(res.data);
      console.log("Renewal data loaded:", res.data);
    } catch (e) {
      console.error("Renewal load error:", e);
      alert("Failed to load renewal list.");
    } finally {
      setRenewalLoading(false);
    }
  };

  const loadServiceCharge = async () => {
    setServiceChargeLoading(true);
    try {
      const res = await API.get("analytics/owner-rental/service-charge-breakdown/", {
        params: {
          month: selectedMonth,
          company_id: summary?.company_id || ""
        },
      });
      setServiceChargeData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load service charge breakdown.");
    } finally {
      setServiceChargeLoading(false);
    }
  };

  const loadMaintenance = async () => {
    setMaintenanceLoading(true);
    try {
      const res = await API.get("analytics/owner-rental/maintenance-breakdown/", {
        params: {
          month: selectedMonth,
          company_id: summary?.company_id || ""
        },
      });
      setMaintenanceData(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load maintenance list.");
    } finally {
      setMaintenanceLoading(false);
    }
  };

  useEffect(() => {
    load(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  useEffect(() => {
    if (showPending) loadPending();
  }, [showPending, selectedMonth]);

  useEffect(() => {
    if (showInspections) loadInspections(inspectionType);
  }, [showInspections, inspectionType, selectedMonth, summary]);

  useEffect(() => {
    if (showRenewals) loadRenewals(renewalType);
  }, [showRenewals, renewalType, selectedMonth, summary]);

  useEffect(() => {
    if (showServiceCharge) loadServiceCharge();
  }, [showServiceCharge, selectedMonth, summary]);

  useEffect(() => {
    if (showMaintenance) loadMaintenance();
  }, [showMaintenance, selectedMonth, summary]);

  const startEdit = (r) => {
    setEditing((s) => ({ ...s, [r.id]: true }));
    setDrafts((d) => ({
      ...d,
      [r.id]: {
        rent: r.base_rent ?? r.rent ?? "", // ✅ Always edit the FULL rent
        igen_service_charge: r.base_igen_service_charge ?? r.igen_service_charge ?? "",
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="hidden sm:block text-xs font-medium text-gray-500">
                Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none"
              />
            </div>
            <Button variant="outline" onClick={() => load()} disabled={loading}>
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
              title="Rent to be Collected"
              value={`₹ ${inr(summary.rent_to_be_collected)}`}
              tone="blue"
              tooltip="Theoretical amount calculated using pro-rated occupancy for the selected month."
            />
            <Metric
              title="Rent Received"
              value={`₹ ${inr(summary.rent_received)}`}
              tone="emerald"
              tooltip="Actual rent collected in the bank based on Value Date for this month."
            />
            <Metric
              title="Rent Pending Collection"
              value={`₹ ${inr(summary.rent_pending_collection)}`}
              tone="yellow"
              tooltip="Detailed list of pending properties. (Expected Rent - Received Rent)"
              onClick={() => setShowPending(!showPending)}
              className="cursor-pointer border-2 border-yellow-200 hover:bg-yellow-50 transition-colors"
            />
            <Metric
              title="iGen SC (Collected)"
              value={
                <div className="flex items-center gap-2">
                  <span>₹ {inr(summary.igen_sc_collected)}</span>
                  {summary.igen_sc_variance !== "0.00" && summary.igen_sc_variance !== 0 && (
                    <span className="text-rose-500 font-bold text-xs bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 uppercase" title={`Variance: ₹ ${inr(summary.igen_sc_variance)} (Diff between Collected vs Expected)`}>Variance</span>
                  )}
                </div>
              }
              tone="blue"
              tooltip={`Expected: ₹ ${inr(summary.igen_sc_this_month)} | Variance: ₹ ${inr(summary.igen_sc_variance)}. Collected is based on Value Date for 'iGen Service Charge' transactions.`}
              onClick={() => setShowServiceCharge(!showServiceCharge)}
              className="cursor-pointer border-2 border-blue-50 hover:bg-blue-50 transition-colors"
            />
            <Metric
              title="Maintenance / Expenses (to be Collected)"
              value={`₹ ${inr(summary.owner_recoverables_total)}`}
              tone="blue"
              tooltip="Includes all Rental/Sale cost centre entries; collectible amount includes margin."
              onClick={() => setShowMaintenance(!showMaintenance)}
              className="cursor-pointer border-2 border-blue-50 hover:bg-blue-50 transition-colors"
              footer={
                <div className="flex justify-between text-[10px] text-gray-500 font-medium px-1 mt-1">
                  <span>Base: ₹ {inr(summary.owner_recoverables_base)}</span>
                  <span>Margin: ₹ {inr(summary.owner_recoverables_margin)}</span>
                </div>
              }
            />
            <Metric
              title="Total Margin Collected"
              value={`₹ ${inr(summary.total_margin_collected)}`}
              tone="emerald"
              tooltip="Total profit collected for iGen from 'Margin Applicable' transaction types. Click to see breakdown by Cost Center."
              onClick={() => {
                setShowMarginBreakdown(!showMarginBreakdown);
                setShowIncomeBreakdown(false);
                setShowExpenseBreakdown(false);
              }}
              className="cursor-pointer border-2 border-emerald-50 hover:bg-emerald-50 transition-colors"
            />
            <Metric
              title="Total iGen Income"
              value={`₹ ${inr(summary.total_igen_income)}`}
              tone="blue"
              tooltip="Sum of Income Credits (Service Charge, Brokerage, Other) + Total Margin. Click for breakdown."
              onClick={() => {
                setShowIncomeBreakdown(!showIncomeBreakdown);
                setShowMarginBreakdown(false);
                setShowExpenseBreakdown(false);
              }}
              className="cursor-pointer border-2 border-blue-100 hover:bg-blue-50 transition-colors"
              footer={
                <div className="flex justify-between text-[10px] text-gray-500 font-medium px-1 mt-1">
                  <span>Credits: ₹ {inr(summary.total_igen_income - summary.total_margin_collected)}</span>
                  <span>Margin: ₹ {inr(summary.total_margin_collected)}</span>
                </div>
              }
            />
            <Metric
              title="Total iGen Expenses"
              value={`₹ ${inr(summary.total_igen_expenses)}`}
              tone="rose"
              tooltip="Sum of Internal Operational Expenses (Office Rent, Fuel, etc.) from non-recoverable cost centres. Click for breakdown."
              onClick={() => {
                setShowExpenseBreakdown(!showExpenseBreakdown);
                setShowIncomeBreakdown(false);
                setShowMarginBreakdown(false);
              }}
              className="cursor-pointer border-2 border-rose-100 hover:bg-rose-50 transition-colors"
            />
            <Metric
              title="Inspections (30 days)"
              value={summary.inspections_30d || 0}
              tone="emerald"
              tooltip="Total properties with an inspection scheduled in the next 30 days."
            />
            <Metric
              title="Inspections (Next 5 Days)"
              value={
                <div className="flex divide-x divide-emerald-200">
                  <div
                    className="pr-4 cursor-pointer hover:text-emerald-700 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectionType("upcoming");
                      setShowInspections(true);
                      setShowPending(false);
                    }}
                  >
                    <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Upcoming</div>
                    <div className="text-xl font-bold">{summary.inspections_due_5d || 0}</div>
                  </div>
                  <div
                    className="pl-4 cursor-pointer hover:text-emerald-700 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectionType("expired");
                      setShowInspections(true);
                      setShowPending(false);
                    }}
                  >
                    <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Expired</div>
                    <div className="text-xl font-bold">{summary.inspections_expired || 0}</div>
                  </div>
                </div>
              }
              tone="emerald"
              tooltip="Upcoming: Next 5 days. Expired: All past due dates. Click either to see details."
            />
            <Metric
              title="Agreement Renewals"
              value={
                <div className="flex divide-x divide-rose-200">
                  <div
                    className="pr-4 cursor-pointer hover:text-rose-700 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenewalType("upcoming");
                      setShowRenewals(true);
                      setShowInspections(false);
                      setShowPending(false);
                    }}
                  >
                    <div className="text-[10px] text-rose-600 uppercase tracking-wider">Upcoming</div>
                    <div className="text-xl font-bold">{summary.renewals_30d || 0}</div>
                  </div>
                  <div
                    className="pl-4 cursor-pointer hover:text-rose-700 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenewalType("expired");
                      setShowRenewals(true);
                      setShowInspections(false);
                      setShowPending(false);
                    }}
                  >
                    <div className="text-[10px] text-rose-600 uppercase tracking-wider">Expired</div>
                    <div className="text-xl font-bold">{summary.agreements_expired || 0}</div>
                  </div>
                </div>
              }
              tone="rose"
              tooltip="Upcoming: Agreements expiring in 30 days. Expired: Agreements past expiry date. Click to see details."
            />
          </div>
        ) : (
          <div className="text-gray-500">Loading…</div>
        )}
      </Card>

      {showMarginBreakdown && summary && (
        <Card
          className="mt-4 border-emerald-100 shadow-emerald-50"
          title="Margin Breakdown (by Cost Centre)"
          subtitle={`Detailed profit distribution for ${selectedMonth}`}
          extra={
            <Button variant="outline" size="sm" onClick={() => setShowMarginBreakdown(false)}>
              Close Breakdown
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <Table
              headers={["Cost Centre", "Bank Margin", "Cash Margin", "Total Margin"]}
            >
              {(!summary.margin_breakdown || summary.margin_breakdown.length === 0) ? (
                <tr>
                  <td colSpan="4" className="text-center py-6 text-gray-400">
                    No margin collected for the selected period.
                  </td>
                </tr>
              ) : (
                summary.margin_breakdown.map((m, i) => (
                  <tr key={i} className="hover:bg-emerald-50/30 transition-colors border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-800">{m.cost_centre}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-sm">₹ {inr(m.bank)}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-sm">₹ {inr(m.cash)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700 font-mono">₹ {inr(m.total)}</td>
                  </tr>
                ))
              )}
            </Table>
          </div>
        </Card>
      )}

      {showIncomeBreakdown && summary && (
        <Card
          className="mt-4 border-blue-100 shadow-blue-50"
          title="Total iGen Income Breakdown"
          subtitle={`Income distribution for ${selectedMonth}`}
          extra={
            <Button variant="outline" size="sm" onClick={() => setShowIncomeBreakdown(false)}>
              Close Breakdown
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                By Transaction Type (Credits Only)
              </h4>
              <Table headers={["Type", "Amount"]}>
                {summary.igen_income_type_breakdown.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{item.type}</td>
                    <td className="px-4 py-2.5 text-blue-600 font-mono font-bold">₹ {inr(item.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-2.5 font-bold text-blue-900 uppercase text-[10px]">Subtotal (Credits)</td>
                  <td className="px-4 py-2.5 font-black text-blue-900 font-mono">
                    ₹ {inr(summary.total_igen_income - summary.total_margin_collected)}
                  </td>
                </tr>
              </Table>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                By Cost Centre (Credits Only)
              </h4>
              <Table headers={["Cost Centre", "Amount"]}>
                {summary.igen_income_cc_breakdown.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700 font-medium">{item.cost_centre}</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-mono font-bold">₹ {inr(item.amount)}</td>
                  </tr>
                ))}
                {(!summary.igen_income_cc_breakdown || summary.igen_income_cc_breakdown.length === 0) && (
                  <tr>
                    <td colSpan="2" className="text-center py-4 text-gray-400 text-sm">No cost centre credits found.</td>
                  </tr>
                )}
              </Table>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Total Credits</div>
                <div className="text-lg font-bold text-blue-700">₹ {inr(summary.total_igen_income - summary.total_margin_collected)}</div>
              </div>
              <div className="text-2xl text-gray-300 self-center">+</div>
              <div className="text-center">
                <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">Total Margin</div>
                <div className="text-lg font-bold text-emerald-700">₹ {inr(summary.total_margin_collected)}</div>
              </div>
            </div>
            <div className="bg-white px-6 py-3 rounded-lg shadow-sm border border-blue-100 text-center">
              <div className="text-[10px] uppercase text-blue-600 font-black tracking-widest mb-1">Total iGen Income</div>
              <div className="text-3xl font-black text-blue-900 font-mono">₹ {inr(summary.total_igen_income)}</div>
            </div>
          </div>
        </Card>
      )}

      {showExpenseBreakdown && summary && (
        <Card
          className="mt-4 border-rose-100 shadow-rose-50"
          title="Total iGen Expenses Breakdown"
          subtitle={`Expense distribution for ${selectedMonth}`}
          extra={
            <Button variant="outline" size="sm" onClick={() => setShowExpenseBreakdown(false)}>
              Close Breakdown
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-2 block text-gray-700 font-bold uppercase tracking-wider text-[10px]">By Transaction Type</div>
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <Table headers={["Type", "Amount"]}>
                  {(!summary.igen_expense_type_breakdown || summary.igen_expense_type_breakdown.length === 0) ? (
                    <tr><td colSpan="2" className="text-center py-4 text-gray-400 text-sm">No types found.</td></tr>
                  ) : (
                    summary.igen_expense_type_breakdown.map((m, i) => (
                      <tr key={i} className="hover:bg-rose-50/30 border-b border-gray-50 last:border-0 transition-colors">
                        <td className="px-3 py-2.5 text-sm text-gray-700 font-medium">{m.type}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-rose-700">₹ {inr(m.amount)}</td>
                      </tr>
                    ))
                  )}
                </Table>
              </div>
            </div>
            <div>
              <div className="mb-2 block text-gray-700 font-bold uppercase tracking-wider text-[10px]">By Cost Centre</div>
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <Table headers={["Cost Centre", "Amount"]}>
                  {(!summary.igen_expense_cc_breakdown || summary.igen_expense_cc_breakdown.length === 0) ? (
                    <tr><td colSpan="2" className="text-center py-4 text-gray-400 text-sm">No cost centres found.</td></tr>
                  ) : (
                    summary.igen_expense_cc_breakdown.map((m, i) => (
                      <tr key={i} className="hover:bg-rose-50/30 border-b border-gray-50 last:border-0 transition-colors">
                        <td className="px-3 py-2.5 text-sm text-gray-700 font-medium">{m.cost_centre}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-rose-700">₹ {inr(m.amount)}</td>
                      </tr>
                    ))
                  )}
                </Table>
              </div>
            </div>
          </div>
        </Card>
      )}

      {showPending && (
        <Card
          title="Rent Pending Apartments / Properties"
          subtitle={`Detailed list of occupied properties with outstanding rent for ${selectedMonth}`}
          className="border-yellow-100 shadow-amber-50"
          right={
            <Button variant="outline" size="sm" onClick={() => setShowPending(false)}>
              Close List
            </Button>
          }
        >
          <div className="mb-4">
            {pendingData.unmapped_received > 0 && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 mb-3 text-sm text-amber-800 rounded">
                <span className="font-bold">NOTE:</span> The total KPI includes <b>₹ {inr(pendingData.unmapped_received)}</b> in rent receipts that are not currently linked to any specific property ID. Please link them in 'Review & Classify' to reconcile the list.
              </div>
            )}
          </div>

          <Table
            headers={[
              "Prop ID",
              "Property/Flat",
              "Tenant",
              "Monthly Rent",
              "Expected (Pro-rated)",
              "Received (Prop)",
              "Pending Amount",
            ]}
          >
            {pendingLoading ? (
              <tr>
                <td colSpan="7" className="text-center py-10 text-gray-400">
                  Calculating pending rent...
                </td>
              </tr>
            ) : pendingData.rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-10 text-gray-400">
                  No properties found with pending rent for this month.
                </td>
              </tr>
            ) : (
              paginatedPending.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-3">{r.property_id}</td>
                  <td className="px-4 py-3 font-medium">{r.property_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.tenant_name}</td>
                  <td className="px-4 py-3 font-mono">{inr(r.monthly_rent)}</td>
                  <td className="px-4 py-3 font-mono text-blue-600 font-medium">
                    {inr(r.expected_rent)}
                  </td>
                  <td className="px-4 py-3 font-mono text-emerald-600 font-medium">
                    {inr(r.received_rent)}
                  </td>
                  <td
                    className={`px-4 py-3 font-mono font-bold ${r.pending_amount < 0 ? "text-rose-600" : "text-amber-600"
                      }`}
                  >
                    {inr(r.pending_amount)}
                  </td>
                </tr>
              ))
            )}
          </Table>
          <div className="mt-4">
            <Pagination
              page={pendingPage}
              pageSize={DRILL_PAGE_SIZE}
              total={pendingData.rows.length}
              onPageChange={setPendingPage}
            />
          </div>
        </Card>
      )}

      {showServiceCharge && (
        <Card
          title="iGen Service Charge Breakdown"
          subtitle={`Collection summary and property-level details for ${selectedMonth}`}
          className="border-blue-100 shadow-blue-50"
          right={
            <Button variant="outline" size="sm" onClick={() => setShowServiceCharge(false)}>
              Close List
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                Summary by Type
              </h4>
              <div className="space-y-2">
                {serviceChargeData.summaries.map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">{s.type_name}</span>
                    <span className="font-bold text-blue-700">₹ {inr(s.total_amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-sm p-2 bg-blue-50 rounded border border-blue-100">
                  <span className="font-bold text-blue-900 uppercase text-[10px]">Total Collected</span>
                  <span className="font-black text-blue-900 text-lg">
                    ₹ {inr(serviceChargeData.summaries.reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {serviceChargeData.unmapped_total > 0 && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 text-sm text-amber-800 rounded shadow-sm h-full">
                  <div className="flex gap-2">
                    <span className="text-amber-600 font-bold border-r pr-2">NOTE</span>
                    <div>
                      <strong className="block mb-1 font-bold">Unmapped Service Charges</strong>
                      The total KPI includes <b className="text-amber-900">₹ {inr(serviceChargeData.unmapped_total)}</b> in receipts that are not linked to any specific property ID.
                      <p className="mt-2 text-xs italic opacity-80">Link these in 'Review & Classify' for property-level accuracy.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <h4 className="text-sm font-semibold text-gray-700 mb-3 ml-1 uppercase tracking-wider text-[11px]">Property-Level Variance Analysis</h4>
          <Table headers={["Property", "Tenant", "Expected (Pro-rated)", "Collected (Bank)", "Variance / Gap"]}>
            {serviceChargeLoading ? (
              <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-medium">Loading analysis...</td></tr>
            ) : serviceChargeData.rows.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-medium">No service charge records or expectations for this period.</td></tr>
            ) : (
              paginatedSC.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 text-sm transition-colors border-b last:border-0 align-top">
                  <td className="px-3 py-3 font-semibold text-gray-800 leading-tight">
                    {r.property_name}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{r.tenant_name}</td>
                  <td className="px-3 py-3 font-mono text-gray-500 italic">₹ {inr(r.expected_amount)}</td>
                  <td className="px-3 py-3 font-mono font-bold text-emerald-600">
                    <div>₹ {inr(r.collected_amount)}</div>
                    {r.details && r.details.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {r.details.map((d, dIdx) => (
                          <div key={dIdx} className="text-[9px] text-gray-400 flex justify-between gap-2 border-t border-gray-50 pt-0.5">
                            <span>{d.date}</span>
                            <span className="font-bold opacity-70">{d.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-3 font-mono font-black ${parseFloat(r.variance) < 0 ? 'text-rose-600' : parseFloat(r.variance) > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                    ₹ {inr(r.variance)}
                    {parseFloat(r.variance) !== 0 && (
                      <div className="text-[9px] uppercase opacity-60">
                        {parseFloat(r.variance) < 0 ? 'Shortfall / Pending' : 'Surplus / Advance'}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </Table>
          <div className="mt-4">
            <Pagination
              page={scPage}
              pageSize={DRILL_PAGE_SIZE}
              total={serviceChargeData.rows.length}
              onPageChange={setScPage}
            />
          </div>
        </Card>
      )}

      {showMaintenance && (
        <Card
          title="Maintenance / Expenses Breakdown"
          subtitle={`Owner-recoverable expenses for ${selectedMonth} (Rental/Sale Cost Centres)`}
          className="border-blue-100 shadow-blue-50 mb-6"
          right={
            <Button variant="outline" size="sm" onClick={() => setShowMaintenance(false)}>
              Close List
            </Button>
          }
        >
          <Table headers={["Date", "Property", "Cost Centre", "Description", "Base", "Margin", "Total", "Src"]}>
            {maintenanceLoading ? (
              <tr><td colSpan="8" className="text-center py-10 text-gray-400 font-medium">Loading details...</td></tr>
            ) : maintenanceData.rows.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-10 text-gray-400 font-medium">No recoverable expenses found for this period.</td></tr>
            ) : (
              paginatedMaint.map((r, idx) => (
                <tr key={idx} className="hover:bg-gray-50 text-sm transition-colors border-b last:border-0">
                  <td className="px-3 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.property_name}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] uppercase font-bold">
                      {r.cost_centre}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-600 max-w-[200px] truncate" title={r.remarks || r.txn_type}>
                    {r.remarks || r.txn_type}
                  </td>
                  <td className="px-3 py-3 font-mono text-gray-500">₹ {inr(r.base_amount)}</td>
                  <td className="px-3 py-3 font-mono text-amber-600">₹ {inr(r.margin_amount)}</td>
                  <td className="px-3 py-3 font-mono font-bold text-blue-600">₹ {inr(r.total_collectible)}</td>
                  <td className="px-3 py-3">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter ${r.source === 'BANK' ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
                      {r.source}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </Table>
          <div className="mt-4">
            <Pagination
              page={maintPage}
              pageSize={DRILL_PAGE_SIZE}
              total={maintenanceData.rows.length}
              onPageChange={setMaintPage}
            />
          </div>
        </Card>
      )}

      {showInspections && (
        <Card
          title={`Inspections ${inspectionType === "upcoming" ? "Upcoming" : "Expired"}`}
          subtitle={`Properties that have an inspection ${inspectionType === "upcoming" ? "due soon" : "that was missed"}.`}
          className="border-emerald-100 shadow-emerald-50 mb-6"
          right={
            <div className="flex gap-2">
              <Button
                variant={inspectionType === "upcoming" ? "solid" : "outline"}
                size="sm"
                onClick={() => setInspectionType("upcoming")}
              >
                Show Upcoming
              </Button>
              <Button
                variant={inspectionType === "expired" ? "solid" : "outline"}
                size="sm"
                onClick={() => setInspectionType("expired")}
              >
                Show Expired
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowInspections(false)}>
                Close List
              </Button>
            </div>
          }
        >
          <Table
            headers={[
              "Property/Flat",
              "Inspection Date",
              "Days Left",
              "Tenant",
              "Owner",
              "Project Manager",
            ]}
          >
            {inspectionLoading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-gray-500">Loading details...</td></tr>
            ) : inspectionData.rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-gray-500 text-center">No properties found.</td></tr>
            ) : (
              paginatedIns.map((p) => (
                <tr
                  key={p.property_id}
                  className="hover:bg-gray-50 border-b border-gray-100 cursor-pointer"
                  onClick={() => navigate(`/properties?editId=${p.property_id}`)}
                >
                  <td className="px-3 py-2 font-medium text-blue-600">{p.property_name}</td>
                  <td className="px-3 py-2 text-sm">
                    {p.inspection_date || "N/A"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.days_left <= 1 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {p.days_left === 0 ? "Today" : `${p.days_left} days left`}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">{p.tenant_name}</td>
                  <td className="px-3 py-2 text-sm">{p.owner_name}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">{p.project_manager}</td>
                </tr>
              ))
            )}
          </Table>
          <div className="mt-4">
            <Pagination
              page={insPage}
              pageSize={DRILL_PAGE_SIZE}
              total={inspectionData.rows.length}
              onPageChange={setInsPage}
            />
          </div>
        </Card>
      )}

      {showRenewals && (
        <Card
          title={`Agreement ${renewalType === "upcoming" ? "Renewals (Next 30 Days)" : "Expired"}`}
          subtitle={`Occupied properties with agreements ${renewalType === "upcoming" ? "expiring soon" : "that have already expired"}.`}
          className="border-rose-100 shadow-rose-50 mb-6"
          right={
            <div className="flex gap-2">
              <Button
                variant={renewalType === "upcoming" ? "solid" : "outline"}
                size="sm"
                onClick={() => setRenewalType("upcoming")}
              >
                Show Upcoming
              </Button>
              <Button
                variant={renewalType === "expired" ? "solid" : "outline"}
                size="sm"
                onClick={() => setRenewalType("expired")}
              >
                Show Expired
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRenewals(false)}>
                Close List
              </Button>
            </div>
          }
        >
          <Table
            headers={[
              "Property/Flat",
              "Tenant",
              "Agreement Expiry Date",
              "Days Left/Overdue",
              "Owner",
            ]}
          >
            {renewalLoading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-gray-500">Loading details...</td></tr>
            ) : renewalData.rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-gray-500 text-center">No agreements found.</td></tr>
            ) : (
              paginatedRen.map((p) => (
                <tr
                  key={p.property_id}
                  className="hover:bg-gray-50 border-b border-gray-100 cursor-pointer"
                  onClick={() => navigate(`/properties?editId=${p.property_id}`)}
                >
                  <td className="px-3 py-2 font-medium text-blue-600">{p.property_name}</td>
                  <td className="px-3 py-2 text-sm">{p.tenant_name}</td>
                  <td className="px-3 py-2 text-sm">{p.expiry_date || "N/A"}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.days_left < 0 ? "bg-rose-100 text-rose-700" : (p.days_left <= 7 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}`}>
                      {p.days_left < 0 ? `${Math.abs(p.days_left)} days overdue` : (p.days_left === 0 ? "Today" : `${p.days_left} days left`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">{p.owner_name}</td>
                </tr>
              ))
            )}
          </Table>
          <div className="mt-4">
            <Pagination
              page={renPage}
              pageSize={DRILL_PAGE_SIZE}
              total={renewalData.rows.length}
              onPageChange={setRenPage}
            />
          </div>
        </Card>
      )}

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
