"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Transaction, Filters } from "@/lib/types";
import { loadTransactions, getUniqueValues, getAmountRange, getDateRange } from "@/lib/data";
import { applyFilters, computeRiskScore } from "@/lib/utils";
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
};

export default function Dashboard() {
  const [allData, setAllData] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [amountBounds, setAmountBounds] = useState<[number, number]>([0, 1000]);
  const [dateBounds, setDateBounds] = useState<[string, string]>(["", ""]);
  const [countries, setCountries] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  useEffect(() => {
    loadTransactions()
      .then((data) => {
        const enriched = data.map((t) => ({ ...t, riskScore: computeRiskScore(t) }));
        setAllData(enriched);
        const ab = getAmountRange(enriched);
        const db = getDateRange(enriched);
        setAmountBounds(ab);
        setDateBounds(db);
        setCountries(getUniqueValues(enriched, "country"));
        setPaymentMethods(getUniqueValues(enriched, "paymentMethod"));
        setStatuses(getUniqueValues(enriched, "status"));
        setFilters({ ...defaultFilters, amountRange: ab, dateRange: db });
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load transaction data.");
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => applyFilters(allData, filters), [allData, filters]);

  const resetFilters = useCallback(() =>
    setFilters({ ...defaultFilters, amountRange: amountBounds, dateRange: dateBounds }),
    [amountBounds, dateBounds]
  );

  const handleCountryClick = (country: string) => {
    setFilters((f) => ({
      ...f,
      countries: f.countries.includes(country)
        ? f.countries.filter((c) => c !== country)
        : [...f.countries, country],
    }));
  };

  const handleMethodClick = (method: string) => {
    setFilters((f) => ({
      ...f,
      paymentMethods: f.paymentMethods.includes(method)
        ? f.paymentMethods.filter((m) => m !== method)
        : [...f.paymentMethods, method],
    }));
  };

  const handleTimeClick = (hourLabel: string) => {
    const parts = hourLabel.match(/(\w+) (\d+) (\d+):00/);
    if (!parts) return;
    const monthMap: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
      Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const month = monthMap[parts[1]] || "01";
    const day = parts[2].padStart(2, "0");
    const hour = parts[3].padStart(2, "0");
    const dateStr = `2026-${month}-${day}`;
    setFilters((f) => ({
      ...f,
      dateRange: [`${dateStr}T${hour}:00:00.000Z`, `${dateStr}T${hour}:59:59.999Z`],
    }));
  };

  // Active filter tags for display
  const activeFilterTags: { label: string; onRemove: () => void }[] = [];
  filters.countries.forEach((c) =>
    activeFilterTags.push({
      label: c,
      onRemove: () => setFilters((f) => ({ ...f, countries: f.countries.filter((x) => x !== c) })),
    })
  );
  filters.paymentMethods.forEach((m) =>
    activeFilterTags.push({
      label: m,
      onRemove: () => setFilters((f) => ({ ...f, paymentMethods: f.paymentMethods.filter((x) => x !== m) })),
    })
  );
  filters.statuses.forEach((s) =>
    activeFilterTags.push({
      label: s,
      onRemove: () => setFilters((f) => ({ ...f, statuses: f.statuses.filter((x) => x !== s) })),
    })
  );
  if (filters.highRiskOnly) {
    activeFilterTags.push({
      label: "High Risk Only",
      onRemove: () => setFilters((f) => ({ ...f, highRiskOnly: false })),
    });
  }
  if (filters.searchQuery) {
    activeFilterTags.push({
      label: `"${filters.searchQuery}"`,
      onRemove: () => setFilters((f) => ({ ...f, searchQuery: "" })),
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Loading transaction data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-sm text-center shadow-sm">
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-3 text-xs text-red-600 underline">
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Transaction Pattern Explorer
              </h1>
              <p className="text-[11px] text-slate-400 font-medium tracking-wide uppercase">
                Risk Analytics
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 tabular-nums">
              Showing <span className="font-semibold text-slate-600">{filtered.length}</span> of {allData.length}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1440px] mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <StatsBar data={filtered} />

        {/* Active filter tags */}
        {activeFilterTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Active:</span>
            {activeFilterTags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100"
              >
                {tag.label}
                <button
                  onClick={tag.onRemove}
                  className="ml-0.5 w-4 h-4 rounded-full hover:bg-indigo-200 flex items-center justify-center text-indigo-400 hover:text-indigo-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </span>
            ))}
            <button
              onClick={resetFilters}
              className="text-[11px] text-slate-400 hover:text-slate-600 font-medium underline underline-offset-2"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Filters + Charts */}
        <div className="flex gap-6">
          <div className="w-[260px] shrink-0">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              countries={countries}
              paymentMethods={paymentMethods}
              statuses={statuses}
              amountBounds={amountBounds}
              dateBounds={dateBounds}
              onReset={resetFilters}
            />
          </div>
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TimeSeriesChart data={filtered} onClickTime={handleTimeClick} />
            <CountryChart data={filtered} onClickCountry={handleCountryClick} />
            <PaymentMethodChart data={filtered} onClickMethod={handleMethodClick} />
            <AmountChart data={filtered} />
          </div>
        </div>

        {/* Insights */}
        <InsightsPanel data={filtered} />

        {/* Table */}
        <TransactionTable data={filtered} onSelect={setSelected} />
      </main>

      {/* Detail panel */}
      <TransactionDetail
        transaction={selected}
        onClose={() => setSelected(null)}
        allTransactions={allData}
        onSelectRelated={setSelected}
      />
    </div>
  );
}
