"use client";

import { Insight } from "@/lib/insights";

interface Props {
  insights: Insight[];
  /** True if this insight's filter is already applied. */
  isActive: (insight: Insight) => boolean;
  onApply: (insight: Insight) => void;
}

const marker = { high: "bg-red-600", medium: "bg-amber-500" };
const label = { high: "High", medium: "Medium" };

/**
 * Rule-based patterns in the current view. Each card has a button that
 * applies the filters showing exactly its rows.
 */
export default function InsightsPanel({ insights, isActive, onApply }: Props) {
  return (
    <section className="card p-4" aria-labelledby="patterns-heading">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="patterns-heading" className="text-sm font-semibold text-slate-900">
          Suspicious patterns
          <span className="ml-2 font-normal text-slate-500">
            {insights.length === 0 ? "none in this view" : `${insights.length} in this view`}
          </span>
        </h2>
        <p className="text-[11px] text-slate-500">Fixed rules, re-run on every filter change</p>
      </div>
      {insights.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {insights.map((insight) => {
            const active = isActive(insight);
            return (
              <li
                key={insight.id}
                className={`relative flex flex-col overflow-hidden rounded-lg border bg-white py-3 pl-4 pr-3 ${
                  active ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${marker[insight.severity]}`} aria-hidden />
                <p className="eyebrow mb-1">
                  <span className="sr-only">Severity: </span>
                  {label[insight.severity]}
                </p>
                <p className="text-[13px] font-semibold leading-snug text-slate-900">{insight.title}</p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{insight.detail}</p>
                <button
                  type="button"
                  onClick={() => onApply(insight)}
                  disabled={active}
                  className={`mt-3 self-start rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "cursor-default bg-indigo-50 text-indigo-700"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  {active ? `Showing these ${insight.count}` : `Show these ${insight.count} →`}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
