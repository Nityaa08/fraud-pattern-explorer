"use client";

import { Transaction } from "@/lib/types";
import { detectInsights } from "@/lib/insights";

interface Props {
  data: Transaction[];
}

const severityConfig = {
  high: { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", dot: "bg-red-500", icon: "text-red-500" },
  medium: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", dot: "bg-amber-400", icon: "text-amber-500" },
};

export default function InsightsPanel({ data }: Props) {
  const insights = detectInsights(data);

  if (insights.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Suspicious Patterns</h3>
          <p className="text-[11px] text-slate-400">{insights.length} anomalies detected in current view</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {insights.map((insight, i) => {
          const cfg = severityConfig[insight.severity];
          return (
            <div
              key={i}
              className={`rounded-lg border p-3.5 ${cfg.bg} ${cfg.border}`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${cfg.text}`}>{insight.title}</p>
                  <p className={`text-[11px] ${cfg.text} opacity-70 mt-0.5 leading-relaxed`}>{insight.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
