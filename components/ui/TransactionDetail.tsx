"use client";

import { useEffect, useRef } from "react";
import { Transaction } from "@/lib/types";
import { findRelated, formatCurrency, formatDate, hasCardData, riskLevel, riskSignals } from "@/lib/utils";
import Badge from "./Badge";
import RiskMeter from "./RiskMeter";

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  allTransactions: Transaction[];
  onSelectRelated: (txn: Transaction) => void;
}

function Field({ label, value, warn, mono }: { label: string; value: string; warn?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd
        className={`min-w-0 truncate text-right text-sm ${mono ? "font-mono text-[12px]" : ""} ${
          warn ? "font-medium text-red-600" : "text-slate-800"
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

const levelText = { high: "High risk", medium: "Medium risk", low: "Low risk" };

export default function TransactionDetail({ transaction: t, onClose, allTransactions, onSelectRelated }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownId = useRef<string | null>(null);
  const isOpen = t !== null;
  const id = t?.id ?? null;

  // Opening a related transaction swaps the panel's content: the button that
  // was clicked disappears (focus fell to <body>) and the scroll position was
  // kept (on a phone the new one opened at its Related list). Start at the
  // top and move focus to the heading, so a screen reader announces it.
  useEffect(() => {
    const previous = shownId.current;
    shownId.current = id;
    if (!previous || !id || previous === id) return;
    bodyRef.current?.scrollTo?.({ top: 0 });
    headingRef.current?.focus();
  }, [id]);

  // Escape closes; focus moves into the panel and back to where it was.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      // Keep Tab inside the panel while it is open.
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])");
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!t) return null;

  const mismatch = t.ipCountry !== t.country;
  const related = findRelated(t, allTransactions);
  const signals = riskSignals(t);
  const level = riskLevel(t.riskScore);

  return (
    <div className="fade-in fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-heading"
        className="slide-in flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="detail-heading" ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-slate-900 outline-none">
            Transaction <span className="font-mono text-[12px] font-normal text-slate-500">{t.id}</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close details (Escape)"
          >
            Close ✕
          </button>
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{formatCurrency(t.amount)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(t.timestamp)}</p>
            </div>
            <Badge value={t.status} />
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700">{levelText[level]}</p>
              <RiskMeter score={t.riskScore} />
            </div>
            {signals.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {signals.map((s) => (
                  <li key={s.label} className="flex justify-between text-xs text-slate-600">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-slate-500">+{s.points}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No risk signals.</p>
            )}
            {t.riskScore === 100 && signals.reduce((a, s) => a + s.points, 0) > 100 && (
              <p className="mt-1 text-[11px] text-slate-400">Capped at 100.</p>
            )}
          </div>

          <dl className="mt-4 divide-y divide-slate-100">
            <Field label="Billing country" value={t.country} />
            <Field label="IP country" value={mismatch ? `${t.ipCountry} (differs)` : t.ipCountry} warn={mismatch} />
            <Field label="Payment method" value={t.paymentMethod} />
            <Field label="Card" value={hasCardData(t) ? `${t.cardBIN} ···· ${t.cardLast4}` : "No card"} mono />
            <Field label="Customer" value={t.customerEmail} />
            <Field label="Category" value={t.productCategory} />
            <Field label="Merchant" value={t.merchantId} mono />
          </dl>

          <div className="mt-6">
            <h3 className="eyebrow mb-1">Related transactions ({related.length})</h3>
            <p className="mb-2 text-[11px] text-slate-500">Same customer email, or the same card (BIN and last 4)</p>
            {related.length === 0 ? (
              <p className="text-xs text-slate-400">None in the data.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {related.slice(0, 10).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => onSelectRelated(r)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="tabular-nums">
                        <span className="font-medium text-slate-900">{formatCurrency(r.amount)}</span>
                        <span className="ml-2 text-slate-500">{formatDate(r.timestamp)}</span>
                      </span>
                      <Badge value={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {related.length > 10 && (
              <p className="mt-1.5 text-[11px] text-slate-500">+{related.length - 10} more</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
