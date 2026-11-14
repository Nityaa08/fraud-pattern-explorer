import { Filters, Transaction } from "./types";
import { applyFilters, HIGH_RISK } from "./utils";
import { Insight } from "./insights";

/**
 * How well each rule finds the planted attack.
 *
 * The rules never see the answer key (public/planted.json); it is only used
 * here, after the fact, the way a held-out label set is used to score a model.
 */
export interface RuleScore {
  id: string;
  name: string;
  /** Rows the rule flags. */
  flagged: number;
  /** Flagged rows that are part of the planted attack. */
  hits: number;
  /** hits / flagged: when the rule fires, how often it is right. */
  precision: number;
  /** hits / planted: how much of the attack the rule finds. */
  recall: number;
}

export function scoreRows(
  id: string,
  name: string,
  rows: Transaction[],
  planted: Set<string>
): RuleScore {
  const hits = rows.filter((t) => planted.has(t.id)).length;
  return {
    id,
    name,
    flagged: rows.length,
    hits,
    precision: rows.length ? hits / rows.length : 0,
    recall: planted.size ? hits / planted.size : 0,
  };
}

const RULE_NAMES: Record<string, string> = {
  "repeat-emails": "Repeat chargeback emails",
  "ip-mismatch": "IP ≠ billing country",
  "high-amount": "High-amount chargebacks",
};

function ruleName(insight: Insight): string {
  if (insight.id.startsWith("burst-")) return `Chargeback burst (${insight.id.slice(6)})`;
  return RULE_NAMES[insight.id] ?? insight.title;
}

/**
 * Scores every pattern rule (on the unfiltered data, so the numbers do not
 * move as the analyst filters) plus the per-row risk score at the high-risk
 * threshold. `all` must be the filters that show every row.
 */
export function buildScorecard(
  data: Transaction[],
  insights: Insight[],
  all: Filters,
  planted: Set<string>
): RuleScore[] {
  const scores = insights.map((i) =>
    scoreRows(i.id, ruleName(i), applyFilters(data, { ...all, ...i.filter }), planted)
  );
  scores.push(
    scoreRows(
      "risk-score",
      `Risk score ${HIGH_RISK}+`,
      data.filter((t) => (t.riskScore ?? 0) >= HIGH_RISK),
      planted
    )
  );
  return scores;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
