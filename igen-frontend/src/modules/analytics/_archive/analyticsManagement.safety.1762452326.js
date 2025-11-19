// igen-frontend/src/modules/analytics/analyticsManagement.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../../api/axios"; // baseURL = http://127.0.0.1:8000/api/
// --- TEMP shim so earlier components can reference exportXlsx ---
let exportXlsx = () => {
  alert("Export is available in the main Financial Dashboard section.");
};
// --- end shim ---

// ----------------------------- helpers -----------------------------
const ALL_DIMS = ["cost_centre", "txn_type", "entity", "asset", "contract"];

const fmtLocal = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const thisYearStart = () => fmtLocal(new Date(new Date().getFullYear(), 0, 1));
const todayLocal = () => fmtLocal(new Date());
const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM
const genCurrentMonth = () => new Date().toISOString().slice(0, 7);

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

// ----------------------------- tiny UI bits -----------------------------
const Card = ({ title, subtitle, right, children }) => (
  // NOTE: removed `overflow-hidden` so dropdown menus can overflow properly
  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/70">
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
  // real export inside component scope — overrides the top-level shim
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

// ----------------------------- Shared: open PDF helper -----------------------------
async function openEntityStatementPDF(entityId, month) {
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
}

// ----------------------------- Searchable Entity Dropdown -----------------------------
// - Opens downward, right-aligned
// - Search matches ANY substring in name or #id
// - Keyboard: ↑/↓/Enter/Escape
function SearchableEntityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState([]); // [{id,name}]
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const currentLabel = value ? `${value.name} #${value.id}` : "";

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await API.get("analytics/entities/search/", { params: { q, limit: 200 } });
        setOptions(res.data || []);
        setHighlight(-1);
      } catch (e) {
        console.error(e);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q, open]);

  const norm = (s) => String(s || "").toLowerCase();
  const filtered = useMemo(() => {
    const needle = norm(q).replace(/\s+/g, " ").trim();
    if (!needle) return options;
    return options.filter((opt) => `${opt.name} #${opt.id}`.toLowerCase().includes(needle));
  }, [q, options]);

  const selectItem = (opt) => {
    onChange(opt);
    setOpen(false);
    setQ("");
  };

  const scrollIntoView = (idx) => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector(`[data-idx="${idx}"]`);
    if (!el) return;
    const L = list.getBoundingClientRect();
    const E = el.getBoundingClientRect();
    if (E.bottom > L.bottom) list.scrollTop += E.bottom - L.bottom;
    if (E.top < L.top) list.scrollTop -= L.top - E.top;
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => {
        const v = Math.min(h + 1, filtered.length - 1);
        setTimeout(() => scrollIntoView(v), 0);
        return v;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => {
        const v = Math.max(h - 1, 0);
        setTimeout(() => scrollIntoView(v), 0);
        return v;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && filtered[highlight]) selectItem(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <div className="flex gap-2">
        <input
          readOnly
          value={currentLabel}
          placeholder="Select entity"
          onClick={() => setOpen((v) => !v)}
          className="h-9 min-w-[260px] rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
        />
        {value ? (
          <Button variant="outline" onClick={() => onChange(null)}>Clear</Button>
        ) : null}
      </div>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-[360px] rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              placeholder="Search by name or #id"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div ref={listRef} className="max-h-72 overflow-auto">
            {loading && <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            )}
            {!loading &&
              filtered.map((opt, i) => (
                <div
                  key={`${opt.id}-${opt.name}`}
                  data-idx={i}
                  onMouseDown={() => selectItem(opt)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`px-3 py-2 text-sm cursor-pointer ${
                    i === highlight ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                  title={`${opt.name} #${opt.id}`}
                >
                  {opt.name} <span className="text-gray-400">#{opt.id}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------- Generic Searchable MultiSelect -----------------------------
function MultiSelect({ label, options, value, onChange, placeholder = "Select..." }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const norm = (s) => String(s || "").toLowerCase();
  const filtered = useMemo(() => {
    const needle = norm(q);
    if (!needle) return options;
    return (options || []).filter((o) => norm(o.label).includes(needle));
  }, [q, options]);

  const toggle = (val) => {
    const set = new Set(value || []);
    if (set.has(val)) set.delete(val);
    else set.add(val);
    onChange(Array.from(set));
  };

  const selectAll = () => onChange((options || []).map((o) => o.value));
  const clearAll = () => onChange([]);

  const display = (value || [])
    .slice(0, 2)
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .join(", ");
  const extra = Math.max((value || []).length - 2, 0);

  return (
    <div className="space-y-1" ref={ref}>
      {label ? <Label>{label}</Label> : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-9 min-w-[260px] w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-left shadow-xs outline-none focus:ring-2 focus:ring-blue-200"
        >
          {display || placeholder}{extra ? ` +${extra}` : ""}
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-[360px] rounded-lg border border-gray-200 bg-white shadow-lg z-40">
            <div className="p-2 border-b border-gray-100 flex items-center gap-2">
              <input
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-9 flex-1 rounded-md border border-gray-300 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
              <Button variant="subtle" onClick={selectAll}>Select all</Button>
              <Button variant="outline" onClick={clearAll}>Clear</Button>
            </div>
            <div className="max-h-72 overflow-auto">
              {(filtered || []).map((o) => {
                const checked = (value || []).includes(o.value);
                return (
                  <label
                    key={o.value}
                    className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                );
              })}
              {filtered && filtered.length === 0 && (
                <div className="px-3 py-2 text-sm text-gray-500">No options</div>
              )}
            </div>
          </div>
        )}
      </div>
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
      const msg = e?.response?.data?.detail || "Could not export Word.";
      alert(msg);
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
            <SearchableEntityDropdown value={entity} onChange={setEntity} />
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

  // flow state
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [dimOptions, setDimOptions] = useState({}); // {dim: [{value,label}]}
  const [dimValues, setDimValues] = useState({});   // {dim: [value,...]}

  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);

  const defaultHeaders = useMemo(() => {
    const base = [...(dateOn ? ["date"] : []), ...dims, "credit", "debit", "margin"];
    return base;
  }, [dateOn, dims]);

  const headers = rows.length ? Object.keys(rows[0]) : defaultHeaders;

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
    // user will click Search after choosing filters
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
              <Button variant="outline" onClick={onGenerate}>
                Generate
              </Button>
              <Button onClick={exportXlsx}>Export</Button>
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
              <Button variant="outline" onClick={() => { setDimValues({}); runPivot(); }}>
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

  // ---------- NEW: inline autosave toggles ----------
  const toggleFlag = async (id, field, value) => {
    try {
      await API.patch(`analytics/owner-rental/property/${id}/`, { [field]: value });
      setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
    } catch (e) {
      console.error(e);
      alert("Failed to update. Please retry.");
    }
  };

  // ---------- updated: no prompt; disable when missing ----------
  const generateRowStatement = async (entityId) => {
    if (!entityId) return;
    try {
      await openEntityStatementPDF(entityId, genCurrentMonth());
    } catch (e) {
      console.error(e);
      alert("Failed to generate statement.");
    }
  };

  return (
    <>
      <Card
        title="Owner Dashboard"
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
            {/* NEW: Expiries metric */}
            <Metric title="Expiries (30d)" value={summary.to_be_vacated_30d} tone="rose" />
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

                  {/* NEW: inline toggles with autosave */}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!r.transaction_scheduled}
                      onChange={(e) => toggleFlag(r.id, "transaction_scheduled", e.target.checked)}
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
                        <Button
                          variant="outline"
                          onClick={() => generateRowStatement(r.entity_id)}
                          disabled={!r.entity_id}
                          title={r.entity_id ? "Download monthly statement (PDF)" : "No entity linked"}
                        >
                          Statement (PDF)
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
    </>
  );
}

// ----------------------------- main (export) -----------------------------
export default function AnalyticsManagement() {
  // Owner first (default)
  const [tab, setTab] = useState("owner"); // owner | mi | entity | project | pivot

  const TAB_COMPONENTS = {
    mi: MI,
    entity: EntityStatement,
    owner: OwnerRentalTab,
    project: ProjectProfitability,
    pivot: FinancialDashboard,
  };

  const Active = TAB_COMPONENTS[tab] || OwnerRentalTab;

  // real export: overrides top-level shim for the main dashboard
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
          ["owner", "Owner Dashboard"],
          ["mi", "M&I (YTD)"],
          ["entity", "Entity Statement"],
          ["project", "Project Profitability"],
          ["pivot", "Financial Dashboard"],
        ].map(([k, label]) => (
          <Tab key={k} active={tab === k} onClick={() => setTab(k)}>
// --- exportXlsx override inside component (after state/vars) ---
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
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Could not export.");
  }
};
// --- end override ---
            {label}
          </Tab>
        ))}
      </nav>

      <Active />
    </div>
  );
}
