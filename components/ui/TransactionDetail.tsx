"use client";

import { Transaction } from "@/lib/types";
import { findRelated, formatCurrency, formatDate } from "@/lib/utils";
import Badge from "./Badge";

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  allTransactions: Transaction[];
  onSelectRelated: (txn: Transaction) => void;
}

function Row({ label, value, warn, mono }: { label: string; value: string; warn?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-50">
      <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-medium text-right max-w-[220px] truncate ${mono ? "font-mono text-xs" : ""} ${warn ? "text-red-600" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  const config =
    score >= 70 ? { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "High Risk" } :
    score >= 40 ? { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Medium" } :
    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Low Risk" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${config.bg} ${config.text} ${config.border}`}>
      {config.label} &middot; {score}
    </span>
  );
}

export default function TransactionDetail({
  transaction: t,
  onClose,
  allTransactions,
  onSelectRelated,
}: Props) {
  if (!t) return null;

  const ipMismatch = t.ipCountry !== t.country;

  const related = findRelated(t, allTransactions);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex justify-end fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-slate-800">Transaction Detail</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close detail panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* Amount + badges */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(t.amount)}
              </p>
              <p className="text-xs text-slate-400 mt-1">{formatDate(t.timestamp)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge value={t.status} />
              <RiskBadge score={t.riskScore ?? 0} />
            </div>
          </div>

          {/* IP mismatch alert */}
          {ipMismatch && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 mb-5 flex items-start gap-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 mt-0.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-red-800">
                  IP Country Mismatch
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  Billing: {t.country} &rarr; IP: {t.ipCountry}
                </p>
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="space-y-0">
            <Row label="Transaction ID" value={t.id} mono />
            <Row label="Country" value={t.country} />
            <Row label="IP Country" value={t.ipCountry} warn={ipMismatch} />
            <Row label="Payment Method" value={t.paymentMethod} />
            <Row label="Card BIN" value={t.cardBIN} mono />
            <Row label="Card Last 4" value={t.cardLast4} mono />
            <Row label="Customer Email" value={t.customerEmail} />
            <Row label="Product Category" value={t.productCategory} />
            <Row label="Merchant ID" value={t.merchantId} mono />
          </div>

          {/* Related Transactions */}
          {related.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Related Transactions ({related.length})
              </h3>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {related.slice(0, 10).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelectRelated(r)}
                    className="w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 transition-colors text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {formatCurrency(r.amount)}
                      </span>
                      <span className="text-slate-400 ml-2">
                        {formatDate(r.timestamp)}
                      </span>
                    </div>
                    <Badge value={r.status} />
                  </button>
                ))}
                {related.length > 10 && (
                  <p className="text-[11px] text-slate-400 px-3 pt-1">
                    +{related.length - 10} more related
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
