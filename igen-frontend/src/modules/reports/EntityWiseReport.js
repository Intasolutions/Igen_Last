
import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/axios";

/* ------------------------------------------------------------------ */
/* helpers (aligned with analytics.js style)                           */
/* ------------------------------------------------------------------ */

const fmtLocal = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayLocal = () => fmtLocal(new Date());
const firstOfMonthLocal = () =>
  fmtLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const toNumber = (x) => {
  if (x === null || x === undefined || x === "") return 0;
  const n = typeof x === "string" ? parseFloat(x.replace(/,/g, "")) : Number(x);
  return Number.isFinite(n) ? n : 0;
};
const inr = (x) =>
  toNumber(x).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const formatDateDDMonYYYY = (iso) => {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const day = String(dt.getDate()).padStart(2, "0");
  const mon = dt.toLocaleString("en-GB", { month: "short" });
  const yr = dt.getFullYear();
  return `${day}-${mon}-${yr}`;
};

const getId = (obj) =>
  obj?.id ?? obj?.entity_id ?? obj?.cost_centre_id ?? obj?.transaction_type_id;

const getName = (obj) =>
  obj?.name ??
  obj?.entity_name ??
  obj?.cost_centre_name ??
  obj?.transaction_type_name ??
  "";

/* ------------------------------------------------------------------ */
/* tiny UI kit (same vibe as analytics.js)                            */
/* ------------------------------------------------------------------ */

const Card = ({ title, subtitle, right, children }) => (
  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70 overflow-hidden">
    <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-3">
      <div>
        {subtitle ? (
          <div className="text-xs text-gray-500">{subtitle}</div>
        ) : null}
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
          {title}
        </h3>
      </div>
      {right}
    </div>
    <div className="p-4 sm:p-6">{children}</div>
  </div>
);

const Toolbar = ({ children }) => (
  <div className="flex flex-wrap items-end gap-3">{children}</div>
);

const Label = ({ children }) => (
  <label className="block text-xs font-medium text-gray-600">
    {children}
  </label>
);

const Input = (props) => (
  <input
    {...props}
    className={`h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200 ${
      props.className || ""
    }`}
  />
);

