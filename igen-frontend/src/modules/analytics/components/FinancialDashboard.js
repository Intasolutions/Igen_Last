// src/modules/analytics/components/FinancialDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import API from "../../../api/axios";
import {
  ALL_DIMS,
  Card,
  Toolbar,
  Label,
  Input,
  Button,
  Table,
  Pagination,
  ExportMenu,
  MultiSelect,
  inr,
  toNumber,
  thisYearStart,
  todayLocal,
} from "./analyticsCommon";

// --- TEMP shim so earlier components can reference exportXlsx ---
let exportXlsx = () => {
  alert("Export is available in the main Financial Dashboard section.");
};
// --- end shim ---

function FinancialDashboard() {
  const [dims, setDims] = useState(["cost_centre", "txn_type", "entity"]);
  const [dateOn, setDateOn] = useState(false);
  const [gran, setGran] = useState("month"); // day | month | quarter | year

  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());

  // flow state
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [dimOptions, setDimOptions] = useState({}); // {dim: [{value,label}]}
  const [dimValues, setDimValues] = useState({}); // {dim: [value,...]}

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const defaultHeaders = useMemo(() => {
    const base = [...(dateOn ? ["date"] : []), ...dims, "credit", "debit", "margin"];
    return base;
  }, [dateOn, dims]);

  const headers = rows.length ? Object.keys(rows[0]) : defaultHeaders;

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page]
  );

  const toggleDim = (d) =>
    setDims((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  // Helper: load distinct values for a dimension via existing pivot API
  const fetchDimValues = async (dim) => {
    try {
      const res = await API.post("analytics/pivot/", {
        dims: [dim],
        values: {},
        from,
        to,
        date_granularity: null,
      });
      const uniq = Array.from(new Set((res.data?.rows || []).map((r) => r[dim] ?? "—"))).sort();
      return uniq.map((v) => ({ value: v, label: v }));
    } catch (e) {
      console.error("Failed fetching values for", dim, e);
      return [];
    }
  };

  const onGenerate = async () => {
    setFiltersVisible(true);
    const targetDims = dims.filter((d) => d !== "date");
    const result = {};
    for (const d of targetDims) {
      result[d] = await fetchDimValues(d);
    }
    setDimOptions(result);
    // user clicks Search after choosing filters
  };

  const buildValuesPayload = () => {
    const payload = {};
    for (const d of dims) {
      if (d === "date") continue;
      const vals = dimValues[d];
      if (vals && vals.length) payload[d] = vals; // strings
    }
    return payload;
  };

  const runPivot = async () => {
    setLoading(true);
    try {
      const finalDims = dateOn ? [...dims, "date"] : dims;
      const res = await API.post("analytics/pivot/", {
        dims: finalDims,
        values: buildValuesPayload(),
        from,
        to,
        date_granularity: dateOn ? gran : null,
      });
      setRows(res.data?.rows || []);
      setTotals(res.data?.totals || null);
    } catch (e) {
      console.error(e);
      alert("Failed to generate pivot.");
    } finally {
      setLoading(false);
    }
  };

  // real export: overrides top-level shim for the main dashboard only
  exportXlsx = async () => {
    try {
      const finalDims = dateOn ? [...dims, "date"] : dims;

      const res = await API.post(
        "analytics/pivot/export/",
        {
          dims: finalDims,
          values: buildValuesPayload(),
          from,
          to,
          date_granularity: dateOn ? gran : null,
        },
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial_dashboard_${from}_${to}.xlsx`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      console.error(e);
      alert("Failed to export.");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Financial Dashboard"
        subtitle="Pick dimensions → add filters → search"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={onGenerate}>
              Generate
            </Button>
            <ExportMenu
              label="Export"
              options={[
                {
                  label: "Excel (.xlsx)",
                  onClick: exportXlsx,
                },
              ]}
            />
          </div>
        }
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Dimensions</div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_DIMS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dims.includes(d)} onChange={() => toggleDim(d)} />
                  {d}
                </label>
              ))}

              <label className="flex items-center gap-2 text-sm col-span-2 mt-1">
                <input
                  type="checkbox"
                  checked={dateOn}
                  onChange={() => setDateOn((v) => !v)}
                />
                date
                {dateOn && (
                  <select
                    className="ml-2 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                    value={gran}
                    onChange={(e) => setGran(e.target.value)}
                  >
                    <option value="day">day</option>
                    <option value="month">month</option>
                    <option value="quarter">quarter</option>
                    <option value="year">year</option>
                  </select>
                )}
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="flex gap-2 sm:hidden">
              <Button variant="outline" onClick={onGenerate}>
                Generate
              </Button>
              <ExportMenu
                label="Export"
                options={[
                  {
                    label: "Excel (.xlsx)",
                    onClick: exportXlsx,
                  },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Dynamic filter panel */}
        {filtersVisible && (
          <div className="mt-4 p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div className="text-sm font-medium text-gray-900 mb-2">Filters</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dims
                .filter((d) => d !== "date")
                .map((d) => (
                  <MultiSelect
                    key={d}
                    label={d}
                    options={dimOptions[d] || []}
                    value={dimValues[d] || []}
                    onChange={(vals) => setDimValues((s) => ({ ...s, [d]: vals }))}
                    placeholder="All"
                  />
                ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDimValues({});
                  runPivot();
                }}
              >
                Search (All)
              </Button>
              <Button onClick={runPivot}>Search (With filters)</Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Pivot Result"
        subtitle="Grouped totals and margins"
        right={
          totals ? (
            <div className="text-sm text-gray-700">
              <span className="mr-4">
                <b>Credit:</b> ₹ {inr(totals.credit)}
              </span>
              <span className="mr-4">
                <b>Debit:</b> ₹ {inr(totals.debit)}
              </span>
              <span className="mr-4">
                <b>Margin:</b>{" "}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    toNumber(totals.margin) >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  ₹ {inr(totals.margin)}
                </span>
              </span>
              <span>
                <b>Balance:</b> ₹ {inr(totals.balance)}
              </span>
            </div>
          ) : null
        }
      >
        <Table
          headers={headers}
          foot={
            <tfoot>
              <tr>
                <td colSpan={headers.length} className="px-3 py-2">
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={rows.length}
                    onPageChange={setPage}
                  />
                </td>
              </tr>
            </tfoot>
          }
        >
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={headers.length}>
                No data
              </td>
            </tr>
          )}
          {paginatedRows.map((r, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2">
                  {["credit", "debit", "margin"].includes(h) ? `₹ ${inr(r[h])}` : r[h] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

export default FinancialDashboard;
