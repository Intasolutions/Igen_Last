// igen-frontend/src/modules/analytics/analyticsManagement.js
import React, { useEffect, useMemo, useState } from "react";
import API from "../../api/axios"; // baseURL = http://127.0.0.1:8000/api/

// ----------------------------- helpers -----------------------------
const ALL_DIMS = ["cost_centre", "txn_type", "entity", "asset", "contract"];

const fmtLocal = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const thisYearStart = () => fmtLocal(new Date(new Date().getFullYear(), 0, 1));
const todayLocal = () => fmtLocal(new Date());
const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

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

const toneClass = {
  blue: { bg: "bg-blue-50", text: "text-blue-700" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
  rose: { bg: "bg-rose-50", text: "text-rose-700" },
};

// --- shared helpers ---
const genCurrentMonth = () => new Date().toISOString().slice(0, 7);

const openEntityStatementPDF = async (entityId, month) => {
  if (!entityId || !month) return;
  const res = await API.get("analytics/entity-statement/pdf/", {
    params: { entity_id: entityId, month },
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `entity_${entityId}_${month}_statement.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};

// ----------------------------- tiny UI bits -----------------------------
const Card = ({ title, subtitle, right, children }) => (
  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70 overflow-hidden">
    <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-3">
      <div>
        {subtitle ? <div className="text-xs text-gray-500">{subtitle}</div> : null}
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
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
  <label className="block text-xs font-medium text-gray-600">{children}</label>
);

const Input = (props) => (
  <input
    {...props}
    className={`h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200 ${props.className || ""}`}
  />
);

const Button = ({ variant = "solid", children, className = "", disabled, ...rest }) => {
  const base =
    "h-9 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0";
  const variants = {
    solid: "bg-gray-900 text-white hover:bg-black focus:ring-gray-300",
    outline: "border border-gray-300 text-gray-800 hover:bg-gray-50 focus:ring-gray-300",
    subtle: "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300",
    ghost: "text-gray-700 hover:bg-gray-100 focus:ring-gray-300",
  };
  const disabledCls = disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "";
  return (
    <button className={`${base} ${variants[variant]} ${disabledCls} ${className}`} disabled={disabled} {...rest}>
      {children}
    </button>
  );
};

const Tab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
      active ? "bg-gray-900 text-white" : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
    }`}
  >
    {children}
  </button>
);

const Table = ({ headers, children, foot }) => (
  <div className="overflow-auto rounded-xl ring-1 ring-gray-200 bg-white">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50 text-gray-700">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className={`px-3 py-2 text-left font-semibold ${i === headers.length - 1 ? "pr-4" : ""}`}>
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

const Metric = ({ title, value, tone = "blue" }) => {
  const t = toneClass[tone] || toneClass.blue;
  return (
    <div className={`rounded-xl border border-gray-200 p-4 ${t.bg}`}>
      <div className={`text-xs ${t.text}`}>{title}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
};

// ----------------------------- Entity Autocomplete (Searchable Dropdown) -----------------------------
function EntityPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]); // [{id,name}]
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!open) return;
      setLoading(true);
      try {
        const res = await API.get("analytics/entities/search/", {
          params: { q, limit: 20 },
        });
        if (!cancelled) setOptions(res.data || []);
      } catch (e) {
        console.error(e);
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [open, q]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <Input
          placeholder={value ? value.name : "Search entity"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          style={{ width: 240 }}
        />
        {value ? (
          <Button variant="outline" onClick={() => onChange(null)}>Clear</Button>
        ) : null}
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-[320px] max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white shadow">
          {loading && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
          )}
          {!loading && options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
          )}
          {!loading &&
            options.map((opt) => (
              <div
                key={opt.id}
                onMouseDown={() => onChange(opt)}
                className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                {opt.name} <span className="text-gray-400">#{opt.id}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------- R1: Entity Statement -----------------------------
function EntityStatement() {
  const [entity, setEntity] = useState(null); // {id,name}
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!entity || !month) return;
    setLoading(true);
    try {
      const res = await API.get("analytics/entity-statement/", { params: { entity_id: entity.id, month } });
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load entity statement.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!entity || !month) return;
    try {
      await openEntityStatementPDF(entity.id, month);
    } catch (e) {
      console.error(e);
      alert("Could not export PDF.");
    }
  };

  const downloadDOCX = async () => {
    if (!entity || !month) return;
    try {
      const res = await API.get("analytics/entity-statement/docx/", {
        params: { entity_id: entity.id, month },
        responseType: "blob",
      });
      const url = URL.createObjectURL(
        new Blob([res.data], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `entity_${entity.id}_${month}_statement.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not export Word.");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Entity-wise Monthly Statement"
        subtitle="Drill into a single entity for a specific month"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={load} disabled={!entity || !month}>
              Load
            </Button>
            <Button variant="outline" onClick={downloadPDF} disabled={!entity || !month}>
              Export PDF
            </Button>
            <Button onClick={downloadDOCX} disabled={!entity || !month}>
              Export Word
            </Button>
          </div>
        }
      >
        <Toolbar>
          <div>
            <Label>Entity</Label>
            <EntityPicker value={entity} onChange={setEntity} />
          </div>
          <div>
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160 }} />
          </div>
          <div className="flex gap-2 sm:hidden">
            <Button variant="outline" onClick={load} disabled={!entity || !month}>
              Load
            </Button>
            <Button variant="outline" onClick={downloadPDF} disabled={!entity || !month}>
              Export PDF
            </Button>
            <Button onClick={downloadDOCX} disabled={!entity || !month}>
              Export Word
            </Button>
          </div>
        </Toolbar>
      </Card>

      <Card title="Transactions" subtitle="With running balance">
        <Table headers={["Date", "Type", "Credit (₹)", "Debit (₹)", "Balance (₹)", "Remarks"]}>
          {loading && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={6}>
                Loading…
              </td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={6}>
                No data
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2">{r.date || r.value_date}</td>
                <td className="px-3 py-2">{r.transaction_type || r.txn_type || "—"}</td>
                <td className="px-3 py-2 text-right">{inr(r.credit)}</td>
                <td className="px-3 py-2 text-right">{inr(r.debit)}</td>
                <td className="px-3 py-2 text-right">{inr(r.balance)}</td>
                <td className="px-3 py-2">{r.remarks || ""}</td>
              </tr>
            ))}
        </Table>
      </Card>
    </div>
  );
}

// ----------------------------- R2: Maintenance & Interior (YTD) -----------------------------
function MI() {
  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());
  const [summary, setSummary] = useState(null);
  const [entities, setEntities] = useState([]);
  const [active, setActive] = useState({ name: null, id: null });
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([
        API.get("analytics/mi/summary/", { params: { from, to } }),
        API.get("analytics/mi/entities/", { params: { from, to } }),
      ]);
      setSummary(s.data);
      setEntities(e.data || []);
      setActive({ name: null, id: null });
      setTxns([]);
    } catch (e) {
      console.error(e);
      alert("Failed to load M&I.");
    } finally {
      setLoading(false);
    }
  };

  const drill = async (entityName, entityId) => {
    setActive({ name: entityName, id: entityId });
    try {
      const res = await API.get("analytics/mi/transactions/", {
        params: { entity_id: entityId, from, to },
      });
      setTxns(res.data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load transactions.");
    }
  };

  const exportXlsx = async () => {
    try {
      const res = await API.get("analytics/mi/export/", {
        params: { from, to },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mi_entity_balance_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not export.");
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Card
        title="Maintenance & Interior (YTD)"
        subtitle="Entity-wise spend for the selected period"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={load}>
              Update
            </Button>
            <Button onClick={exportXlsx}>Export</Button>
          </div>
        }
      >
        <Toolbar>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2 sm:hidden">
            <Button variant="outline" onClick={load}>
              Update
            </Button>
            <Button onClick={exportXlsx}>Export</Button>
          </div>
        </Toolbar>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">YTD Total</div>
            <div className="text-xl font-semibold text-gray-900">₹ {inr(summary?.ytd_total || 0)}</div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Period</div>
            <div className="text-sm text-gray-900">
              {from} → {to}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">Entities</div>
            <div className="text-xl font-semibold text-gray-900">{entities.length}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Entity Balances" subtitle="Click an entity to view transactions">
          <Table headers={["Entity", "Balance (₹)"]}>
            {loading && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={2}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && entities.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={2}>
                  No data
                </td>
              </tr>
            )}
            {!loading &&
              entities.map((e, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => drill(e.entity, e.id)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{e.entity}</span>
                      <span className="text-xs text-gray-500">#{e.id ?? "—"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">₹ {inr(e.balance)}</td>
                </tr>
              ))}
          </Table>
        </Card>

        <Card
          title={active.name ? `Transactions — ${active.name}` : "Transactions"}
          subtitle={active.name ? "Filtered by entity" : "Select an entity to drill"}
        >
          <Table headers={["Date", "Type", "Credit (₹)", "Debit (₹)", "Balance (₹)", "Remarks"]}>
            {active.name === null && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={6}>
                  Select an entity on the left to view transactions
                </td>
              </tr>
            )}
            {active.name !== null && txns.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={6}>
                  No transactions for this entity in the selected period
                </td>
              </tr>
            )}
            {txns.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2">{r.value_date}</td>
                <td className="px-3 py-2">{r.txn_type || "—"}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.credit)}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.debit)}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.balance)}</td>
                <td className="px-3 py-2">{r.remarks || ""}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------- R4: Project Profitability -----------------------------
function ProjectProfitability() {
  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());
  const [rows, setRows] = useState([]);
  const [txns, setTxns] = useState([]);
  const [active, setActive] = useState(null);

  const load = async () => {
    try {
      const res = await API.get("analytics/project/summary/", { params: { from, to } });
      setRows(res.data || []);
      setActive(null);
      setTxns([]);
    } catch (e) {
      console.error(e);
      alert("Failed to load project summary.");
    }
  };

  const drill = async (projectName, projectId = null) => {
    setActive(projectName);
    try {
      const params = { from, to };
      if (projectId !== null && projectId !== undefined) params.project_id = projectId;
      const res = await API.get("analytics/project/transactions/", { params });
      setTxns(res.data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load project transactions.");
    }
  };

  const exportXlsx = async () => {
    try {
      const res = await API.get("analytics/project/export/", {
        params: { from, to },
        responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_profitability_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not export.");
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <Card
        title="Project Profitability"
        subtitle="Inflows, outflows, and net by project"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={load}>
              Update
            </Button>
            <Button onClick={exportXlsx}>Export</Button>
          </div>
        }
      >
        <Toolbar>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex gap-2 sm:hidden">
            <Button variant="outline" onClick={load}>
              Update
            </Button>
            <Button onClick={exportXlsx}>Export</Button>
          </div>
        </Toolbar>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Summary" subtitle="Click a row to drill transactions">
          <Table headers={["Project", "Inflows (₹)", "Outflows (₹)", "Net (₹)"]}>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={4}>
                  No data
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={i}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => drill(r.project, null)}
              >
                <td className="px-3 py-2">{r.project}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.inflows)}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.outflows)}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      toNumber(r.net) >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    ₹ {inr(r.net)}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card
          title={active ? `Transactions — ${active}` : "Transactions"}
          subtitle={active ? "Filtered by project" : "Select a project to drill"}
        >
          <Table headers={["Date", "Type", "Credit (₹)", "Debit (₹)", "Balance (₹)", "Remarks"]}>
            {!active && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={6}>
                  Select a project on the left to view transactions
                </td>
              </tr>
            )}
            {active && txns.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={6}>
                  No transactions
                </td>
              </tr>
            )}
            {txns.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2">{r.value_date}</td>
                <td className="px-3 py-2">{r.txn_type || "—"}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.credit)}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.debit)}</td>
                <td className="px-3 py-2 text-right">₹ {inr(r.balance)}</td>
                <td className="px-3 py-2">{r.remarks || ""}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------- R5: Financial Dashboard (Pivot) -----------------------------
function FinancialDashboard() {
  const [dims, setDims] = useState(["cost_centre", "txn_type", "entity"]);
  const [dateOn, setDateOn] = useState(false);
  const [gran, setGran] = useState("month"); // day | month | quarter | year

  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);

  const defaultHeaders = useMemo(() => {
    const base = [...(dateOn ? ["date"] : []), ...dims, "credit", "debit", "margin"];
    return base;
  }, [dateOn, dims]);

  const headers = rows.length ? Object.keys(rows[0]) : defaultHeaders;

  const toggleDim = (d) =>
    setDims((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const generate = async () => {
    try {
      const finalDims = dateOn ? [...dims, "date"] : dims;
      const res = await API.post("analytics/pivot/", {
        dims: finalDims,
        values: {},
        from,
        to,
        date_granularity: dateOn ? gran : null,
      });
      setRows(res.data?.rows || []);
      setTotals(res.data?.totals || null);
    } catch (e) {
      console.error(e);
      alert("Failed to generate pivot.");
    }
  };

  const exportXlsx = async () => {
    try {
      const finalDims = dateOn ? [...dims, "date"] : dims;
      const res = await API.post(
        "analytics/pivot/export/",
        { dims: finalDims, values: {}, from, to, date_granularity: dateOn ? gran : null },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial_dashboard_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Could not export.");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Financial Dashboard"
        subtitle="Build a quick pivot by dimensions"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={generate}>
              Generate
            </Button>
            <Button onClick={exportXlsx}>Export</Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Dimensions</div>
            <div className="grid grid-cols-2 gap-2">
              {ALL_DIMS.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dims.includes(d)}
                    onChange={() => toggleDim(d)}
                  />
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
              <Button variant="outline" onClick={generate}>
                Generate
              </Button>
              <Button onClick={exportXlsx}>Export</Button>
            </div>
          </div>
        </div>
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
        <Table headers={headers}>
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-gray-500" colSpan={headers.length}>
                No data
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
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

// ----------------------------- Owner Dashboard -----------------------------
function OwnerRentalTab() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // per-row editing state + local drafts
  const [editing, setEditing] = useState({});
  const [drafts, setDrafts] = useState({});

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      await API.patch(`analytics/owner-rental/property/${id}/`, {
        rent: data.rent,
        igen_service_charge: data.igen_service_charge,
        lease_start: data.lease_start || null,
        lease_expiry: data.lease_expiry || null,
        agreement_renewal_date: data.agreement_renewal_date || null,
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

  const generateRowStatement = async (entityId, propertyName) => {
    let id = entityId;
    if (!id) {
      const input = window.prompt(
        `No entity is linked to "${propertyName}". Enter the Entity ID to generate the statement:`
      );
      if (!input) return;
      id = String(input).trim();
      if (!id) return;
    }
    try {
      await openEntityStatementPDF(id, genCurrentMonth());
    } catch (e) {
      console.error(e);
      alert("Failed to generate statement.");
    }
  };

  return (
    <div className="space-y-4">
      <Card
          right={
            <div className="hidden sm:block">
              <Button variant="outline" onClick={load} disabled={loading}>
                Refresh
              </Button>
            </div>
          }
        {summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Metric title="Total Properties" value={summary.total_properties} tone="blue" />
            <Metric title="Rented" value={summary.rented} tone="emerald" />
            <Metric title="Vacant" value={summary.vacant} tone="rose" />
            <Metric title="Care" value={summary.care} tone="amber" />
            <Metric title="For Sale" value={summary.sale} tone="amber" />
            <Metric
              title="Expected Rent (This Month)"
              value={`₹ ${inr(summary.expected_rent_this_month)}`}
              tone="blue"
            />
            <Metric
              title="iGen SC (This Month)"
              value={`₹ ${inr(summary.igen_sc_this_month)}`}
              tone="blue"
            />
            <Metric title="Inspections (30d)" value={summary.inspections_30d} tone="emerald" />
          </div>
        ) : (
          <div className="text-gray-500">Loading…</div>
        )}
      </Card>

      <Card title="Properties" subtitle="Click Edit to modify rent / sc / lease dates / renewal">
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
          {!loading &&
            rows.map((r) => {
              const isEditing = !!editing[r.id];
              const draft = drafts[r.id] || {};
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium underline decoration-dotted underline-offset-4">
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
                        onChange={(e) => onDraftChange(r.id, "igen_service_charge", e.target.value)}
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

                  {/* Renewal */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {isEditing ? (
                      <input
                        type="date"
                        value={draft.agreement_renewal_date || ""}
                        onChange={(e) =>
                          onDraftChange(r.id, "agreement_renewal_date", e.target.value)
                        }
                        className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none"
                      />
                    ) : (
                      <div>{r.agreement_renewal_date || r.lease_expiry || "—"}</div>
                    )}
                  </td>

                  {/* Inspection (read-only) */}
                  <td className="px-3 py-2">{r.inspection_date || "—"}</td>

                  <td className="px-3 py-2">{r.tenant_or_owner || "—"}</td>
                  <td className="px-3 py-2">{r.transaction_scheduled ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{r.email_sent ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 flex items-center gap-2">
                    {!isEditing ? (
                      <>
                        <Button variant="outline" onClick={() => startEdit(r)} title="Edit row">
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => generateRowStatement(r.entity_id, r.property_name)}
                          title={
                            r.entity_id
                              ? "Generate monthly statement"
                              : "No entity linked — will ask for an ID"
                          }
                        >
                          Generate Statement
                        </Button>
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
    </div>
  );
}

// ----------------------------- main (export) -----------------------------
export default function AnalyticsManagement() {
  const [tab, setTab] = useState("mi"); // mi | entity | owner | project | pivot

  const TAB_COMPONENTS = {
    mi: MI,
    entity: EntityStatement,
    owner: OwnerRentalTab,
    project: ProjectProfitability,
    pivot: FinancialDashboard,
  };

  const Active = TAB_COMPONENTS[tab] || MI;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Insights</div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        </div>
      </div>

      <nav className="flex gap-2 flex-wrap">
        {[
          ["mi", "M&I (YTD)"],
          ["entity", "Entity Statement"],
          ["owner", "Owner Dashboard"],
          ["project", "Project Profitability"],
          ["pivot", "Financial Dashboard"],
        ].map(([k, label]) => (
          <Tab key={k} active={tab === k} onClick={() => setTab(k)}>
            {label}
          </Tab>
        ))}
      </nav>

      <Active />
    </div>
  );
}
