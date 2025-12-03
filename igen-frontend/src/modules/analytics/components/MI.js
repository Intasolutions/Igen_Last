// src/modules/analytics/components/MI.js
import React, { useEffect, useMemo, useState } from "react";
import API from "../../../api/axios";
import * as XLSX from "xlsx";
import {
  Card,
  Toolbar,
  Label,
  Input,
  Button,
  Table,
  Pagination,
  Metric,
  inr,
  thisYearStart,
  todayLocal,
} from "./analyticsCommon";

function MI() {
  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());
  const [summary, setSummary] = useState(null);
  const [entities, setEntities] = useState([]);
  const [active, setActive] = useState({ name: null, id: null });
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination for entities & transactions
  const [entityPage, setEntityPage] = useState(1);
  const entityPageSize = 20;
  const [txnPage, setTxnPage] = useState(1);
  const txnPageSize = 25;

  useEffect(() => {
    setEntityPage(1);
  }, [entities]);

  useEffect(() => {
    setTxnPage(1);
  }, [txns, active]);

  const paginatedEntities = useMemo(
    () => entities.slice((entityPage - 1) * entityPageSize, entityPage * entityPageSize),
    [entities, entityPage]
  );

  const paginatedTxns = useMemo(
    () => txns.slice((txnPage - 1) * txnPageSize, txnPage * txnPageSize),
    [txns, txnPage]
  );

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

  const exportMI = async () => {
    try {
      const res = await API.get("analytics/mi/export/", {
        params: { from, to },
        responseType: "blob",
        validateStatus: (s) => s >= 200 && s < 500,
      });

      if (res.status !== 200) {
        alert("Failed to export M&I entity balances.");
        return;
      }

      const blob = new Blob([res.data], {
        type:
          res.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);

      const cd = res.headers?.["content-disposition"] || "";
      const m = cd.match(/filename="?([^"]+)"?/i);
      const filename = m?.[1] || `mi_entity_balance_${from}_${to}.xlsx`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      console.error(e);
      alert("Failed to export M&I entity balances.");
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

  // NEW: client-side export for Transactions (filtered by active entity)
  const exportActiveEntityTxns = () => {
    if (!active.id) {
      alert("Select an entity first to export its transactions.");
      return;
    }

    if (!txns.length) {
      alert("No transactions to export for this entity in the selected period.");
      return;
    }

    try {
      const rows = txns.map((r) => ({
        Date: r.value_date,
        Type: r.txn_type || "",
        "Credit (₹)": r.credit,
        "Debit (₹)": r.debit,
        "Balance (₹)": r.balance,
        Remarks: r.remarks || "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");

      const safeEntityName =
        (active.name || `entity_${active.id}`).replace(/[^\w\-]+/g, "_") || `entity_${active.id}`;
      const filename = `mi_txns_${safeEntityName}_${from}_${to}.xlsx`;

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);
    } catch (e) {
      console.error(e);
      alert("Failed to export M&I transactions.");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <Button onClick={exportMI}>Export</Button>
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
            <Button onClick={exportMI}>Export</Button>
          </div>
        </Toolbar>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Metric title="YTD Spend (M&I)" value={`₹ ${inr(summary?.ytd_total || 0)}`} tone="blue" />
          <Metric title="Period" value={`${from} → ${to}`} tone="blue" />
          <Metric title="Entities with M&I" value={entities.length} tone="emerald" />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Entity Spend" subtitle="Click an entity to view transactions">
          <Table
            headers={["Entity", "Spend (₹)"]}
            foot={
              <tfoot>
                <tr>
                  <td colSpan={2} className="px-3 py-2">
                    <Pagination
                      page={entityPage}
                      pageSize={entityPageSize}
                      total={entities.length}
                      onPageChange={setEntityPage}
                    />
                  </td>
                </tr>
              </tfoot>
            }
          >
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
              paginatedEntities.map((e, i) => (
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
          right={
            <div className="flex gap-2">
              <Button
                onClick={exportActiveEntityTxns}
                disabled={!active.id || txns.length === 0}
              >
                Export
              </Button>
            </div>
          }
        >
          <Table
            headers={["Date", "Type", "Credit (₹)", "Debit (₹)", "Balance (₹)", "Remarks"]}
            foot={
              <tfoot>
                <tr>
                  <td colSpan={6} className="px-3 py-2">
                    <Pagination
                      page={txnPage}
                      pageSize={txnPageSize}
                      total={txns.length}
                      onPageChange={setTxnPage}
                    />
                  </td>
                </tr>
              </tfoot>
            }
          >
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
            {paginatedTxns.map((r, i) => (
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

export default MI;
