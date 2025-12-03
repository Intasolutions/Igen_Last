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
  currentMonth,
  SearchableEntityDropdown,
  openEntityStatementPDF,
  openEntityStatementDOCX,
} from "./analyticsCommon";

function EntityStatement() {
  const [entity, setEntity] = useState(null); // {id,name}
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    setPage(1);
  }, [rows]);

  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page]
  );

  const load = async () => {
    if (!entity || !month) return;
    setLoading(true);
    try {
      const res = await API.get("analytics/entity-statement/", {
        params: { entity_id: entity.id, month },
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
      await openEntityStatementDOCX(entity.id, month);
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
            <SearchableEntityDropdown value={entity} onChange={setEntity} />
          </div>
          <div>
            <Label>Month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: 160 }}
            />
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
