import { Filters } from "./types";
import { formatCurrency } from "./utils";

export interface Bounds {
  amount: [number, number];
  date: [string, string];
}

export interface FilterChip {
  key: string;
  label: string;
  /** The filters with this one removed. */
  remove: (f: Filters) => Filters;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function without<T>(list: T[], item: T): T[] {
  return list.filter((x) => x !== item);
}

/**
 * Every active filter as a removable chip. Date and amount ranges count as
 * active only when they are narrower than the data, so clicking the
 * time-chart spike shows a chip for the hour it selected.
 */
export function activeFilterChips(f: Filters, bounds: Bounds): FilterChip[] {
  const chips: FilterChip[] = [];
  f.countries.forEach((c) =>
    chips.push({ key: `country:${c}`, label: c, remove: (x) => ({ ...x, countries: without(x.countries, c) }) })
  );
  f.paymentMethods.forEach((m) =>
    chips.push({ key: `method:${m}`, label: m, remove: (x) => ({ ...x, paymentMethods: without(x.paymentMethods, m) }) })
  );
  f.statuses.forEach((s) =>
    chips.push({
      key: `status:${s}`,
      label: s.charAt(0).toUpperCase() + s.slice(1),
      remove: (x) => ({ ...x, statuses: without(x.statuses, s) }),
    })
  );
  if (f.customerEmails.length > 0) {
    chips.push({
      key: "emails",
      label: f.customerEmails.length === 1 ? f.customerEmails[0] : `${f.customerEmails.length} customer emails`,
      remove: (x) => ({ ...x, customerEmails: [] }),
    });
  }
  if (f.highRiskOnly) chips.push({ key: "high-risk", label: "High risk", remove: (x) => ({ ...x, highRiskOnly: false }) });
  if (f.ipMismatchOnly)
    chips.push({ key: "ip-mismatch", label: "IP ≠ billing country", remove: (x) => ({ ...x, ipMismatchOnly: false }) });
  if (f.searchQuery)
    chips.push({ key: "search", label: `“${f.searchQuery}”`, remove: (x) => ({ ...x, searchQuery: "" }) });

  const [lo, hi] = f.amountRange;
  if (lo > bounds.amount[0] || hi < bounds.amount[1]) {
    chips.push({
      key: "amount",
      label: `${formatCurrency(lo)} – ${formatCurrency(hi)}`,
      remove: (x) => ({ ...x, amountRange: bounds.amount }),
    });
  }

  const [from, to] = f.dateRange;
  if ((from && from > bounds.date[0]) || (to && to < bounds.date[1])) {
    chips.push({
      key: "date",
      label: `${dateFmt.format(new Date(from || bounds.date[0]))} – ${dateFmt.format(new Date(to || bounds.date[1]))}`,
      remove: (x) => ({ ...x, dateRange: bounds.date }),
    });
  }
  return chips;
}
