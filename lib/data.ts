import { Transaction } from "./types";

let cachedData: Transaction[] | null = null;

export async function loadTransactions(): Promise<Transaction[]> {
  if (cachedData) return cachedData;
  const res = await fetch("/transactions.json");
  const data: Transaction[] = await res.json();
  // Sort by timestamp descending
  data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  cachedData = data;
  return data;
}

export function getUniqueValues(transactions: Transaction[], key: keyof Transaction): string[] {
  return Array.from(new Set(transactions.map((t) => String(t[key])))).sort();
}

export function getAmountRange(transactions: Transaction[]): [number, number] {
  const amounts = transactions.map((t) => t.amount);
  return [Math.floor(Math.min(...amounts)), Math.ceil(Math.max(...amounts))];
}

export function getDateRange(transactions: Transaction[]): [string, string] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  return [sorted[0].timestamp, sorted[sorted.length - 1].timestamp];
}

/** IDs of the planted attack rows (the scorecard's answer key). */
export async function loadPlantedIds(): Promise<string[]> {
  const res = await fetch("/planted.json");
  if (!res.ok) throw new Error(`planted.json: ${res.status}`);
  return res.json();
}
