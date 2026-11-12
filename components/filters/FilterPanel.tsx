"use client";

import { Filters } from "@/lib/types";
import { localDay, localDayEnd, localDayStart } from "@/lib/utils";

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  countries: string[];
  paymentMethods: string[];
  statuses: string[];
  amountBounds: [number, number];
  dateBounds: [string, string];
  onReset: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
      {children}
    </label>
  );
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
              selected.includes(opt)
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-slate-100 my-1" />;
}

export default function FilterPanel({
  filters,
  onChange,
  countries,
  paymentMethods,
  statuses,
  amountBounds,
  dateBounds,
  onReset,
}: FilterPanelProps) {
  const update = (partial: Partial<Filters>) =>
    onChange({ ...filters, ...partial });

  const activeCount =
    filters.countries.length +
    filters.paymentMethods.length +
    filters.statuses.length +
    (filters.amountRange[0] > amountBounds[0] || filters.amountRange[1] < amountBounds[1] ? 1 : 0) +
    (filters.dateRange[0] > dateBounds[0] || filters.dateRange[1] < dateBounds[1] ? 1 : 0) +
    (filters.searchQuery ? 1 : 0) +
    (filters.highRiskOnly ? 1 : 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm h-fit sticky top-20">
      <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
        {activeCount > 0 && (
          <button
            onClick={onReset}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Reset ({activeCount})
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div>
          <SectionLabel>Search</SectionLabel>
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              placeholder="Email, ID, card..."
              value={filters.searchQuery}
              onChange={(e) => update({ searchQuery: e.target.value })}
              className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
        </div>

        {/* High Risk Toggle */}
        <button
          onClick={() => update({ highRiskOnly: !filters.highRiskOnly })}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border-2 transition-all ${
            filters.highRiskOnly
              ? "bg-red-600 text-white border-red-600 shadow-sm shadow-red-200"
              : "bg-white text-red-500 border-red-200 hover:border-red-400 hover:bg-red-50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          High Risk Only
        </button>

        <Divider />

        <MultiSelect
          label="Country"
          options={countries}
          selected={filters.countries}
          onChange={(countries) => update({ countries })}
        />

        <Divider />

        <MultiSelect
          label="Payment Method"
          options={paymentMethods}
          selected={filters.paymentMethods}
          onChange={(paymentMethods) => update({ paymentMethods })}
        />

        <Divider />

        <MultiSelect
          label="Status"
          options={statuses}
          selected={filters.statuses}
          onChange={(statuses) => update({ statuses })}
        />

        <Divider />

        <div>
          <SectionLabel>Amount Range (USD)</SectionLabel>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min={amountBounds[0]}
              max={filters.amountRange[1]}
              value={filters.amountRange[0]}
              onChange={(e) =>
                update({ amountRange: [Number(e.target.value), filters.amountRange[1]] })
              }
              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <span className="text-slate-300 text-xs font-medium">—</span>
            <input
              type="number"
              min={filters.amountRange[0]}
              max={amountBounds[1]}
              value={filters.amountRange[1]}
              onChange={(e) =>
                update({ amountRange: [filters.amountRange[0], Number(e.target.value)] })
              }
              className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
        </div>

        <Divider />

        <div>
          <SectionLabel>Date Range</SectionLabel>
          <div className="space-y-2">
            <input
              type="date"
              value={localDay(filters.dateRange[0])}
              onChange={(e) =>
                update({ dateRange: [e.target.value ? localDayStart(e.target.value) : dateBounds[0], filters.dateRange[1]] })
              }
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
            <input
              type="date"
              value={localDay(filters.dateRange[1])}
              onChange={(e) =>
                update({ dateRange: [filters.dateRange[0], e.target.value ? localDayEnd(e.target.value) : dateBounds[1]] })
              }
              className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
