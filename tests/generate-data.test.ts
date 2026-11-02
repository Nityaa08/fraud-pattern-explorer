import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gen = require("../scripts/generate-data.js");

const committed = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "transactions.json"), "utf8")
);

describe("generate-data", () => {
  const txns = gen.generateTransactions(42);

  it("is reproducible and matches the committed file (seed 42)", () => {
    expect(gen.generateTransactions(42)).toEqual(txns);
    expect(committed).toEqual(txns);
  });

  it("uses only payment methods of the customer's country", () => {
    for (const t of txns) {
      const allowed = gen.paymentsByCountry[t.country].map((o: { value: string }) => o.value);
      expect(allowed).toContain(t.paymentMethod);
    }
    const colombia = txns.filter((t: { country: string }) => t.country === "Colombia");
    expect(colombia.some((t: { paymentMethod: string }) => ["PIX", "Boleto"].includes(t.paymentMethod))).toBe(false);
  });

  it("uses merchants from the customer's country", () => {
    for (const t of txns) {
      expect(gen.merchantsByCountry[t.country]).toContain(t.merchantId);
    }
  });

  it("keeps the planted fraud pattern", () => {
    const planted = txns.filter((t: { ipCountry: string; country: string }) => t.ipCountry !== t.country);
    expect(planted).toHaveLength(50);
    for (const t of planted) {
      expect(t.timestamp >= "2026-02-24T02:00:00.000Z" && t.timestamp <= "2026-02-24T04:00:00.000Z").toBe(true);
      expect(t.status).toBe("chargeback");
      expect(t.country).toBe("Brazil");
    }
    expect(txns).toHaveLength(900);
  });

  it("gives only card payments a card number", () => {
    for (const t of txns) {
      const card = gen.CARD_METHODS.includes(t.paymentMethod);
      expect(/^\d{4}$/.test(t.cardLast4)).toBe(card);
    }
  });
});
