import { Filters, Transaction } from "./types";
import { formatCurrency, groupBy } from "./utils";

export type Severity = "high" | "medium";

/** A suspicious pattern, with the filter change that shows exactly its rows. */
export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Number of transactions the filter will show. */
  count: number;
  filter: Partial<Filters>;
}

/** Window used to look for a burst of chargebacks from one country. */
export const BURST_WINDOW_MS = 2 * 3_600_000;
/** Chargebacks within the window that make a burst. */
export const BURST_MIN = 10;
/** Chargebacks on one customer email that make it a repeat offender. */
export const REPEAT_CHARGEBACKS = 3;

const isChargeback = (t: Transaction) => t.status === "chargeback";
const time = (t: Transaction) => new Date(t.timestamp).getTime();

function topValues(values: string[], n: number): string[] {
  const counts = new Map<string, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([v]) => v);
}

/**
 * The densest run of chargebacks from one country inside BURST_WINDOW_MS.
 * A sliding window, so background chargebacks spread over the week do not
 * hide a burst (the old rule measured the span of all of a country's
 * chargebacks, so a planted 2-hour burst in a country with other
 * chargebacks was never flagged).
 */
export function findChargebackBurst(
  txns: Transaction[]
): { rows: Transaction[]; start: string; end: string } | null {
  const sorted = txns.filter(isChargeback).sort((a, b) => time(a) - time(b));
  let best: Transaction[] = [];
  let lo = 0;
  for (let hi = 0; hi < sorted.length; hi++) {
    while (time(sorted[hi]) - time(sorted[lo]) > BURST_WINDOW_MS) lo++;
    if (hi - lo + 1 > best.length) best = sorted.slice(lo, hi + 1);
  }
  if (best.length < BURST_MIN) return null;
  return { rows: best, start: best[0].timestamp, end: best[best.length - 1].timestamp };
}

export function detectInsights(data: Transaction[]): Insight[] {
  const insights: Insight[] = [];
  if (data.length === 0) return insights;
  const chargebacks = data.filter(isChargeback);

  // 1. Burst of chargebacks from one country.
  for (const [country, txns] of Object.entries(groupBy(data, (t) => t.country))) {
    const burst = findChargebackBurst(txns);
    if (!burst) continue;
    const { rows } = burst;
    const minutes = Math.round((time(rows[rows.length - 1]) - time(rows[0])) / 60_000);
    const avg = rows.reduce((s, t) => s + t.amount, 0) / rows.length;
    const ips = topValues(rows.filter((t) => t.ipCountry !== t.country).map((t) => t.ipCountry), 3);
    const [method] = topValues(rows.map((t) => t.paymentMethod), 1);
    const methodShare = rows.filter((t) => t.paymentMethod === method).length / rows.length;
    insights.push({
      id: `burst-${country}`,
      severity: "high",
      title: `${rows.length} chargebacks from ${country} within ${
        minutes >= 90 ? `${Math.ceil(minutes / 60)} hours` : `${minutes} minutes`
      }`,
      detail: [
        `avg ${formatCurrency(avg)}`,
        methodShare >= 0.5 ? `${Math.round(methodShare * 100)}% ${method}` : "",
        ips.length ? `IP in ${ips.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      count: rows.length,
      filter: { countries: [country], statuses: ["chargeback"], dateRange: [burst.start, burst.end] },
    });
  }

  // 2. Customer emails with repeated chargebacks.
  const repeat = Object.entries(groupBy(chargebacks, (t) => t.customerEmail))
    .filter(([, txns]) => txns.length >= REPEAT_CHARGEBACKS)
    .sort((a, b) => b[1].length - a[1].length);
  if (repeat.length > 0) {
    const emails = repeat.map(([e]) => e);
    const count = data.filter((t) => emails.includes(t.customerEmail)).length;
    insights.push({
      id: "repeat-emails",
      severity: "high",
      title: `${emails.length} customer ${emails.length === 1 ? "email" : "emails"} with ${REPEAT_CHARGEBACKS}+ chargebacks`,
      detail: `Top: ${repeat[0][0]} (${repeat[0][1].length} chargebacks)`,
      count,
      filter: { customerEmails: emails },
    });
  }

  // 3. IP country differs from billing country.
  const mismatches = data.filter((t) => t.ipCountry !== t.country);
  if (mismatches.length >= 5) {
    const cb = mismatches.filter(isChargeback).length;
    insights.push({
      id: "ip-mismatch",
      severity: cb >= 10 ? "high" : "medium",
      title: `${mismatches.length} IP / billing country mismatches`,
      detail: `${cb} of them are chargebacks · IP in ${topValues(mismatches.map((t) => t.ipCountry), 3).join(", ")}`,
      count: mismatches.length,
      filter: { ipMismatchOnly: true },
    });
  }

  // 4. Chargebacks at more than 3x the average amount.
  const avg = data.reduce((s, t) => s + t.amount, 0) / data.length;
  const highCb = chargebacks.filter((t) => t.amount > avg * 3);
  if (highCb.length >= 3) {
    const max = Math.ceil(Math.max(...highCb.map((t) => t.amount)));
    insights.push({
      id: "high-amount",
      severity: "medium",
      title: `${highCb.length} chargebacks above ${formatCurrency(avg * 3)}`,
      detail: `3x the average amount of ${formatCurrency(avg)} in this view`,
      count: highCb.length,
      filter: { statuses: ["chargeback"], amountRange: [Math.floor(avg * 3 * 100) / 100, max] },
    });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * The cards to show: the rules run on the current view, plus the card whose
 * filter is applied right now, if the rules no longer find it.
 *
 * A rule that measures the view can stop matching once its own filter is on:
 * "chargebacks above 3x the average" applied leaves only those rows, whose
 * average is higher, so the card vanished right after "Show these" instead of
 * staying as the active one.
 */
export function withAppliedInsight(
  current: Insight[],
  applied: Insight | null,
  isActive: (insight: Insight) => boolean
): Insight[] {
  if (!applied || !isActive(applied) || current.some((i) => i.id === applied.id)) return current;
  return [...current, applied];
}
