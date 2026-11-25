import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { Filters, Transaction } from "../lib/types";
import {
  amountFromInput,
  applyFilters,
  findRelated,
  hasCardData,
  hourRange,
  localDay,
  localDayEnd,
  localDayStart,
  localHourStart,
  shownLabel,
} from "../lib/utils";

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
  ipMismatchOnly: false,
  customerEmails: [],
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

describe("date-range pickers use the viewer's calendar day", () => {
  it.each(ZONES)("picking one day filters exactly the rows on that local day (%s)", (tz) => {
    process.env.TZ = tz;
    const days = new Map<string, Transaction[]>();
    for (const t of data) {
      const k = localDay(t.timestamp);
      days.set(k, [...(days.get(k) ?? []), t]);
    }
    expect(days.size).toBeGreaterThan(1);
    for (const [day, rows] of Array.from(days)) {
      const filtered = applyFilters(data, { ...noFilters, dateRange: [localDayStart(day), localDayEnd(day)] });
      expect(filtered.map((t) => t.id).sort()).toEqual(rows.map((t) => t.id).sort());
    }
  });

  it("a late-evening UTC row belongs to the next day in India", () => {
    process.env.TZ = "Asia/Kolkata";
    // 20:00Z on Feb 23 is 01:30 IST on Feb 24
    expect(localDay("2026-02-23T20:00:00.000Z")).toBe("2026-02-24");
    expect(localDayStart("2026-02-24")).toBe("2026-02-23T18:30:00.000Z");
    expect(localDayEnd("2026-02-24")).toBe("2026-02-24T18:29:59.999Z");
  });

  it("a DST change day is 23 hours long in US Pacific", () => {
    process.env.TZ = "America/Los_Angeles";
    // Clocks went forward on 2026-03-08
    const start = new Date(localDayStart("2026-03-08")).getTime();
    const end = new Date(localDayEnd("2026-03-08")).getTime();
    expect(end - start + 1).toBe(23 * 3_600_000);
  });

  it("the date input shows the local day of a range set by a chart click", () => {
    process.env.TZ = "Asia/Kolkata";
    const [from, to] = hourRange(localHourStart("2026-02-23T20:10:00.000Z"));
    expect(localDay(from)).toBe("2026-02-24");
    expect(localDay(to)).toBe("2026-02-24");
    expect(localDay("")).toBe("");
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

describe("amountFromInput", () => {
  it("treats a cleared box as no limit, not $0", () => {
    // Clearing the maximum to type a new one used to filter to amount <= 0.
    expect(amountFromInput("", 799)).toBe(799);
    expect(amountFromInput("   ", 22)).toBe(22);
    const cleared = applyFilters(data, { ...noFilters, amountRange: [0, amountFromInput("", 1000)] });
    expect(cleared.length).toBe(data.length);
  });

  it("reads what the user typed", () => {
    expect(amountFromInput("500", 799)).toBe(500);
    expect(amountFromInput("0500", 799)).toBe(500);
    expect(amountFromInput("12.5", 799)).toBe(12.5);
    expect(amountFromInput("0", 799)).toBe(0);
  });

  it("falls back to the bound for anything that is not a finite number", () => {
    expect(amountFromInput("abc", 799)).toBe(799);
    expect(amountFromInput("1e999", 799)).toBe(799);
    expect(amountFromInput("-", 22)).toBe(22);
  });
});

describe("shownLabel", () => {
  // At 390 px the header used to show only "51": the "of 900 shown" part was
  // display:none on phones, so a screen reader also heard just the number.
  it("says how many of how many transactions are shown", () => {
    expect(shownLabel(51, 900)).toBe("51 of 900 transactions shown");
    expect(shownLabel(0, 900)).toBe("0 of 900 transactions shown");
    expect(shownLabel(1234, 12000)).toBe("1,234 of 12,000 transactions shown");
  });
  it("says all when nothing is filtered out", () => {
    expect(shownLabel(900, 900)).toBe("All 900 transactions shown");
  });
});
