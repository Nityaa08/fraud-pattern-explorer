"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Transaction } from "@/lib/types";
import { hourlySeries, localHourStart } from "@/lib/utils";

interface Props {
  /** Rows filtered by everything except the date range. */
  data: Transaction[];
  /** Current date filter; shaded on the chart when narrower than the data. */
  selectedRange: [string, string] | null;
  /** Called with the UTC ISO start of the clicked local hour. */
  onClickTime: (hourStartIso: string) => void;
}

const hourLabel = (iso: string) => format(new Date(iso), "EEE d MMM, HH:00");

interface TipProps {
  active?: boolean;
  label?: string | number;
  payload?: { payload: { total: number; chargebacks: number } }[];
}

function Tip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-900">{hourLabel(String(label))}</p>
      <p className="mt-1 tabular-nums text-slate-600">{p.total} transactions</p>
      <p className={`tabular-nums ${p.chargebacks ? "font-medium text-red-600" : "text-slate-400"}`}>
        {p.chargebacks} chargebacks
      </p>
      <p className="mt-1 text-[10px] text-slate-400">Click to filter to this hour</p>
    </div>
  );
}

export default function TimeSeriesChart({ data, selectedRange, onClickTime }: Props) {
  const series = useMemo(() => hourlySeries(data), [data]);
  // One tick per local midnight.
  const ticks = useMemo(() => series.filter((p) => new Date(p.hour).getHours() === 0).map((p) => p.hour), [series]);

  const shade =
    selectedRange && series.length
      ? { x1: localHourStart(selectedRange[0]), x2: localHourStart(selectedRange[1]) }
      : null;

  return (
    <section className="card p-4" aria-label="Transactions per hour">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Transactions per hour</h2>
          <p className="text-[11px] text-slate-500">Click an hour to filter to it · your local time</p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> All transactions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Chargebacks
          </span>
        </div>
      </div>
      {series.length === 0 ? (
        <p className="py-16 text-center text-xs text-slate-400">No transactions</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={series}
            margin={{ top: 8, right: 4, bottom: 0, left: -18 }}
            barCategoryGap={0}
            onClick={(e) => {
              if (e?.activeLabel) onClickTime(String(e.activeLabel));
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid vertical={false} stroke="#eef0f3" />
            <XAxis
              dataKey="hour"
              ticks={ticks}
              tickFormatter={(h) => format(new Date(h), "EEE d")}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={{ stroke: "#e2e8f0" }}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<Tip />} cursor={{ fill: "#6366f1", fillOpacity: 0.08 }} isAnimationActive={false} />
            {shade && (
              <ReferenceArea x1={shade.x1} x2={shade.x2} fill="#6366f1" fillOpacity={0.12} stroke="#6366f1" strokeOpacity={0.4} />
            )}
            <Area
              dataKey="total"
              name="All transactions"
              type="monotone"
              stroke="#94a3b8"
              strokeWidth={1.25}
              fill="#cbd5e1"
              fillOpacity={0.55}
              isAnimationActive={false}
              activeDot={false}
            />
            <Bar dataKey="chargebacks" name="Chargebacks" fill="#ef4444" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
