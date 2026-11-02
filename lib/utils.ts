import { Transaction, Filters } from "./types";

/** Compute a 0–100 risk score for a transaction based on fraud indicators */
export function computeRiskScore(t: Transaction): number {
  let score = 0;
  if (t.ipCountry !== t.country) score += 40;
  if (t.status === "chargeback") score += 25;
  if (t.amount > 400) score += 15;
  if (t.paymentMethod === "Visa" || t.paymentMethod === "Mastercard") score += 5;
  if (t.productCategory === "Electronics") score += 5;
  if (t.customerEmail.includes("proton.me")) score += 10;
  return Math.min(score, 100);
}

export function applyFilters(
  transactions: Transaction[],
  filters: Filters
): Transaction[] {
  return transactions.filter((t) => {
    if (filters.countries.length > 0 && !filters.countries.includes(t.country))
      return false;
    if (
      filters.paymentMethods.length > 0 &&
      !filters.paymentMethods.includes(t.paymentMethod)
    )
      return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(t.status))
      return false;
    if (t.amount < filters.amountRange[0] || t.amount > filters.amountRange[1])
      return false;
    if (filters.dateRange[0] && t.timestamp < filters.dateRange[0])
      return false;
    if (filters.dateRange[1] && t.timestamp > filters.dateRange[1])
      return false;
    if (filters.highRiskOnly && (t.riskScore ?? 0) < 50)
      return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const searchable = [
        t.id,
        t.customerEmail,
        t.cardLast4,
        t.cardBIN,
        t.merchantId,
        t.productCategory,
      ]
        .join(" ")
        .toLowerCase();
      if (!searchable.includes(q)) return false;
    }
    return true;
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Start of the hour (in the viewer's local time zone) that contains `iso`,
 * as a UTC ISO string. Used as the time-chart bucket key, so a clicked bucket
 * maps back to exact UTC instants even in zones like UTC+5:30.
 */
export function localHourStart(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

/** [start, end] UTC ISO strings covering one hour that starts at `hourStartIso`. */
export function hourRange(hourStartIso: string): [string, string] {
  const start = new Date(hourStartIso).getTime();
  return [new Date(start).toISOString(), new Date(start + 3_600_000 - 1).toISOString()];
}

/** True if the transaction carries real card data (PIX, Boleto, OXXO, etc. use "N/A"). */
export function hasCardData(t: Transaction): boolean {
  return /^\d{4}$/.test(t.cardLast4);
}

/**
 * Other transactions sharing the customer email, or (card payments only)
 * the same card BIN and last 4 digits.
 */
export function findRelated(t: Transaction, all: Transaction[]): Transaction[] {
  const card = hasCardData(t);
  return all.filter(
    (r) =>
      r.id !== t.id &&
      (r.customerEmail === t.customerEmail ||
        (card && hasCardData(r) && r.cardLast4 === t.cardLast4 && r.cardBIN === t.cardBIN))
  );
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/** Export filtered transactions as CSV and trigger download */
export function exportToCSV(transactions: Transaction[], filename: string) {
  const headers = [
    "ID", "Timestamp", "Amount", "Currency", "Country", "Payment Method",
    "Status", "Customer Email", "Card Last 4", "Card BIN",
    "Product Category", "IP Country", "Merchant ID", "Risk Score",
  ];
  const rows = transactions.map((t) => [
    t.id, t.timestamp, t.amount, t.currency, t.country,
    t.paymentMethod, t.status, t.customerEmail, t.cardLast4,
    t.cardBIN, t.productCategory, t.ipCountry, t.merchantId,
    t.riskScore ?? "",
  ]);
  const escapeCSV = (val: unknown) => {
    const str = String(val ?? "");
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
