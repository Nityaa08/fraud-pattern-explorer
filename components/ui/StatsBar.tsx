"use client";

import { Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

/** Card networks start monitoring merchants around a 1% chargeback rate. */
const CHARGEBACK_ALERT = 0.01;

function Stat({ label, value, note, alert }: { label: string; value: string; note?: string; alert?: boolean }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-slate-900 tabular-nums">{value}</p>
      {note && (
        <p className={`mt-0.5 text-xs tabular-nums ${alert ? "font-medium text-red-600" : "text-slate-500"}`}>{note}</p>
      )}
    </div>
  );
}

export default function StatsBar({ data }: { data: Transaction[] }) {
  const total = data.length;
  const chargebacks = data.filter((t) => t.status === "chargeback").length;
  const volume = data.reduce((s, t) => s + t.amount, 0);
  const mismatches = data.filter((t) => t.ipCountry !== t.country).length;
  const rate = total ? chargebacks / total : 0;

  return (
    <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Transactions" value={total.toLocaleString("en-US")} note={`avg ${formatCurrency(total ? volume / total : 0)}`} />
      <Stat label="Volume" value={formatCurrency(volume)} note="USD" />
      <Stat
        label="Chargebacks"
        value={chargebacks.toLocaleString("en-US")}
        note={`${(rate * 100).toFixed(1)}% of transactions`}
        alert={rate > CHARGEBACK_ALERT}
      />
      <Stat
        label="IP ≠ billing country"
        value={mismatches.toLocaleString("en-US")}
        note={total ? `${((mismatches / total) * 100).toFixed(1)}% of transactions` : undefined}
        alert={mismatches > 0}
      />
    </section>
  );
}
