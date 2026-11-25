import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { Filters, Transaction } from "../lib/types";
import {
  applyFilters,
  computeRiskScore,
  riskSignals,
  sortTransactions,
  hourlySeries,
  localHourStart,
  riskLevel,
  HIGH_RISK,
} from "../lib/utils";
import * as utils from "../lib/utils";
import { detectInsights, findChargebackBurst, withAppliedInsight } from "../lib/insights";
import { activeFilterChips } from "../lib/filterChips";

const raw: Transaction[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "transactions.json"), "utf8")
);
const data = raw.map((t) => ({ ...t, riskScore: computeRiskScore(t) }));

const amountBounds: [number, number] = [0, 1000];
const times = data.map((t) => t.timestamp).sort();
const dateBounds: [string, string] = [times[0], times[times.length - 1]];
const all: Filters = {
  countries: [],
  paymentMethods: [],
  statuses: [],
  amountRange: amountBounds,
  dateRange: dateBounds,
  searchQuery: "",
  highRiskOnly: false,
  ipMismatchOnly: false,
  customerEmails: [],
};
const bounds = { amount: amountBounds, date: dateBounds };

// The planted pattern: Brazil, chargeback, IP elsewhere, Feb 24 02:00–04:00 UTC.
const planted = data.filter(
  (t) => t.country === "Brazil" && t.status === "chargeback" && t.ipCountry !== t.country
);

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe("suspicious patterns", () => {
  it("finds the planted 2-hour burst even though Brazil has other chargebacks", () => {
    // Brazil has 25 background chargebacks spread over the week, which hid
    // the burst from the old "span of all chargebacks <= 4h" rule.
    const brazilCb = data.filter((t) => t.country === "Brazil" && t.status === "chargeback");
    expect(brazilCb.length).toBeGreaterThan(planted.length);

    const burst = findChargebackBurst(data.filter((t) => t.country === "Brazil"))!;
    expect(burst).not.toBeNull();
    expect(burst.start >= "2026-02-24T02:00:00Z" && burst.end < "2026-02-24T04:00:00Z").toBe(true);
    // All 50 planted rows, plus the one ordinary chargeback that happens to
    // fall inside the same two hours.
    const ids = new Set(burst.rows.map((t) => t.id));
    expect(planted.every((t) => ids.has(t.id))).toBe(true);
    expect(burst.rows.length).toBe(51);
    expect(burst.rows.filter((t) => t.ipCountry === t.country)).toHaveLength(1);
  });

  it("flags the burst first, and its action shows the burst's rows", () => {
    const insights = detectInsights(data);
    expect(insights[0].id).toBe("burst-Brazil");
    expect(insights[0].count).toBe(51);
    expect(insights[0].detail).toContain("IP in");
    const shown = applyFilters(data, { ...all, ...insights[0].filter });
    expect(shown).toHaveLength(51);
    const ids = new Set(shown.map((t) => t.id));
    expect(planted.every((t) => ids.has(t.id))).toBe(true);
  });

  it("flags only the 5 repeat-chargeback emails, not every frequent shopper", () => {
    const repeat = detectInsights(data).find((i) => i.id === "repeat-emails")!;
    expect(repeat.filter.customerEmails).toHaveLength(5);
    expect(new Set(repeat.filter.customerEmails)).toEqual(new Set(planted.map((t) => t.customerEmail)));
  });

  it("every action shows as many rows as its card says, in a filtered view too", () => {
    for (const view of [all, { ...all, countries: ["Brazil"] }, { ...all, statuses: ["chargeback"] }]) {
      const rows = applyFilters(data, view);
      for (const insight of detectInsights(rows)) {
        expect(applyFilters(data, { ...view, ...insight.filter }).length, insight.id).toBe(insight.count);
      }
    }
  });

  it("finds nothing in an empty view or a quiet country", () => {
    expect(detectInsights([])).toEqual([]);
    const colombia = data.filter((t) => t.country === "Colombia");
    expect(findChargebackBurst(colombia)).toBeNull();
  });
});

describe("risk level", () => {
  it("High risk filter, table and detail panel use one threshold", () => {
    // The filter used >= 50 while the table called 40–69 "medium", so one
    // row scored 55 showed up under High Risk Only labelled Medium.
    const shown = applyFilters(data, { ...all, highRiskOnly: true });
    expect(shown.every((t) => riskLevel(t.riskScore) === "high")).toBe(true);
    expect(shown.length).toBe(data.filter((t) => (t.riskScore ?? 0) >= HIGH_RISK).length);
    expect(riskLevel(55)).toBe("medium");
    expect(riskLevel(70)).toBe("high");
    expect(riskLevel(undefined)).toBe("low");
  });
});

describe("new filters", () => {
  it("IP mismatch only keeps rows whose IP country differs", () => {
    const shown = applyFilters(data, { ...all, ipMismatchOnly: true });
    expect(shown.length).toBe(50);
    expect(shown.every((t) => t.ipCountry !== t.country)).toBe(true);
  });

  it("customer emails keeps only those customers", () => {
    const email = data[0].customerEmail;
    const shown = applyFilters(data, { ...all, customerEmails: [email] });
    expect(shown.length).toBe(data.filter((t) => t.customerEmail === email).length);
  });
});

