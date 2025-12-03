// src/modules/analytics/components/analyticsCommon.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import API from "../../../api/axios";

// ----------------------------- helpers -----------------------------
export const ALL_DIMS = ["cost_centre", "txn_type", "entity", "asset", "contract"];

const fmtLocal = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const thisYearStart = () => fmtLocal(new Date(new Date().getFullYear(), 0, 1));
export const todayLocal = () => fmtLocal(new Date());
export const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM
export const genCurrentMonth = () => new Date().toISOString().slice(0, 7);

export const toNumber = (x) => {
  if (x === null || x === undefined || x === "") return 0;
  const n = typeof x === "string" ? parseFloat(x.replace(/,/g, "")) : Number(x);
  return Number.isFinite(n) ? n : 0;
};

export const inr = (x) =>
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
export const Card = ({ title, subtitle, right, children }) => (
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

export const Toolbar = ({ children }) => (
  <div className="flex flex-wrap items-end gap-3">{children}</div>
);

export const Label = ({ children }) => (
  <label className="block text-xs font-medium text-gray-600">{children}</label>
);

export const Input = (props) => (
  <input
    {...props}
    className={`h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200 ${
      props.className || ""
    }`}
  />
);

export const Button = ({ variant = "solid", children, className = "", disabled, ...rest }) => {
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
    <button
      className={`${base} ${variants[variant]} ${disabledCls} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

export const Pagination = ({ page, pageSize, total, onPageChange }) => {
  if (!total || total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  const go = (p) => {
    const np = Math.min(Math.max(p, 1), totalPages);
    if (np !== page) onPageChange(np);
  };

  return (
    <div className="flex items-center justify-between text-xs text-gray-600">
      <div>
        Showing <span className="font-medium">{start}</span>–<span className="font-medium">{end}</span>{" "}
        of <span className="font-medium">{total}</span>
      </div>
      <div className="inline-flex items-center gap-1">
        <Button
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => go(safePage - 1)}
          className="h-7 px-2 text-xs"
        >
          Prev
        </Button>
        <span className="mx-1">
          Page <span className="font-medium">{safePage}</span> / {totalPages}
        </span>
        <Button
          variant="outline"
          disabled={safePage >= totalPages}
          onClick={() => go(safePage + 1)}
          className="h-7 px-2 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export const ExportMenu = ({
  label = "Generate",
  options = [],
  disabled,
  variant = "outline",
  ...buttonProps
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onClickOption = (opt) => {
    setOpen(false);
    if (typeof opt.onClick === "function") {
      opt.onClick();
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <Button
        variant={variant}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        {...buttonProps}
      >
        {label} <span className="ml-1 text-xs">▾</span>
      </Button>

      {open && !disabled && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              onClick={() => onClickOption(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Tab = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-gray-900 text-white"
        : "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50"
    }`}
  >
    {children}
  </button>
);

export const Table = ({ headers, children, foot }) => (
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

export const Metric = ({ title, value, tone = "blue" }) => {
  const t = toneClass[tone] || toneClass.blue;
  return (
    <div className={`rounded-xl border border-gray-200 p-4 ${t.bg}`}>
      <div className={`text-xs ${t.text}`}>{title}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
};

// ----------------------------- PDF / DOCX helpers -----------------------------
export async function openEntityStatementPDF(entityId, month) {
  if (!entityId) {
    alert("No entity linked to this row.");
    return;
  }
  try {
    const res = await API.get("analytics/entity-statement/pdf/", {
      params: { entity_id: entityId, month },
      responseType: "blob",
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status !== 200) {
      try {
        const text = (await res.data.text?.()) || "";
        const msg = JSON.parse(text)?.detail || text || "Failed to generate statement.";
        alert(msg);
      } catch {
        alert("Failed to generate statement.");
      }
      return;
    }

    const contentType = res.headers?.["content-type"] || "application/pdf";
    const blob = new Blob([res.data], { type: contentType });
    const url = URL.createObjectURL(blob);

    const cd = res.headers?.["content-disposition"] || "";
    const m = cd.match(/filename="?([^"]+)"?/i);
    const filename = m?.[1] || `entity_${entityId}_${month}_statement.pdf`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  } catch (e) {
    console.error(e);
    alert("Could not export PDF. Check network and try again.");
  }
}

export async function openEntityStatementDOCX(entityId, month) {
  if (!entityId) {
    alert("No entity linked to this row.");
    return;
  }
  try {
    const res = await API.get("analytics/entity-statement/docx/", {
      params: { entity_id: entityId, month },
      responseType: "blob",
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status !== 200) {
      try {
        const text = (await res.data.text?.()) || "";
        const msg = JSON.parse(text)?.detail || text || "Failed to generate statement.";
        alert(msg);
      } catch {
        alert("Failed to generate statement.");
      }
      return;
    }

    const contentType =
      res.headers?.["content-type"] ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const blob = new Blob([res.data], { type: contentType });
    const url = URL.createObjectURL(blob);

    const cd = res.headers?.["content-disposition"] || "";
    const m = cd.match(/filename="?([^"]+)"?/i);
    const filename = m?.[1] || `entity_${entityId}_${month}_statement.docx`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  } catch (e) {
    console.error(e);
    alert("Could not export Word. Check network and try again.");
  }
}

// ---------- UPDATED: Property statement helpers (month OR from/to) ----------
export async function openPropertyStatementPDF(propertyId, options) {
  if (!propertyId) {
    alert("Property not found for this row.");
    return;
  }

  // Backward-compatible: second argument can be a month string or an options object.
  let month = null;
  let from = null;
  let to = null;

  if (typeof options === "string") {
    month = options;
  } else if (options && typeof options === "object") {
    month = options.month || null;
    from = options.from || null;
    to = options.to || null;
  }

  const params = { property_id: propertyId };
  if (from && to) {
    params.from = from;
    params.to = to;
  } else if (month) {
    params.month = month;
  } else {
    alert("Please select either a month or a From / To date range before generating.");
    return;
  }

  try {
    const res = await API.get("analytics/owner-rental/property-statement/pdf/", {
      params,
      responseType: "blob",
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status !== 200) {
      try {
        const text = (await res.data.text?.()) || "";
        const msg = JSON.parse(text)?.detail || text || "Failed to generate statement.";
        alert(msg);
      } catch {
        alert("Failed to generate statement.");
      }
      return;
    }

    const contentType = res.headers?.["content-type"] || "application/pdf";
    const blob = new Blob([res.data], { type: contentType });
    const url = URL.createObjectURL(blob);

    const cd = res.headers?.["content-disposition"] || "";
    const m = cd.match(/filename="?([^"]+)"?/i);
    const suffix =
      month ||
      (from && to ? `${from}_to_${to}` : "statement");
    const fallbackName = `property_${propertyId}_${suffix}.pdf`;
    const filename = m?.[1] || fallbackName;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  } catch (e) {
    console.error(e);
    alert("Could not export PDF. Check network and try again.");
  }
}

export async function openPropertyStatementDOCX(propertyId, options) {
  if (!propertyId) {
    alert("Property not found for this row.");
    return;
  }

  let month = null;
  let from = null;
  let to = null;

  if (typeof options === "string") {
    month = options;
  } else if (options && typeof options === "object") {
    month = options.month || null;
    from = options.from || null;
    to = options.to || null;
  }

  const params = { property_id: propertyId };
  if (from && to) {
    params.from = from;
    params.to = to;
  } else if (month) {
    params.month = month;
  } else {
    alert("Please select either a month or a From / To date range before generating.");
    return;
  }

  try {
    const res = await API.get("analytics/owner-rental/property-statement/docx/", {
      params,
      responseType: "blob",
      validateStatus: (s) => s >= 200 && s < 500,
    });

    if (res.status !== 200) {
      try {
        const text = (await res.data.text?.()) || "";
        const msg = JSON.parse(text)?.detail || text || "Failed to generate statement.";
        alert(msg);
      } catch {
        alert("Failed to generate statement.");
      }
      return;
    }

    const contentType =
      res.headers?.["content-type"] ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const blob = new Blob([res.data], { type: contentType });
    const url = URL.createObjectURL(blob);

    const cd = res.headers?.["content-disposition"] || "";
    const m = cd.match(/filename="?([^"]+)"?/i);
    const suffix =
      month ||
      (from && to ? `${from}_to_${to}` : "statement");
    const fallbackName = `property_${propertyId}_${suffix}.docx`;
    const filename = m?.[1] || fallbackName;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  } catch (e) {
    console.error(e);
    alert("Could not export Word. Check network and try again.");
  }
}

// ----------------------------- Searchable Entity Dropdown -----------------------------
export function SearchableEntityDropdown({ value, onChange }) {
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
    <div className="relative w-full max-w-sm" ref={wrapRef}>
      <div className="flex gap-2">
        <input
          readOnly
          value={currentLabel}
          placeholder="Select entity"
          onClick={() => setOpen((v) => !v)}
          className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
        />
        {value ? (
          <Button variant="outline" onClick={() => onChange(null)}>
            Clear
          </Button>
        ) : null}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg z-[1500]">
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
export function MultiSelect({ label, options, value, onChange, placeholder = "Select..." }) {
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
          {display || placeholder}
          {extra ? ` +${extra}` : ""}
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
              <Button variant="subtle" onClick={selectAll}>
                Select all
              </Button>
              <Button variant="outline" onClick={clearAll}>
                Clear
              </Button>
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
                    <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} />
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
