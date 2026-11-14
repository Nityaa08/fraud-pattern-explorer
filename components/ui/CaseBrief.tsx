"use client";

import { useState } from "react";
import { pct, RuleScore } from "@/lib/scorecard";

interface Props {
  /** Rule scores against the planted attack; empty until the answer key loads. */
  scores: RuleScore[];
  plantedCount: number;
  /** Step 1: apply the burst pattern. Undefined if no burst is detected. */
  onShowAttack?: () => void;
  /** Step 2: open the highest-risk row in the current view. */
  onOpenRiskiest: () => void;
  onReset: () => void;
}

const STACK = ["Next.js 14", "TypeScript", "Recharts", "Tailwind", "Vitest", "GitHub Actions"];

/**
 * The first thing on the page: what this is, what to click, and whether the
 * rules work, for someone who has a minute to look.
 */
export default function CaseBrief({ scores, plantedCount, onShowAttack, onOpenRiskiest, onReset }: Props) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-xs text-slate-300">
        <span>
          <span className="font-semibold text-white">Case file:</span> one attack planted in 900 transactions.
        </span>
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-white underline underline-offset-2">
          Show the 60-second tour
        </button>
      </div>
    );
  }

  const steps = [
    { n: 1, label: "Show the attack", hint: "applies the top pattern", onClick: onShowAttack },
    { n: 2, label: "Open the riskiest row", hint: "see why it scored high", onClick: onOpenRiskiest },
    { n: 3, label: "Reset", hint: "back to all 900", onClick: onReset },
  ];

  return (
    <section
      aria-labelledby="brief-heading"
      className="relative overflow-hidden rounded-2xl bg-slate-900 text-slate-300"
    >
      {/* faint grid, like an analyst's console */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-10">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-red-400">
              Case file · the 60-second version
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-slate-400 underline-offset-2 hover:text-white hover:underline"
            >
              Hide
            </button>
          </div>
          <h2 id="brief-heading" className="mt-2 text-xl font-semibold leading-snug tracking-tight text-white sm:text-2xl">
            An attack is hidden in 900 card payments.
            <br className="hidden sm:block" /> The dashboard finds it in one click.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed">
            A fraud dashboard for risk analysts. Fixed rules flag suspicious patterns, every chart is also a filter, and
            each row explains its own risk score. The data is synthetic with one planted attack, so you can check below
            whether the rules really find it.
          </p>

          <ol className="mt-5 grid gap-2 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n}>
                <button
                  type="button"
                  onClick={s.onClick}
                  disabled={!s.onClick}
                  className="group flex w-full items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-left transition-colors hover:border-red-400/60 hover:bg-slate-800 disabled:opacity-50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-red-500 text-xs font-semibold text-white">
                    {s.n}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-white">{s.label}</span>
                    <span className="block text-[11px] text-slate-400">{s.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Built with">
            {STACK.map((s) => (
              <li key={s} className="rounded-full border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-300">
                {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Do the rules find it?</p>
          <p className="mt-1 text-xs text-slate-400">
            Scored against an answer key of the {plantedCount || 50} planted rows that the rules never see.
          </p>
          {scores.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">Loading the answer key…</p>
          ) : (
            <table className="mt-3 w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="pb-1.5 font-medium">Rule</th>
                  <th className="pb-1.5 text-right font-medium">Flags</th>
                  <th className="pb-1.5 text-right font-medium" title="When the rule fires, how often it is right">
                    Precision
                  </th>
                  <th className="pb-1.5 pl-3 font-medium" title="How much of the attack the rule finds">
                    Recall
                  </th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id} className="border-t border-slate-800">
                    <td className="py-1.5 pr-2 text-slate-200">{s.name}</td>
                    <td className="py-1.5 text-right">{s.flagged}</td>
                    <td className="py-1.5 text-right">{pct(s.precision)}</td>
                    <td className="py-1.5 pl-3">
                      <span className="flex items-center gap-2">
                        <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-slate-800 sm:block" aria-hidden>
                          <span
                            className={`block h-full rounded-full ${s.recall >= 0.9 ? "bg-red-500" : "bg-amber-500"}`}
                            style={{ width: pct(s.recall) }}
                          />
                        </span>
                        {pct(s.recall)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Honest caveat: generated data is cleaner than real traffic, so most rules score near 100% here. The
            high-amount rule is precise but finds under half the attack, which is why the patterns are combined.
          </p>
        </div>
      </div>
    </section>
  );
}
