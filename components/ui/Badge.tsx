"use client";

// Only a chargeback is coloured: red is kept for risk across the dashboard.
const styles: Record<string, string> = {
  chargeback: "bg-red-50 text-red-700 ring-red-200",
  declined: "bg-slate-100 text-slate-700 ring-slate-200",
  approved: "bg-white text-slate-600 ring-slate-200",
  pending: "bg-white text-slate-500 ring-slate-200",
};

export default function Badge({ value }: { value: string }) {
  const cls = styles[value] ?? styles.approved;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${cls}`}
    >
      {value}
    </span>
  );
}
