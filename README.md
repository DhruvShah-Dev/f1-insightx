# F1 InsightX

F1 InsightX is a race-intelligence product for Formula 1 analysis, predictions, telemetry comparison, and fan decision workflows. The project is operated like an early-stage startup product: every screen should help users understand a race weekend faster, every dataset should be traceable, and every shipped change should improve trust in the product.

This is not a portfolio demo. Treat the app, pipeline, docs, and database as production assets for a real customer-facing company.

## Product Thesis

F1 data is rich but scattered across timing feeds, session telemetry, historical results, weather, strategy signals, and race-control context. F1 InsightX turns that raw material into usable race-week intelligence:

- race-week context, weather, circuit profile, and session timing
- qualifying, sprint, and race predictions built from validated inputs
- driver-vs-driver telemetry comparisons
- post-race analysis and reports
- account-backed picks with lock rules and scoring
- data-quality caveats where evidence is partial or derived

## Current App

The active product is a TanStack Start application in the repository root. The historical `apps/web` Next.js app is archived and should not receive new product work unless intentionally revived.

Primary routes:

- `/` - product home and race-week entry
- `/raceweek` - next-race operating view
- `/analysis` - race reports and post-race intelligence
- `/vs` - driver comparison and telemetry views
- `/picks` - account-backed pick cards and scoring
- `/account` - Google sign-in and signed-in profile

## Engineering Standards

- Prefer user-facing product behavior over decorative demo work.
- Keep all race claims tied to stored source data, deterministic derivations, or clearly labelled proxies.
- Do not expose service-role keys, database URLs, OAuth secrets, or raw telemetry payloads to browser code.
- Use Supabase for product data and compact views; keep raw/session-heavy archives in the data pipeline.
- Preserve Lovable history. Do not rewrite published git history.
- Run `npm.cmd run lint` and `npm.cmd run build` before pushing product changes.

## Local Development

Requirements:

- Node.js and npm
- Python for data pipeline work
- Supabase environment variables for live product reads

```sh
npm i
npm run dev
```

Local dev server:

```text
http://127.0.0.1:8080
```

Production checks:

```sh
npm.cmd run lint
npm.cmd run build
```

## Data Platform

The product is backed by a deterministic local data platform under `data/` and `data_pipeline/`.

Core inputs:

- Jolpica/reference race data
- OpenF1 session and race-control-adjacent data
- FastF1 timing, laps, stints, weather, telemetry, and position traces
- Supabase product tables and views

Core outputs:

- race-week product views
- analytics and telemetry comparison indexes
- race-analysis reports
- strategy and prediction snapshots
- Pit Wall Picks challenges and result scoring inputs

See [data/README.md](data/README.md) and [data_pipeline/README.md](data_pipeline/README.md) before changing pipeline behavior.

## Deployment Posture

This repository is connected to Lovable. Commits pushed to `main` sync back into the Lovable editor. Keep `main` shippable.

Before shipping:

- confirm the app builds
- confirm changed routes load locally
- confirm Supabase reads still have fallback behavior
- document any data freshness limitation in product copy or docs

## Built With

- TanStack Start
- React
- TypeScript
- Tailwind CSS
- Supabase
- FastF1 / OpenF1 / Jolpica data workflows
