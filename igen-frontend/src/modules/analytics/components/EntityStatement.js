// src/modules/analytics/components/EntityStatement.js
import React, { useEffect, useMemo, useState } from "react";
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
  thisYearStart,
  todayLocal,
  SearchableEntityDropdown,
  openEntityStatementPDF,
  openEntityStatementDOCX,
} from "./analyticsCommon";

function EntityStatement() {
  const [entity, setEntity] = useState(null); // {id,name}

  // Date range (YYYY-MM-DD)
  const [from, setFrom] = useState(thisYearStart());
  const [to, setTo] = useState(todayLocal());

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => setPage(1), [rows]);

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page]
  );

  const canRun = !!(entity && from && to);

  const getSortedRange = () => {
    const f = from <= to ? from : to;
    const t = from <= to ? to : from;
    return { f, t };
  };

  const load = async () => {
    if (!canRun) return;

    const { f, t } = getSortedRange();

    setLoading(true);
    try {
      const res = await API.get("analytics/entity-statement/", {
        params: { entity_id: entity.id, from: f, to: t },
      });
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to load entity statement.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!canRun) return;

    const { f, t } = getSortedRange();

    try {
      // PDF backend now supports from/to
      await openEntityStatementPDF(entity.id, { from: f, to: t });
    } catch (e) {
      console.error(e);
      alert("Could not export PDF.");
    }
  };

  const downloadDOCX = async () => {
    if (!canRun) return;

    const { f, t } = getSortedRange();

    try {
      // DOCX backend now supports from/to (since you updated it)
      await openEntityStatementDOCX(entity.id, { from: f, to: t });
    } catch (e) {
      console.error(e);
      alert("Could not export Word.");
    }
  };

  return (
    <div className="space-y-4">
      <Card
        title="Entity Statement"
        subtitle="Drill into a single entity for a date range"
        right={
          <div className="hidden sm:flex gap-2">
            <Button variant="outline" onClick={load} disabled={!canRun}>
              Load
            </Button>
            <Button variant="outline" onClick={downloadPDF} disabled={!canRun}>
              Export PDF
            </Button>
            <Button onClick={downloadDOCX} disabled={!canRun}>
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
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: 160 }}
            />
          </div>

          <div>
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ width: 160 }}
            />
          </div>

          <div className="flex gap-2 sm:hidden">
            <Button variant="outline" onClick={load} disabled={!canRun}>
              Load
            </Button>
            <Button variant="outline" onClick={downloadPDF} disabled={!canRun}>
              Export PDF
            </Button>
            <Button onClick={downloadDOCX} disabled={!canRun}>
              Export Word
            </Button>
          </div>
        </Toolbar>

        <div className="mt-2 text-xs text-gray-500">
          Note: PDF and Word exports use the selected <b>From</b> and <b>To</b> dates.
        </div>
      </Card>

      <Card title="Transactions" subtitle="With running balance">
        <Table
          headers={["Date", "Type", "Credit (₹)", "Debit (₹)", "Balance (₹)", "Remarks"]}
          foot={
            <tfoot>
              <tr>
                <td colSpan={6} className="px-3 py-2">
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
            paginatedRows.map((r, i) => (
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

export default EntityStatement;
