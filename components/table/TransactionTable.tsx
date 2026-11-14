"use client";

import { useEffect, useMemo, useState } from "react";
import { Transaction } from "@/lib/types";
import { exportToCSV, formatCurrency, formatDate, riskLevel, sortTransactions, SortDir, SortKey } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import RiskMeter from "@/components/ui/RiskMeter";

interface Props {
  data: Transaction[];
  onSelect: (txn: Transaction) => void;
  selectedId: string | null;
}

const PAGE_SIZE = 15;

const th = "px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500 whitespace-nowrap";

export default function TransactionTable({ data, onSelect, selectedId }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  // A new filter result starts at page 1.
  useEffect(() => setPage(0), [data]);

  const sorted = useMemo(() => sortTransactions(data, sortKey, sortDir), [data, sortKey, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "country" || key === "status" ? "asc" : "desc");
    }
    setPage(0);
  };

  const SortTh = ({ label, field, className = "" }: { label: string; field: SortKey; className?: string }) => {
    const active = sortKey === field;
    return (
      <th
        scope="col"
        className={`${th} ${className}`}
        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={`inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-slate-900 ${active ? "text-slate-900" : ""}`}
        >
          {label}
          <span aria-hidden className={active ? "text-indigo-600" : "text-slate-300"}>
            {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
      </th>
    );
  };

  const first = sorted.length ? page * PAGE_SIZE + 1 : 0;
  const last = Math.min((page + 1) * PAGE_SIZE, sorted.length);

  return (
    <section className="card overflow-hidden" aria-labelledby="txn-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 id="txn-heading" className="text-sm font-semibold text-slate-900">
            Transactions
          </h2>
          <p className="text-[11px] text-slate-500">Click a row (or press Enter on it) for details and related payments</p>
        </div>
        <button
          type="button"
          onClick={() => exportToCSV(sorted, "transactions-export.csv")}
          disabled={sorted.length === 0}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
        >
          Export {sorted.length.toLocaleString("en-US")} rows as CSV
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">No transactions match these filters</p>
          <p className="mt-1 text-xs text-slate-500">Remove a filter above to widen the view.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr>
                <SortTh label="Risk" field="riskScore" />
                <SortTh label="Time" field="timestamp" />
                <SortTh label="Amount" field="amount" className="text-right" />
                <SortTh label="Country" field="country" />
                <th scope="col" className={`${th} hidden md:table-cell`}>
                  Method
                </th>
                <SortTh label="Status" field="status" />
                <th scope="col" className={`${th} hidden lg:table-cell`}>
                  Customer
                </th>
                <th scope="col" className={`${th} hidden sm:table-cell`}>
                  IP country
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageData.map((t) => {
                const level = riskLevel(t.riskScore);
                const mismatch = t.ipCountry !== t.country;
                const isSelected = t.id === selectedId;
                return (
                  <tr
                    key={t.id}
                    tabIndex={0}
                    aria-label={`${formatCurrency(t.amount)} ${t.status} from ${t.country}, risk ${t.riskScore}. Open details.`}
                    onClick={() => onSelect(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(t);
                      }
                    }}
                    data-txn-id={t.id}
                    className={`cursor-pointer outline-none transition-colors hover:bg-slate-50 focus-visible:bg-indigo-50 ${
                      isSelected ? "bg-indigo-50" : level === "high" ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className={`whitespace-nowrap px-3 py-2.5 ${level === "high" ? "border-l-2 border-red-500" : "border-l-2 border-transparent"}`}>
                      <RiskMeter score={t.riskScore} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-600">{formatDate(t.timestamp)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{t.country}</td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-slate-600 md:table-cell">{t.paymentMethod}</td>
                    <td className="px-3 py-2.5">
                      <Badge value={t.status} />
                    </td>
                    <td className="hidden max-w-[220px] truncate px-3 py-2.5 text-xs text-slate-500 lg:table-cell">
                      {t.customerEmail}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs sm:table-cell">
                      {mismatch ? (
                        <span className="font-medium text-red-600">{t.ipCountry} ≠</span>
                      ) : (
                        <span className="text-slate-500">{t.ipCountry}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">
          <span className="tabular-nums">
            {first}–{last} of {sorted.length.toLocaleString("en-US")}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-1 tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
