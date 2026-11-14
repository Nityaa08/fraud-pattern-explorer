"use client";

import { Transaction } from "@/lib/types";
import { formatCurrency, formatDate, exportToCSV, riskLevel, sortTransactions, SortDir, SortKey } from "@/lib/utils";
import Badge from "@/components/ui/Badge";
import { useState, useEffect } from "react";

interface Props {
  data: Transaction[];
  onSelect: (txn: Transaction) => void;
}


function RiskDot({ score }: { score: number }) {
  const level = riskLevel(score);
  const color = level === "high" ? "bg-red-500" : level === "medium" ? "bg-amber-400" : "bg-emerald-400";
  const ring = level === "high" ? "ring-red-200" : level === "medium" ? "ring-amber-200" : "ring-emerald-200";
  return (
    <div className="flex items-center gap-1.5" title={`Risk score: ${score}`}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} ring-2 ${ring}`} />
      <span className="text-xs text-slate-500 tabular-nums font-medium">{score}</span>
    </div>
  );
}

export default function TransactionTable({ data, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const pageSize = 15;

  useEffect(() => { setPage(0); }, [data]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const sorted = sortTransactions(data, sortKey, sortDir);

  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(data.length / pageSize);

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 select-none group"
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field ? (
          <span className="text-indigo-500">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>
        ) : (
          <span className="text-slate-300 opacity-0 group-hover:opacity-100">{"\u2195"}</span>
        )}
      </span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Transactions
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{data.length} results</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToCSV(data, "transactions-export.csv")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export CSV
          </button>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 disabled:opacity-25 hover:bg-slate-50 text-slate-600 font-medium"
              >
                Prev
              </button>
              <span className="text-slate-400 tabular-nums px-1">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 disabled:opacity-25 hover:bg-slate-50 text-slate-600 font-medium"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-slate-500 font-medium">No transactions match your filters</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting or clearing your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <SortHeader label="Risk" field="riskScore" />
                <SortHeader label="Date" field="timestamp" />
                <SortHeader label="Amount" field="amount" />
                <SortHeader label="Country" field="country" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Payment</th>
                <SortHeader label="Status" field="status" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">IP Country</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((txn, idx) => {
                const ipMismatch = txn.ipCountry !== txn.country;
                const level = riskLevel(txn.riskScore);
                return (
                  <tr
                    key={txn.id}
                    onClick={() => onSelect(txn)}
                    className={`cursor-pointer transition-colors hover:bg-indigo-50/50 ${
                      level === "high"
                        ? "bg-red-50/60"
                        : level === "medium"
                        ? "bg-amber-50/40"
                        : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <RiskDot score={txn.riskScore ?? 0} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                      {formatDate(txn.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{txn.country}</td>
                    <td className="px-4 py-3 text-slate-600">{txn.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <Badge value={txn.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{txn.productCategory}</td>
                    <td className="px-4 py-3">
                      {ipMismatch ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                          {txn.ipCountry}
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">{txn.ipCountry}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
