# Transaction Pattern Explorer

A frontend-only fraud analytics dashboard that helps risk analysts visually identify fraud patterns from suspicious transactions.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Regenerate Test Data

```bash
node scripts/generate-data.js
```

This generates 900 transactions in `public/transactions.json` with an embedded fraud pattern.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or push to GitHub and import at [vercel.com/new](https://vercel.com/new).

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Recharts
- date-fns

## Features

- **Multi-dimensional filtering**: Country, payment method, status, amount range, date range, text search, high-risk toggle
- **4 interactive charts**: Time series, country distribution, payment method, amount histogram
- **Chart-click filtering**: Click any chart segment to filter the entire dashboard instantly
- **Suspicious Patterns Panel**: rule-based pattern flags (fixed thresholds) for chargeback clusters, IP mismatches, email velocity and high-amount outliers
- **Risk scoring**: each transaction gets a 0–100 score from 6 hand-weighted signals (see Data)
- **Sortable transaction table** with pagination, risk indicators, and CSV export
- **Slide-out detail panel** with full transaction info, IP mismatch alerts, and related transactions
- **Summary stats bar** showing chargebacks, rates, and IP mismatches

## Embedded Fraud Pattern

50 high-value chargebacks ($400–$780) from Brazil via Visa, all in a 2-hour window (Feb 24, 02:00–04:00 UTC), targeting Electronics. IP addresses originate from Nigeria, Russia, and China — a clear billing/IP country mismatch. Transactions use clustered card numbers (70xx range) and repeat from 5 suspicious email addresses. The pattern can be found by observing the time series spike, filtering by chargebacks, or using the High Risk toggle. Time to discovery has not been measured with users.

## Data

- `public/transactions.json` holds 900 **synthetic** transactions made by `scripts/generate-data.js`. No real customer data is used.
- The generator plants one fraud pattern (below). Normal rows always have an IP country equal to the billing country; planted rows never do.
- The risk score gives its largest weight (+40) to an IP/country mismatch, so it is **tuned to the planted pattern**. The High Risk toggle flags 51 rows, 50 of them planted (checked 2026-10-28). This shows the UI works; it does not show that the rules would detect real fraud.
- The score also uses chargebacks, which arrive after a payment, so it is an exploration aid, not a pre-authorisation fraud model.
- The generator uses `Math.random` without a seed, so re-running it produces different data.

## Known Issues (checked 2026-10-28)

- **Time-chart click filters the wrong hour outside UTC.** The chart labels hours in the browser's time zone, but the click handler filters that hour as UTC. In India (UTC+5:30) or Brazil, clicking the fraud spike shows 0 planted rows.
- **"Related transactions" is wrong for non-card payments.** Rows paid by PIX, Boleto, OXXO or SPEI have `cardLast4: "N/A"`, so each one lists every other non-card row (379) as related.
- **Payment methods by country.** The generator gives Colombia PIX and Boleto, which are Brazilian methods, and picks merchants at random, so customers and merchants are often in different countries. All amounts are in USD.

## Tests

There are no automated tests yet. `npm run lint` and `npm run build` pass.
