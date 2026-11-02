import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { Filters, Transaction } from "../lib/types";
import { applyFilters, findRelated, hasCardData, hourRange, localHourStart } from "../lib/utils";

const data: Transaction[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "transactions.json"), "utf8")
);

const noFilters: Filters = {
  countries: [],
  paymentMethods: [],
  statuses: [],
  amountRange: [0, 100000],
  dateRange: ["", ""],
  searchQuery: "",
  highRiskOnly: false,
};

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

// UTC, India (+5:30), Brazil (-3), Nepal (+5:45), US Pacific
const ZONES = ["UTC", "Asia/Kolkata", "America/Sao_Paulo", "Asia/Kathmandu", "America/Los_Angeles"];

describe("time-chart hour buckets", () => {
  it.each(ZONES)("clicking a bucket filters exactly that bucket's rows (%s)", (tz) => {
    process.env.TZ = tz;
    const buckets = new Map<string, Transaction[]>();
    for (const t of data) {
      const k = localHourStart(t.timestamp);
      buckets.set(k, [...(buckets.get(k) ?? []), t]);
    }
    for (const [key, rows] of Array.from(buckets)) {
      const filtered = applyFilters(data, { ...noFilters, dateRange: hourRange(key) });
      expect(filtered.map((t) => t.id).sort()).toEqual(rows.map((t) => t.id).sort());
    }
  });

  it.each(ZONES)("the fraud spike bucket returns planted rows (%s)", (tz) => {
    process.env.TZ = tz;
    const counts = new Map<string, number>();
    for (const t of data.filter((t) => t.status === "chargeback")) {
      const k = localHourStart(t.timestamp);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const [spike, n] = Array.from(counts).sort((a, b) => b[1] - a[1])[0];
    const filtered = applyFilters(data, { ...noFilters, dateRange: hourRange(spike), statuses: ["chargeback"] });
    expect(filtered.length).toBe(n);
    expect(n).toBeGreaterThan(10);
  });

  it("bucket start is the local hour in UTC terms", () => {
    process.env.TZ = "Asia/Kolkata";
    // 02:45Z = 08:15 IST, so the bucket is 08:00 IST = 02:30Z
    expect(localHourStart("2026-02-24T02:45:00.000Z")).toBe("2026-02-24T02:30:00.000Z");
    expect(hourRange("2026-02-24T02:30:00.000Z")).toEqual([
      "2026-02-24T02:30:00.000Z",
      "2026-02-24T03:29:59.999Z",
    ]);
  });
});

describe("related transactions", () => {
  const base: Transaction = {
    id: "a", timestamp: "2026-02-24T02:00:00.000Z", amount: 10, currency: "USD",
    country: "Brazil", paymentMethod: "PIX", status: "approved", customerEmail: "a@x.com",
    cardLast4: "N/A", cardBIN: "000000", productCategory: "Beauty", ipCountry: "Brazil",
    merchantId: "SHOP_BR_SP",
  };

  it("non-card rows are not related by the N/A placeholder", () => {
    const other = { ...base, id: "b", customerEmail: "b@x.com", paymentMethod: "Boleto" };
    expect(hasCardData(base)).toBe(false);
    expect(findRelated(base, [base, other])).toEqual([]);
  });

  it("same email is related, same card is related, different card is not", () => {
    const card = { ...base, paymentMethod: "Visa", cardLast4: "7012", cardBIN: "411111" };
    const sameEmail = { ...base, id: "e" };
    const sameCard = { ...card, id: "c", customerEmail: "other@x.com" };
    const otherBin = { ...card, id: "d", customerEmail: "other2@x.com", cardBIN: "510510" };
    expect(findRelated(card, [card, sameEmail, sameCard, otherBin]).map((t) => t.id)).toEqual(["e", "c"]);
  });

  it("no non-card row in the dataset lists every other non-card row", () => {
    const nonCard = data.filter((t) => !hasCardData(t));
    expect(nonCard.length).toBeGreaterThan(100);
    const maxRelated = Math.max(...nonCard.map((t) => findRelated(t, data).length));
    expect(maxRelated).toBeLessThan(20);
  });
});
