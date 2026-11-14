import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { Filters, Transaction } from "../lib/types";
import { computeRiskScore } from "../lib/utils";
import { detectInsights } from "../lib/insights";
import { buildScorecard, scoreRows } from "../lib/scorecard";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gen = require("../scripts/generate-data.js");

const read = (f: string) => JSON.parse(readFileSync(path.join(__dirname, "..", "public", f), "utf8"));
const raw: Transaction[] = read("transactions.json");
const plantedIds: string[] = read("planted.json");
const planted = new Set(plantedIds);
const data = raw.map((t) => ({ ...t, riskScore: computeRiskScore(t) }));
const times = data.map((t) => t.timestamp).sort();
const all: Filters = {
  countries: [],
  paymentMethods: [],
  statuses: [],
  amountRange: [0, 1000],
  dateRange: [times[0], times[times.length - 1]],
  searchQuery: "",
  highRiskOnly: false,
  ipMismatchOnly: false,
  customerEmails: [],
};
const card = buildScorecard(data, detectInsights(data), all, planted);
const byId = Object.fromEntries(card.map((s) => [s.id, s]));

describe("answer key", () => {
  it("is the 50 planted rows and matches the generator", () => {
    expect(plantedIds).toHaveLength(50);
    expect(plantedIds).toEqual(gen.plantedIds(gen.generateTransactions(42)));
    for (const id of plantedIds) {
      const t = data.find((x) => x.id === id)!;
      expect(t.country).toBe("Brazil");
      expect(t.status).toBe("chargeback");
    }
  });
});

describe("scoreRows", () => {
  const rows = (ids: string[]) => ids.map((id) => ({ id }) as Transaction);
  it("computes precision and recall", () => {
    const s = scoreRows("x", "x", rows(["a", "b", "c", "d"]), new Set(["a", "b", "z"]));
    expect(s).toMatchObject({ flagged: 4, hits: 2, precision: 0.5 });
    expect(s.recall).toBeCloseTo(2 / 3);
  });
  it("is zero, not NaN, when nothing is flagged", () => {
    expect(scoreRows("x", "x", [], new Set(["a"]))).toMatchObject({ precision: 0, recall: 0 });
  });
});

describe("scorecard on the committed data", () => {
  it("scores every pattern rule plus the risk score", () => {
    expect(card.map((s) => s.id).sort()).toEqual(
      ["burst-Brazil", "high-amount", "ip-mismatch", "repeat-emails", "risk-score"].sort()
    );
  });

  it("the burst rule finds every planted row, with one false alarm", () => {
    expect(byId["burst-Brazil"]).toMatchObject({ flagged: 51, hits: 50, recall: 1 });
  });

  it("the IP rule is perfect only because the generator puts mismatches in planted rows alone", () => {
    expect(byId["ip-mismatch"]).toMatchObject({ flagged: 50, hits: 50, precision: 1, recall: 1 });
  });

  it("gives these flagged / hit counts (also in the README)", () => {
    const line = card.map((s) => `${s.id} ${s.flagged} ${s.hits}`).sort();
    expect(line).toMatchInlineSnapshot(`
      [
        "burst-Brazil 51 50",
        "high-amount 20 20",
        "ip-mismatch 50 50",
        "repeat-emails 50 50",
        "risk-score 50 50",
      ]
    `);
  });
});
