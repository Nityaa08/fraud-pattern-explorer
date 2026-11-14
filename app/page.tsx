"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Filters, Transaction } from "@/lib/types";
import { getAmountRange, getDateRange, getUniqueValues, loadTransactions } from "@/lib/data";
import {
  AMOUNT_BUCKETS,
  applyFilters,
  bucketKey,
  bucketRange,
  computeRiskScore,
  hourRange,
  selectedBucket,
} from "@/lib/utils";
import { detectInsights, Insight } from "@/lib/insights";
import { activeFilterChips } from "@/lib/filterChips";
import FilterPanel from "@/components/filters/FilterPanel";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import CountryChart from "@/components/charts/CountryChart";
import PaymentMethodChart from "@/components/charts/PaymentMethodChart";
import AmountChart from "@/components/charts/AmountChart";
import TransactionTable from "@/components/table/TransactionTable";
import TransactionDetail from "@/components/ui/TransactionDetail";
import StatsBar from "@/components/ui/StatsBar";
import InsightsPanel from "@/components/ui/InsightsPanel";

const defaultFilters: Filters = {
  countries: [],
  paymentMethods: [],
  statuses: [],
  amountRange: [0, 1000],
  dateRange: ["", ""],
  searchQuery: "",
  highRiskOnly: false,
  ipMismatchOnly: false,
  customerEmails: [],
};

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** True if applying `patch` would not change `f`. */
function includesPatch(f: Filters, patch: Partial<Filters>): boolean {
  return (Object.keys(patch) as (keyof Filters)[]).every(
    (k) => JSON.stringify(f[k]) === JSON.stringify(patch[k])
  );
}

