// src/modules/analytics/components/ProjectProfitability.js
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import API from "../../../api/axios";
import {
  Card,
  Toolbar,
  Label,
  Input,
  Button,
  Table,
  Pagination,
  inr,
  toNumber,
  thisYearStart,
  todayLocal,
} from "./analyticsCommon";

function ProjectProfitability() {
  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());
  const [rows, setRows] = useState([]);
  const [txns, setTxns] = useState([]);
  const [active, setActive] = useState(null);

  // pagination
  const [summaryPage, setSummaryPage] = useState(1);
  const summaryPageSize = 20;
  const [txnPage, setTxnPage] = useState(1);
  const txnPageSize = 25;

  useEffect(() => {
    setSummaryPage(1);
  }, [rows]);

  useEffect(() => {
    setTxnPage(1);
  }, [txns, active]);

  const paginatedSummary = useMemo(
    () => rows.slice((summaryPage - 1) * summaryPageSize, summaryPage * summaryPageSize),
    [rows, summaryPage]
  );

  const paginatedTxns = useMemo(
    () => txns.slice((txnPage - 1) * txnPageSize, txnPage * txnPageSize),
    [txns, txnPage]
  );

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

  // --- FRONTEND EXPORT: SUMMARY (LEFT TABLE) ---
  const exportSummary = () => {
    if (!rows.length) {
      alert("No summary data to export.");
      return;
    }

    const header = ["Project", "Inflows (₹)", "Outflows (₹)", "Net (₹)"];

    const data = rows.map((r) => {
      const projectName = r.project || r.project_name || r.name || "—";
      return [
        projectName,
        toNumber(r.inflows),
        toNumber(r.outflows),
        toNumber(r.net),
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

    // Optional: set basic column widths for better readability
    ws["!cols"] = [
      { wch: 30 }, // Project
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Summary");

    const filename = `project_profitability_summary_${from}_${to}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // --- FRONTEND EXPORT: TRANSACTIONS (RIGHT TABLE) ---
  const exportTransactions = () => {
    if (!active) {
      alert("Select a project first to export its transactions.");
      return;
    }

    if (!txns.length) {
      alert("No transactions to export for this project.");
      return;
    }

    const header = ["Date", "Type", "Credit (₹)", "Debit (₹)", "Balance (₹)", "Remarks"];

    const data = txns.map((r) => [
      r.value_date,
      r.txn_type || "—",
      toNumber(r.credit),
      toNumber(r.debit),
      toNumber(r.balance),
      r.remarks || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);

    ws["!cols"] = [
      { wch: 12 }, // Date
      { wch: 15 }, // Type
      { wch: 15 }, // Credit
      { wch: 15 }, // Debit
      { wch: 15 }, // Balance
      { wch: 40 }, // Remarks
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");

    // Make filename safe-ish
    const cleanProject =
      String(active)
        .replace(/[\\/:*?"<>|]/g, "_")
        .slice(0, 40) || "project";

    const filename = `project_transactions_${cleanProject}_${from}_${to}.xlsx`;
    XLSX.writeFile(wb, filename);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean title so it doesn't show weird "--" / "—"
  const transactionsTitle =
    active && active !== "—" && active !== "--"
      ? `Transactions - ${active}`
      : "Transactions";

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
            <Button onClick={exportSummary}>Export Summary</Button>
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
            <Button onClick={exportSummary}>Export Summary</Button>
          </div>
        </Toolbar>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SUMMARY CARD */}
        <Card title="Summary" subtitle="Click a row to drill transactions">
          <Table
            headers={["Project", "Inflows (₹)", "Outflows (₹)", "Net (₹)"]}
            foot={
              <tfoot>
                <tr>
                  <td colSpan={4} className="px-3 py-2">
                    <Pagination
                      page={summaryPage}
                      pageSize={summaryPageSize}
                      total={rows.length}
                      onPageChange={setSummaryPage}
                    />
                  </td>
                </tr>
              </tfoot>
            }
          >
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-gray-500" colSpan={4}>
                  No data
                </td>
              </tr>
            )}
            {paginatedSummary.map((r, i) => {
              const projectName = r.project || r.project_name || r.name || "—";
              return (
                <tr
                  key={i}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => drill(projectName, r.project_id ?? null)}
                >
                  <td className="px-3 py-2 align-middle">{projectName}</td>
                  <td className="px-3 py-2 text-right align-middle">
                    ₹ {inr(r.inflows)}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    ₹ {inr(r.outflows)}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        toNumber(r.net) >= 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      ₹ {inr(r.net)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>

        {/* TRANSACTIONS CARD */}
        <Card
          title={transactionsTitle}
          subtitle={active ? "Filtered by project" : "Select a project to drill"}
          right={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportTransactions}
                disabled={!active || !txns.length}
              >
                Export Transactions
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

export default ProjectProfitability;
