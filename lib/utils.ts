import { Transaction, Filters } from "./types";

/** Score at or above which a transaction is "high risk" (table, detail panel and the High Risk filter). */
export const HIGH_RISK = 70;
/** Score at or above which a transaction is "medium risk". */
export const MEDIUM_RISK = 40;

export type RiskLevel = "high" | "medium" | "low";

/** One place that turns a score into a level, so every view agrees. */
export function riskLevel(score: number | undefined): RiskLevel {
  const s = score ?? 0;
  return s >= HIGH_RISK ? "high" : s >= MEDIUM_RISK ? "medium" : "low";
}

export interface RiskSignal {
  label: string;
  points: number;
}

/** The signals that add to a transaction's risk score, with their points. */
export function riskSignals(t: Transaction): RiskSignal[] {
  const signals: RiskSignal[] = [];
  if (t.ipCountry !== t.country) signals.push({ label: `IP in ${t.ipCountry}, billing in ${t.country}`, points: 40 });
  if (t.status === "chargeback") signals.push({ label: "Chargeback", points: 25 });
  if (t.amount > 400) signals.push({ label: "Amount over $400", points: 15 });
  if (t.customerEmail.includes("proton.me")) signals.push({ label: "proton.me email", points: 10 });
  if (t.paymentMethod === "Visa" || t.paymentMethod === "Mastercard") signals.push({ label: "Card payment", points: 5 });
  if (t.productCategory === "Electronics") signals.push({ label: "Electronics", points: 5 });
  return signals;
}

/** Compute a 0–100 risk score for a transaction based on fraud indicators */
export function computeRiskScore(t: Transaction): number {
  return Math.min(
    riskSignals(t).reduce((s, x) => s + x.points, 0),
    100
  );
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
    if (filters.highRiskOnly && riskLevel(t.riskScore) !== "high")
      return false;
    if (filters.ipMismatchOnly && t.ipCountry === t.country)
      return false;
    if (
      filters.customerEmails.length > 0 &&
      !filters.customerEmails.includes(t.customerEmail)
    )
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

/**
 * First instant of a calendar day ("YYYY-MM-DD") in the viewer's local time
 * zone, as a UTC ISO string. Used by the From date picker.
 */
export function localDayStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/**
 * Last millisecond of a local calendar day, as a UTC ISO string. Computed as
 * the next local midnight minus 1 ms, so 23- and 25-hour DST days are right.
 */
export function localDayEnd(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(new Date(y, m - 1, d + 1).getTime() - 1).toISOString();
}

/** The local calendar day ("YYYY-MM-DD") that contains `iso`, for a date input's value. */
export function localDay(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
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

export interface HourPoint {
  /** UTC ISO start of the local hour. */
  hour: string;
  total: number;
  chargebacks: number;
}

/**
 * Transactions and chargebacks per local hour, from the first to the last
 * hour in `data`, with empty hours included as zeros. Without the zeros the
 * x-axis would skip quiet hours and squeeze time unevenly.
 */
export function hourlySeries(data: Transaction[]): HourPoint[] {
  if (data.length === 0) return [];
  const counts = new Map<number, HourPoint>();
  let first = Infinity;
  let last = -Infinity;
  for (const t of data) {
    const key = new Date(localHourStart(t.timestamp)).getTime();
    first = Math.min(first, key);
    last = Math.max(last, key);
    const p = counts.get(key) ?? { hour: new Date(key).toISOString(), total: 0, chargebacks: 0 };
    p.total++;
    if (t.status === "chargeback") p.chargebacks++;
    counts.set(key, p);
  }
  const out: HourPoint[] = [];
  // Step one hour of real time; the local-hour start keeps its offset, so this
  // stays on local hour boundaries (zones with :30 and :45 offsets included).
  for (let k = first; k <= last; k += 3_600_000) {
    out.push(counts.get(k) ?? { hour: new Date(k).toISOString(), total: 0, chargebacks: 0 });
  }
  return out;
}

export interface AmountBucket {
  label: string;
  min: number;
  max: number;
}

export const AMOUNT_BUCKETS: AmountBucket[] = [
  { label: "Under $50", min: 0, max: 50 },
  { label: "$50–100", min: 50, max: 100 },
  { label: "$100–200", min: 100, max: 200 },
  { label: "$200–300", min: 200, max: 300 },
  { label: "$300–500", min: 300, max: 500 },
  { label: "$500–700", min: 500, max: 700 },
  { label: "$700+", min: 700, max: Infinity },
];

export const bucketKey = (b: AmountBucket) => `${b.min}`;

/**
 * Inclusive amount filter for a bucket. Buckets are [min, max), and amounts
 * have cents, so the upper end is max − 0.01; the open-ended bucket uses the
 * data's upper bound.
 */
export function bucketRange(b: AmountBucket, upperBound: number): [number, number] {
  return [b.min, Number.isFinite(b.max) ? Math.round((b.max - 0.01) * 100) / 100 : upperBound];
}

/** The bucket whose range is exactly the current amount filter, if any. */
export function selectedBucket(range: [number, number], upperBound: number): AmountBucket | null {
  return (
    AMOUNT_BUCKETS.find((b) => {
      const [lo, hi] = bucketRange(b, upperBound);
      return lo === range[0] && hi === range[1];
    }) ?? null
  );
}

export type SortKey = "timestamp" | "amount" | "country" | "status" | "riskScore";
export type SortDir = "asc" | "desc";

/** Sorted copy. Ties fall back to newest first, so the order never depends on load order. */
export function sortTransactions(data: Transaction[], key: SortKey, dir: SortDir): Transaction[] {
  const sign = dir === "asc" ? 1 : -1;
  const cmp = (a: Transaction, b: Transaction): number => {
    if (key === "amount") return a.amount - b.amount;
    if (key === "riskScore") return (a.riskScore ?? 0) - (b.riskScore ?? 0);
    return String(a[key]).localeCompare(String(b[key]));
  };
  return [...data].sort((a, b) => cmp(a, b) * sign || b.timestamp.localeCompare(a.timestamp) || a.id.localeCompare(b.id));
}

export function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

const CSV_HEADERS = [
  "ID", "Timestamp", "Amount", "Currency", "Country", "Payment Method",
  "Status", "Customer Email", "Card Last 4", "Card BIN",
  "Product Category", "IP Country", "Merchant ID", "Risk Score",
];

/**
 * One CSV cell. Text that starts with =, +, -, @, tab or carriage return is
 * prefixed with ' so Excel, Sheets and LibreOffice show it as text instead of
 * running it as a formula (OWASP "CSV injection"). Fields such as the customer
 * email come from whoever placed the order, so a fraudster can choose them.
 * Numbers are left alone, so amounts and scores stay numeric.
 */
export function csvCell(val: unknown): string {
  if (typeof val === "number") return Number.isFinite(val) ? String(val) : "";
  let str = String(val ?? "");
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** The CSV text for a list of transactions: a header row, then one row each. */
export function transactionsToCSV(transactions: Transaction[]): string {
  const rows = transactions.map((t) => [
    t.id, t.timestamp, t.amount, t.currency, t.country,
    t.paymentMethod, t.status, t.customerEmail, t.cardLast4,
    t.cardBIN, t.productCategory, t.ipCountry, t.merchantId,
    t.riskScore ?? "",
  ]);
  return [CSV_HEADERS.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
}

/** Export filtered transactions as CSV and trigger download */
export function exportToCSV(transactions: Transaction[], filename: string) {
  const blob = new Blob([transactionsToCSV(transactions)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
