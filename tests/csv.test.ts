import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { Transaction } from "../lib/types";
import { csvCell, transactionsToCSV } from "../lib/utils";

const data: Transaction[] = JSON.parse(
  readFileSync(path.join(__dirname, "..", "public", "transactions.json"), "utf8")
);

/** Minimal RFC 4180 reader, so the tests check what a spreadsheet would read. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

describe("csvCell", () => {
  it.each([
    ["=HYPERLINK(\"http://evil.example\",\"Click\")", "\"'=HYPERLINK(\"\"http://evil.example\"\",\"\"Click\"\")\""],
    ["=1+1", "'=1+1"],
    ["+44 20 7946 0000", "'+44 20 7946 0000"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
    ["\t=1+1", "'\t=1+1"],
  ])("neutralises a cell that a spreadsheet would run as a formula: %s", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("leaves ordinary text, numbers and empty values unchanged", () => {
    expect(csvCell("buyer@example.com")).toBe("buyer@example.com");
    expect(csvCell("a=b@example.com")).toBe("a=b@example.com");
    expect(csvCell(649.99)).toBe("649.99");
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell("")).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Smith, J")).toBe('"Smith, J"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("transactionsToCSV", () => {
  it("writes a header and one row per transaction that read back to the same values", () => {
    const rows = parseCSV(transactionsToCSV(data));
    expect(rows).toHaveLength(data.length + 1);
    expect(rows[0]).toHaveLength(14);
    rows.slice(1).forEach((r, i) => {
      const t = data[i];
      expect(r).toHaveLength(14);
      expect(r[0]).toBe(t.id);
      expect(r[1]).toBe(t.timestamp);
      expect(Number(r[2])).toBe(t.amount);
      expect(r[7]).toBe(t.customerEmail);
      expect(r[13]).toBe(String(t.riskScore ?? ""));
    });
  });

  it("does not let an attacker-chosen email become a formula in the export", () => {
    const evil: Transaction = { ...data[0], customerEmail: "=cmd|' /C calc'!A0" };
    const [, row] = parseCSV(transactionsToCSV([evil]));
    expect(row[7]).toBe("'=cmd|' /C calc'!A0");
    expect(row.every((cell) => !/^[=+\-@\t\r]/.test(cell) || cell === row[2])).toBe(true);
  });
});