describe("hourly series", () => {
  it.each(["UTC", "Asia/Kolkata", "Asia/Kathmandu"])("includes empty hours as zeros (%s)", (tz) => {
    process.env.TZ = tz;
    const series = hourlySeries(data);
    for (let i = 1; i < series.length; i++) {
      expect(new Date(series[i].hour).getTime() - new Date(series[i - 1].hour).getTime()).toBe(3_600_000);
    }
    expect(series.reduce((s, p) => s + p.total, 0)).toBe(data.length);
    expect(series.some((p) => p.total === 0)).toBe(true);
    expect(series[0].hour).toBe(localHourStart(dateBounds[0]));
  });

  it("puts the planted burst in the busiest chargeback hours", () => {
    process.env.TZ = "UTC";
    const top = [...hourlySeries(data)].sort((a, b) => b.chargebacks - a.chargebacks).slice(0, 2);
    expect(top.map((p) => p.hour).sort()).toEqual(["2026-02-24T02:00:00.000Z", "2026-02-24T03:00:00.000Z"]);
  });
});

describe("active filter chips", () => {
  it("shows none for the full data", () => {
    expect(activeFilterChips(all, bounds)).toEqual([]);
  });

  it("shows a chip for a date range, so a time-chart click is visible", () => {
    const f = { ...all, dateRange: ["2026-02-24T02:00:00.000Z", "2026-02-24T02:59:59.999Z"] as [string, string] };
    const chips = activeFilterChips(f, bounds);
    expect(chips.map((c) => c.key)).toEqual(["date"]);
    expect(chips[0].remove(f).dateRange).toEqual(dateBounds);
  });

  it("each chip removes only its own filter", () => {
    const f: Filters = {
      ...all,
      countries: ["Brazil", "Mexico"],
      statuses: ["chargeback"],
      amountRange: [400, 900],
      highRiskOnly: true,
      ipMismatchOnly: true,
      customerEmails: ["a@b.c", "d@e.f"],
      searchQuery: "7012",
    };
    const chips = activeFilterChips(f, bounds);
    expect(chips.map((c) => c.label)).toEqual([
      "Brazil",
      "Mexico",
      "Chargeback",
      "2 customer emails",
      "High risk",
      "IP ≠ billing country",
      "“7012”",
      "$400.00 – $900.00",
    ]);
    const brazilRemoved = chips[0].remove(f);
    expect(brazilRemoved.countries).toEqual(["Mexico"]);
    expect({ ...brazilRemoved, countries: f.countries }).toEqual(f);
    for (const chip of chips) {
      expect(activeFilterChips(chip.remove(f), bounds).map((c) => c.key)).not.toContain(chip.key);
    }
  });
});

describe("risk signals", () => {
  it("add up to the score (capped at 100) for every row", () => {
    // Same weights as before the refactor: the planted rows score 90–100.
    for (const t of data) {
      const sum = riskSignals(t).reduce((s, x) => s + x.points, 0);
      expect(computeRiskScore(t)).toBe(Math.min(sum, 100));
    }
    expect(planted.every((t) => (t.riskScore ?? 0) >= 90)).toBe(true);
  });
});

describe("table sort", () => {
  it("sorts by risk with newest first among equal scores", () => {
    const sorted = sortTransactions(data, "riskScore", "desc");
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      expect((a.riskScore ?? 0) >= (b.riskScore ?? 0)).toBe(true);
      if (a.riskScore === b.riskScore) expect(a.timestamp >= b.timestamp).toBe(true);
    }
    expect(riskLevel(sorted[49].riskScore)).toBe("high");
    expect(sortTransactions(data, "amount", "asc")[0].amount).toBe(Math.min(...data.map((t) => t.amount)));
    const before = data.map((t) => t.id);
    sortTransactions(data, "country", "asc");
    expect(data.map((t) => t.id)).toEqual(before);
  });
});

describe("amount buckets", () => {
  it("clicking a bucket filters exactly its rows, and is recognised as selected", () => {
    const { AMOUNT_BUCKETS, bucketRange, selectedBucket } = utils;
    const upper = Math.ceil(Math.max(...data.map((t) => t.amount)));
    let total = 0;
    for (const b of AMOUNT_BUCKETS) {
      const range = bucketRange(b, upper);
      const shown = applyFilters(data, { ...all, amountRange: range });
      expect(shown.length).toBe(data.filter((t) => t.amount >= b.min && t.amount < b.max).length);
      expect(selectedBucket(range, upper)).toBe(b);
      total += shown.length;
    }
    expect(total).toBe(data.length);
    expect(selectedBucket([0, upper], upper)).toBeNull();
  });
});

describe("the applied pattern card", () => {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const activeIn = (f: Filters) => (i: { filter: Partial<Filters> }) =>
    (Object.keys(i.filter) as (keyof Filters)[]).every((k) => same(f[k], i.filter[k]));

  it("stays on screen after its own filter is applied", () => {
    // Applying "chargebacks above 3x the average" leaves only those rows; their
    // average is higher, so the rule no longer fires on the view and the card vanished.
    const high = detectInsights(data).find((i) => i.id === "high-amount")!;
    expect(high).toBeDefined();
    const after = { ...all, ...high.filter };
    const view = applyFilters(data, after);
    expect(view).toHaveLength(high.count);
    const rerun = detectInsights(view);
    expect(rerun.some((i) => i.id === "high-amount")).toBe(false);

    const shown = withAppliedInsight(rerun, high, activeIn(after));
    expect(shown.filter((i) => i.id === "high-amount")).toHaveLength(1);
  });

  it("goes away once its filter is changed or cleared", () => {
    const high = detectInsights(data).find((i) => i.id === "high-amount")!;
    expect(withAppliedInsight([], high, activeIn(all))).toEqual([]);
    expect(withAppliedInsight([], null, activeIn(all))).toEqual([]);
  });

  it("is not shown twice when the rules still find it", () => {
    const cards = detectInsights(data);
    const ip = cards.find((i) => i.id === "ip-mismatch")!;
    const shown = withAppliedInsight(cards, ip, activeIn({ ...all, ...ip.filter }));
    expect(shown.filter((i) => i.id === "ip-mismatch")).toHaveLength(1);
  });
});
