"use client";

import { useEffect, useState } from "react";
import { Filters } from "@/lib/types";
import { amountFromInput, localDay, localDayEnd, localDayStart } from "@/lib/utils";

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  countries: string[];
  paymentMethods: string[];
  statuses: string[];
  amountBounds: [number, number];
  dateBounds: [string, string];
}

const inputCls =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 tabular-nums placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20";

/**
 * A number box that keeps what the user typed. The filter gets the parsed
 * amount, and an empty box means no limit (the bound shows as a placeholder),
 * so clearing the box to type a new amount does not filter everything out.
 */
function AmountInput({
  label,
  value,
  bound,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  bound: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  // A chart click, a removed chip or "Reset" changes the value from outside.
  useEffect(() => {
    if (amountFromInput(text, bound) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, bound]);
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={min}
      max={max}
      placeholder={String(bound)}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(amountFromInput(e.target.value, bound));
      }}
      className={inputCls}
    />
  );
}

function Group({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="eyebrow block">
          {label}
        </label>
      ) : (
        <p className="eyebrow">{label}</p>
      )}
      {children}
    </div>
  );
}

function Chips({
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
  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  return (
    <Group label={label}>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(opt)}
              className={`rounded-md border px-2 py-1 text-xs font-medium capitalize transition-colors ${
                on
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </Group>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-red-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export default function FilterPanel({
  filters,
  onChange,
  countries,
  paymentMethods,
  statuses,
  amountBounds,
  dateBounds,
}: FilterPanelProps) {
  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <div className="space-y-5 p-4">
      <Group label="Search" htmlFor="search">
        <input
          id="search"
          type="search"
          placeholder="Email, ID, card BIN or last 4…"
          value={filters.searchQuery}
          onChange={(e) => update({ searchQuery: e.target.value })}
          className={inputCls}
        />
      </Group>

      <div className="space-y-3 rounded-lg bg-slate-50 p-3">
        <Toggle
          label="High risk only"
          hint="Risk score 70 or more"
          checked={filters.highRiskOnly}
          onChange={(v) => update({ highRiskOnly: v })}
        />
        <Toggle
          label="IP ≠ billing country"
          hint="IP address in another country"
          checked={filters.ipMismatchOnly}
          onChange={(v) => update({ ipMismatchOnly: v })}
        />
      </div>

      <Chips label="Status" options={statuses} selected={filters.statuses} onChange={(statuses) => update({ statuses })} />
      <Chips
        label="Country"
        options={countries}
        selected={filters.countries}
        onChange={(countries) => update({ countries })}
      />
      <Chips
        label="Payment method"
        options={paymentMethods}
        selected={filters.paymentMethods}
        onChange={(paymentMethods) => update({ paymentMethods })}
      />

      <Group label="Amount (USD)">
        <div className="flex items-center gap-2">
          <AmountInput
            label="Minimum amount"
            value={filters.amountRange[0]}
            bound={amountBounds[0]}
            min={amountBounds[0]}
            max={filters.amountRange[1]}
            onChange={(lo) => update({ amountRange: [lo, filters.amountRange[1]] })}
          />
          <span className="text-slate-400">–</span>
          <AmountInput
            label="Maximum amount"
            value={filters.amountRange[1]}
            bound={amountBounds[1]}
            min={filters.amountRange[0]}
            max={amountBounds[1]}
            onChange={(hi) => update({ amountRange: [filters.amountRange[0], hi] })}
          />
        </div>
      </Group>

      <Group label="Dates (your time zone)">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <input
            type="date"
            aria-label="From date"
            value={localDay(filters.dateRange[0])}
            onChange={(e) =>
              update({
                dateRange: [e.target.value ? localDayStart(e.target.value) : dateBounds[0], filters.dateRange[1]],
              })
            }
            className={inputCls}
          />
          <input
            type="date"
            aria-label="To date"
            value={localDay(filters.dateRange[1])}
            onChange={(e) =>
              update({
                dateRange: [filters.dateRange[0], e.target.value ? localDayEnd(e.target.value) : dateBounds[1]],
              })
            }
            className={inputCls}
          />
        </div>
      </Group>
    </div>
  );
}
