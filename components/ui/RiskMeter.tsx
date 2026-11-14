"use client";

import { riskLevel } from "@/lib/utils";

const fill = { high: "bg-red-600", medium: "bg-amber-500", low: "bg-slate-300" };
const text = { high: "text-red-700", medium: "text-amber-700", low: "text-slate-500" };

/** A small bar plus the 0–100 score. */
export default function RiskMeter({ score }: { score: number | undefined }) {
  const s = score ?? 0;
  const level = riskLevel(s);
  return (
    <span className="inline-flex items-center gap-2" title={`Risk score ${s} (${level})`}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-slate-100">
        <span className={`absolute inset-y-0 left-0 rounded-full ${fill[level]}`} style={{ width: `${Math.max(s, 4)}%` }} />
      </span>
      <span className={`w-6 text-xs font-medium tabular-nums ${text[level]}`}>{s}</span>
    </span>
  );
}
