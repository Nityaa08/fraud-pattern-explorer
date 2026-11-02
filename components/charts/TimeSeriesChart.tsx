"use client";

import { Transaction } from "@/lib/types";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { groupBy, localHourStart } from "@/lib/utils";

interface Props {
  data: Transaction[];
  /** Called with the UTC ISO start of the clicked local hour. */
  onClickTime?: (hourStartIso: string) => void;
}

/** Axis/tooltip label in the viewer's local time zone. */
const hourLabel = (hourStartIso: string) => format(new Date(hourStartIso), "MMM dd HH:00");

export default function TimeSeriesChart({ data, onClickTime }: Props) {
  // Bucket key = UTC ISO string of the local hour start (sorts chronologically).
  const byHour = groupBy(data, (t) => localHourStart(t.timestamp));

  const chartData = Object.entries(byHour)
    .map(([hour, txns]) => ({
      hour,
      total: txns.length,
      chargebacks: txns.filter((t) => t.status === "chargeback").length,
      approved: txns.filter((t) => t.status === "approved").length,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800">Transactions Over Time</h3>
        <span className="text-[10px] text-slate-400 font-medium">Click to filter by hour</span>
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <AreaChart
          data={chartData}
          onClick={(e) => {
            if (e?.activeLabel && onClickTime) onClickTime(String(e.activeLabel));
          }}
          style={{ cursor: "pointer" }}
        >
          <defs>
            <linearGradient id="gradApproved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradChargebacks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="hour" tickFormatter={hourLabel} tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} labelStyle={{ fontWeight: 600, color: "#334155" }} labelFormatter={(l) => hourLabel(String(l))} />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
          <Area type="monotone" dataKey="approved" stackId="1" stroke="#10b981" strokeWidth={2} fill="url(#gradApproved)" name="Approved" />
          <Area type="monotone" dataKey="chargebacks" stackId="1" stroke="#f97316" strokeWidth={2} fill="url(#gradChargebacks)" name="Chargebacks" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
