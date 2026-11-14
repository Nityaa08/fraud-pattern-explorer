"use client";

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  chargebacks: number;
}

interface Props {
  title: string;
  rows: BreakdownRow[];
  /** Keys of the rows that are currently a filter. */
  selected: string[];
  onToggle: (key: string) => void;
  /** Chargeback rate at or above which the rate is shown in red. */
  alertRate?: number;
}

/**
 * Horizontal bars: grey for all transactions, red for the chargeback part.
 * Every row is a button that toggles a filter. Rows stay visible when one is
 * selected (the parent passes data filtered by everything except this
 * dimension), so you can compare and add a second value.
 */
export default function BreakdownBars({ title, rows, selected, onToggle, alertRate = 0.1 }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const anySelected = selected.length > 0;

  return (
    <section className="card flex flex-col p-4" aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <span className="text-[11px] text-slate-400">Chargeback rate</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">No transactions</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => {
            const isSelected = selected.includes(r.key);
            const rate = r.count ? r.chargebacks / r.count : 0;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onToggle(r.key)}
                  aria-pressed={isSelected}
                  title={`${r.count} transactions, ${r.chargebacks} chargebacks. Click to ${isSelected ? "remove" : "add"} filter.`}
                  className={`group grid w-full grid-cols-[5.5rem_1fr_2.75rem_3rem] items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors ${
                    isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
                  } ${anySelected && !isSelected ? "opacity-55 hover:opacity-100" : ""}`}
                >
                  <span className={`truncate font-medium ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                    {r.label}
                  </span>
                  <span className="relative h-2.5 overflow-hidden rounded-sm bg-slate-100">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-sm ${isSelected ? "bg-indigo-300" : "bg-slate-300 group-hover:bg-slate-400"}`}
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm bg-red-500"
                      style={{ width: `${(r.chargebacks / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-slate-600">{r.count}</span>
                  <span
                    className={`text-right tabular-nums ${rate >= alertRate ? "font-semibold text-red-600" : "text-slate-400"}`}
                  >
                    {(rate * 100).toFixed(rate > 0 && rate < 0.1 ? 1 : 0)}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