export default function Dashboard() {
  const [allData, setAllData] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [amountBounds, setAmountBounds] = useState<[number, number]>([0, 1000]);
  const [dateBounds, setDateBounds] = useState<[string, string]>(["", ""]);
  const [options, setOptions] = useState({ countries: [] as string[], methods: [] as string[], statuses: [] as string[] });

  useEffect(() => {
    loadTransactions()
      .then((data) => {
        const enriched = data.map((t) => ({ ...t, riskScore: computeRiskScore(t) }));
        const ab = getAmountRange(enriched);
        const db = getDateRange(enriched);
        setAllData(enriched);
        setAmountBounds(ab);
        setDateBounds(db);
        setOptions({
          countries: getUniqueValues(enriched, "country"),
          methods: getUniqueValues(enriched, "paymentMethod"),
          statuses: getUniqueValues(enriched, "status"),
        });
        setFilters({ ...defaultFilters, amountRange: ab, dateRange: db });
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load the transaction data.");
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);

  // Each chart shows the data filtered by everything except its own
  // dimension, so a selected bar stays next to the others for comparison.
  const exceptDate = useMemo(
    () => applyFilters(allData, { ...filters, dateRange: dateBounds }),
    [allData, filters, dateBounds]
  );
  const exceptCountry = useMemo(() => applyFilters(allData, { ...filters, countries: [] }), [allData, filters]);
  const exceptMethod = useMemo(() => applyFilters(allData, { ...filters, paymentMethods: [] }), [allData, filters]);
  const exceptAmount = useMemo(
    () => applyFilters(allData, { ...filters, amountRange: amountBounds }),
    [allData, filters, amountBounds]
  );

  const insights = useMemo(() => detectInsights(filtered), [filtered]);
  const bounds = useMemo(() => ({ amount: amountBounds, date: dateBounds }), [amountBounds, dateBounds]);
  const chips = activeFilterChips(filters, bounds);

  const resetFilters = useCallback(
    () => setFilters({ ...defaultFilters, amountRange: amountBounds, dateRange: dateBounds }),
    [amountBounds, dateBounds]
  );
  const closeDetail = useCallback(() => setSelected(null), []);

  const applyInsight = (insight: Insight) => setFilters((f) => ({ ...f, ...insight.filter }));

  const onTimeClick = (hourStartIso: string) => {
    if (Number.isNaN(new Date(hourStartIso).getTime())) return;
    const range = hourRange(hourStartIso);
    // Clicking the selected hour again clears the date filter.
    setFilters((f) =>
      f.dateRange[0] === range[0] && f.dateRange[1] === range[1] ? { ...f, dateRange: dateBounds } : { ...f, dateRange: range }
    );
  };

  const currentBucket = selectedBucket(filters.amountRange, amountBounds[1]);
  const onBucketClick = (key: string) => {
    const b = AMOUNT_BUCKETS.find((x) => bucketKey(x) === key);
    if (!b) return;
    setFilters((f) =>
      currentBucket && bucketKey(currentBucket) === key
        ? { ...f, amountRange: amountBounds }
        : { ...f, amountRange: bucketRange(b, amountBounds[1]) }
    );
  };

  const dateNarrowed = filters.dateRange[0] > dateBounds[0] || filters.dateRange[1] < dateBounds[1];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500" role="status">
        Loading transactions…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-sm p-6 text-center">
          <p className="text-sm font-medium text-slate-900">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-xs font-medium text-indigo-600 underline">
            Reload the page
          </button>
        </div>
      </div>
    );
  }

  const filterPanel = (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      countries={options.countries}
      paymentMethods={options.methods}
      statuses={options.statuses}
      amountBounds={amountBounds}
      dateBounds={dateBounds}
    />
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-900" aria-hidden>
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="white" strokeWidth="1.6">
                <path d="M2 12 L6 7 L9 9.5 L14 3" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="14" cy="3" r="1.4" fill="#ef4444" stroke="none" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-slate-900">Transaction Pattern Explorer</h1>
              <p className="truncate text-[11px] text-slate-500">Fraud analytics demo · 900 synthetic transactions</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4 text-xs">
            <span className="tabular-nums text-slate-500" aria-live="polite">
              <span className="font-semibold text-slate-900">{filtered.length.toLocaleString("en-US")}</span>
              <span className="hidden sm:inline"> of {allData.length.toLocaleString("en-US")} shown</span>
            </span>
            <a
              href="https://github.com/Nityaa08/fraud-pattern-explorer"
              className="hidden font-medium text-slate-600 hover:text-slate-900 sm:inline"
            >
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-500">
          Generated data with one planted fraud attack; no real customers. Start with a suspicious pattern below, or click
          the red spike in the hourly chart. Built by{" "}
          <a href="https://nityashree.in" className="font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900">
            Nityashree S
          </a>
          .
        </p>

        <StatsBar data={filtered} />

        <InsightsPanel insights={insights} isActive={(i) => includesPatch(filters, i.filter)} onApply={applyInsight} />

        {/* Active filters */}
        <div className="flex min-h-[32px] flex-wrap items-center gap-2" aria-label="Active filters">
          <span className="eyebrow mr-1">Filters</span>
          {chips.length === 0 ? (
            <span className="text-xs text-slate-400">None. Every bar, hour and pattern above can be clicked to filter.</span>
          ) : (
            <>
              {chips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-indigo-800"
                >
                  {c.label}
                  <button
                    type="button"
                    onClick={() => setFilters((f) => c.remove(f))}
                    aria-label={`Remove filter ${c.label}`}
                    className="grid h-5 w-5 place-items-center rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button type="button" onClick={resetFilters} className="ml-1 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline">
                Clear all
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[256px_minmax(0,1fr)]">
          {/* Filters: a sidebar on large screens, a collapsible card on small ones */}
          <aside className="card h-fit lg:sticky lg:top-[72px]" aria-label="Filters">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900 lg:cursor-default"
              aria-expanded={filtersOpen}
              aria-controls="filter-panel"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <span>
                All filters
                {chips.length > 0 && <span className="ml-1.5 font-normal text-slate-500">({chips.length} active)</span>}
              </span>
              <span className="text-slate-400 lg:hidden" aria-hidden>
                {filtersOpen ? "▴" : "▾"}
              </span>
            </button>
            <div id="filter-panel" className={`border-t border-slate-200 ${filtersOpen ? "block" : "hidden"} lg:block`}>
              {filterPanel}
            </div>
          </aside>

          <div className="min-w-0 space-y-4">
            <TimeSeriesChart data={exceptDate} selectedRange={dateNarrowed ? filters.dateRange : null} onClickTime={onTimeClick} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <CountryChart
                data={exceptCountry}
                selected={filters.countries}
                onClickCountry={(c) => setFilters((f) => ({ ...f, countries: toggle(f.countries, c) }))}
              />
              <PaymentMethodChart
                data={exceptMethod}
                selected={filters.paymentMethods}
                onClickMethod={(m) => setFilters((f) => ({ ...f, paymentMethods: toggle(f.paymentMethods, m) }))}
              />
              <AmountChart
                data={exceptAmount}
                selected={currentBucket ? bucketKey(currentBucket) : null}
                onClickBucket={onBucketClick}
              />
            </div>
          </div>
        </div>

        <TransactionTable data={filtered} onSelect={setSelected} selectedId={selected?.id ?? null} />

        <footer className="pb-6 pt-2 text-center text-[11px] text-slate-400">
          Risk score: IP country differs +40, chargeback +25, over $400 +15, proton.me email +10, card +5, electronics +5.
        </footer>
      </main>

      <TransactionDetail
        transaction={selected}
        onClose={closeDetail}
        allTransactions={allData}
        onSelectRelated={setSelected}
      />
    </div>
  );
}