const Button = ({
  variant = "solid",
  children,
  className = "",
  disabled,
  ...rest
}) => {
  const base =
    "h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0";
  const variants = {
    solid: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300",
    outline:
      "border border-gray-300 text-gray-800 hover:bg-gray-50 focus:ring-gray-300",
    subtle: "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300",
  };
  const disabledCls = disabled
    ? "opacity-50 cursor-not-allowed pointer-events-none"
    : "";
  return (
    <button
      className={`${base} ${variants[variant]} ${disabledCls} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

const Table = ({ headers, children, foot }) => (
  <div className="overflow-auto rounded-xl ring-1 ring-gray-200 bg-white">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50 text-gray-700">
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className={`px-3 py-2 text-left font-semibold ${
                i === headers.length - 1 ? "pr-4" : ""
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
      {foot}
    </table>
  </div>
);

/* ------------------------------------------------------------------ */
/* Classic Select (native <select> styled like your 3rd screenshot)    */
/* ------------------------------------------------------------------ */

const Select = ({
  options = [], // [{id, name}]
  value = "",
  onChange,
  placeholder = "All",
  className = "",
  style,
}) => (
  <div className={`relative ${className}`} style={style}>
    <select
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-9 w-full rounded-lg border border-gray-300 bg-white pr-8 pl-3 text-sm text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200 appearance-none"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
    {/* caret icon */}
    <svg
      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  </div>
);

/* ------------------------------------------------------------------ */
/* Entity Wise Report (Tailwind-styled)                                */
/* ------------------------------------------------------------------ */

export default function EntityWiseReport() {
  const [filters, setFilters] = useState({
    start_date: firstOfMonthLocal(),
    end_date: todayLocal(),
    entity: "",
    cost_centre: "",
    transaction_type: "",
    source: "",
    min_amount: "",
    max_amount: "",
  });

  const [entities, setEntities] = useState([]);
  const [costCentres, setCostCentres] = useState([]);
  const [transactionTypes, setTransactionTypes] = useState([]);

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_credit: 0,
    total_debit: 0,
    net: 0,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // options for selects
  const entityOptions = useMemo(
    () => entities.map((x) => ({ id: getId(x), name: getName(x) })),
    [entities]
  );
  const costCentreOptions = useMemo(
    () => costCentres.map((x) => ({ id: getId(x), name: getName(x) })),
    [costCentres]
  );
  const txTypeOptions = useMemo(
    () => transactionTypes.map((x) => ({ id: getId(x), name: getName(x) })),
    [transactionTypes]
  );
  const sourceOptions = useMemo(
    () => [
      { id: "BANK", name: "Bank" },
      { id: "CASH", name: "Cash" },
    ],
    []
  );

  // param builder
  const buildParams = useMemo(
    () => (overrides = {}) => {
      const base = { ...filters, ...overrides };
      const toNumOrEmpty = (v) => {
        if (v === "" || v === null || v === undefined) return "";
        const n = Number(v);
        return Number.isFinite(n) ? n : "";
      };
      const compact = Object.fromEntries(
        Object.entries({
          ...base,
          min_amount: toNumOrEmpty(base.min_amount),
          max_amount: toNumOrEmpty(base.max_amount),
        }).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      return compact;
    },
    [filters]
  );

  const validate = () => {
    const { start_date, end_date, entity, min_amount, max_amount } = filters;
    if (!start_date || !end_date) {
      setErr("Please select both Start Date and End Date.");
      return false;
    }
    if (start_date > end_date) {
      setErr("Start Date cannot be after End Date.");
      return false;
    }
    if (!entity) {
      setErr("Entity is required.");
      return false;
    }
    if (min_amount !== "" && max_amount !== "") {
      const min = Number(min_amount);
      const max = Number(max_amount);
      if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
        setErr("Min Amount cannot be greater than Max Amount.");
        return false;
      }
    }
    setErr("");
    return true;
  };

  const fetchReport = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const params = { ...buildParams(), page_size: 1000 };
      const list = await API.get("reports/entity-report/", { params });
      setRows(list.data?.results ?? list.data ?? []);

      const sum = await API.get("reports/entity-report/summary/", {
        params: buildParams(),
      });
      setSummary(sum.data ?? { total_credit: 0, total_debit: 0, net: 0 });
    } catch (e) {
      console.error(e);
      const detail = e?.response?.data?.detail;
      setErr(detail || "Failed to fetch report.");
      setRows([]);
      setSummary({ total_credit: 0, total_debit: 0, net: 0 });
    } finally {
      setLoading(false);
    }
  };

  const exportXlsx = async () => {
    if (!validate()) return;
    try {
      const res = await API.get("reports/entity-report/export/", {
        params: buildParams(),
        responseType: "blob",
      });
      if (res.status === 204) {
        alert("No data to export.");
        return;
      }
      const cd = res.headers?.["content-disposition"] || "";
      const match = /filename\*?=(?:UTF-8''|")?([^"]+)/i.exec(cd);
      const filename = match
        ? decodeURIComponent(match[1])
        : "entity_wise_report.xlsx";
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed");
    }
  };

  // masters
  useEffect(() => {
    (async () => {
      try {
        const [e, c, t] = await Promise.all([
          API.get("entities/"),
          API.get("cost-centres/"),
          API.get("transaction-types/"),
        ]);
        setEntities(e.data?.results ?? e.data ?? []);
        setCostCentres(c.data?.results ?? c.data ?? []);
        setTransactionTypes(t.data?.results ?? t.data ?? []);
      } catch (e) {
        console.error(e);
        setErr("Failed to load master data.");
      }
    })();
  }, []);

  const reset = () =>
    setFilters({
      start_date: firstOfMonthLocal(),
      end_date: todayLocal(),
      entity: "",
      cost_centre: "",
      transaction_type: "",
      source: "",
      min_amount: "",
      max_amount: "",
    });

  /* ----------------------------- UI ----------------------------- */

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Reports</div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Entity-wise Report
          </h1>
        </div>
      </div>

      {/* Filters */}
      <Card
        title="Filters"
        subtitle="Choose date range, entity, and optional constraints"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={reset}>
              Reset
            </Button>
            <Button variant="outline" onClick={exportXlsx} disabled={!filters.entity}>
              Export
            </Button>
            <Button onClick={fetchReport} disabled={!filters.entity}>
              Search
            </Button>
          </div>
        }
      >
        <Toolbar>
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={filters.start_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, start_date: e.target.value }))
              }
              style={{ width: 160 }}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={filters.end_date}
              onChange={(e) =>
                setFilters((f) => ({ ...f, end_date: e.target.value }))
              }
              style={{ width: 160 }}
            />
          </div>

          <div style={{ width: 220 }}>
            <Label>Entity</Label>
            <Select
              options={entityOptions}
              value={filters.entity}
              onChange={(id) => setFilters((f) => ({ ...f, entity: id }))}
              placeholder="Select entity…"
            />
          </div>

          <div style={{ width: 220 }}>
            <Label>Cost Centre</Label>
            <Select
              options={costCentreOptions}
              value={filters.cost_centre}
              onChange={(id) => setFilters((f) => ({ ...f, cost_centre: id }))}
              placeholder="All cost centres"
            />
          </div>

          <div style={{ width: 220 }}>
            <Label>Transaction Type</Label>
            <Select
              options={txTypeOptions}
              value={filters.transaction_type}
              onChange={(id) =>
                setFilters((f) => ({ ...f, transaction_type: id }))
              }
              placeholder="All transaction types"
            />
          </div>

          <div style={{ width: 180 }}>
            <Label>Source</Label>
            <Select
              options={sourceOptions}
              value={filters.source}
              onChange={(id) => setFilters((f) => ({ ...f, source: id }))}
              placeholder="All sources"
            />
          </div>

          <div>
            <Label>Min Amount</Label>
            <Input
              placeholder="e.g. 1000"
              value={filters.min_amount}
              onChange={(e) =>
                setFilters((f) => ({ ...f, min_amount: e.target.value }))
              }
              style={{ width: 140 }}
              inputMode="decimal"
            />
          </div>
          <div>
            <Label>Max Amount</Label>
            <Input
              placeholder="e.g. 50000"
              value={filters.max_amount}
              onChange={(e) =>
                setFilters((f) => ({ ...f, max_amount: e.target.value }))
              }
              style={{ width: 140 }}
              inputMode="decimal"
            />
          </div>

          {/* mobile actions */}
          <div className="flex gap-2 sm:hidden w-full">
            <Button variant="outline" onClick={reset} className="flex-1">
              Reset
            </Button>
            <Button
              variant="outline"
              onClick={exportXlsx}
              disabled={!filters.entity}
              className="flex-1"
            >
              Export
            </Button>
            <Button
              onClick={fetchReport}
              disabled={!filters.entity}
              className="flex-1"
            >
              Apply
            </Button>
          </div>
        </Toolbar>

        {err && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 text-sm">
            {err}
          </div>
        )}
      </Card>

      {/* Summary strip */}
      <Card title="Summary" subtitle="Totals for the selected filters">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 p-4 bg-blue-50">
            <div className="text-xs text-blue-700">Total Credit</div>
            <div className="text-xl font-semibold text-gray-900">
              ₹ {inr(summary.total_credit)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 bg-blue-50">
            <div className="text-xs text-blue-700">Total Debit</div>
            <div className="text-xl font-semibold text-gray-900">
              ₹ {inr(summary.total_debit)}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4 bg-blue-50">
            <div className="text-xs text-blue-700">Net</div>
            <div className="text-xl font-semibold text-gray-900">
              ₹ {inr(summary.net)}
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card
        title="Transactions"
        subtitle={`Showing ${rows.length} ${
          rows.length === 1 ? "record" : "records"
        }`}
      >
        <Table
          headers={[
            "Date",
            "Source",
            "Amount (Cr)",
            "Amount (Dr)",
            "Cost Centre",
            "Entity",
            "Transaction Type",
            "Asset",
            "Contract",
            "Remarks",
          ]}
        >
          {loading && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={10}>
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td className="px-3 py-10 text-gray-500" colSpan={10}>
                No transactions found. Try changing the <b>Entity</b>, widening
                the <b>Date Range</b>, or clearing optional filters.
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((r, i) => {
              const amt =
                typeof r.amount === "number" ? r.amount : parseFloat(r.amount);
              const credit = amt > 0 ? amt : null;
              const debit = amt < 0 ? Math.abs(amt) : null;
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{formatDateDDMonYYYY(r.date)}</td>
                  <td className="px-3 py-2">{r.source || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {credit ? `₹ ${inr(credit)}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {debit ? `₹ ${inr(debit)}` : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {r.cost_centre_name || r.cost_centre?.name || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {r.entity_name || r.entity?.name || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {r.transaction_type_name || r.transaction_type?.name || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {r.asset_name || r.asset?.name || "-"}
                  </td>
                  <td className="px-3 py-2">
                    {r.contract_name || r.contract?.name || "-"}
                  </td>
                  <td className="px-3 py-2">{r.remarks || "-"}</td>
                </tr>
              );
            })}
          {rows.length > 0 && (
            <tr className="bg-blue-50 font-semibold">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right">
                ₹ {inr(summary.total_credit)}
              </td>
              <td className="px-3 py-2 text-right">
                ₹ {inr(summary.total_debit)}
              </td>
              <td className="px-3 py-2" colSpan={6}>
                Net: ₹ {inr(summary.net)}
              </td>
            </tr>
          )}
        </Table>
      </Card>
    </div>
  );
}
