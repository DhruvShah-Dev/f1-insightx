# F1 InsightX Project Context

Last updated: September 8, 2026

## Overview

F1 InsightX is a production-minded Formula 1 intelligence product built around
race-week context, championship state, post-race analysis, driver comparisons,
and public picks. The active application is the root TanStack Start app. The
historical `apps/web` Next.js app is archived and must not receive new product
work unless it is intentionally revived.

The latest local data snapshot is current through the 2026 Italian Grand Prix
at Monza, round 13. The active race-week context points to the 2026 Spanish
Grand Prix at Madring, round 14.

## Active Product Surfaces

- `/`: Race Control home with next GP, countdown, standings pulse, and latest
  report entry.
- `/raceweek`: current race-week command center and projection board.
- `/championship`: driver and constructor standings.
- `/analysis`: completed-race report index.
- `/analysis/$slug`: completed-race report detail, including Monza at
  `/analysis/2026-13-monza`.
- `/vs`: driver-vs-driver comparison workspace.
- `/picks`: race-week picks board.
- `/method`: methodology, data quality, and product honesty notes.
- `/account`: Supabase-backed account/profile surface.

Retired route names such as `/analytics`, `/race-analysis`, `/lab`, and
`/predictions` should not be used in new UI, docs, links, or generated product
metadata.

## Technical Stack

- TanStack Start and TanStack Router for the active web application.
- React 19 and TypeScript.
- Tailwind CSS with a custom product design system.
- TanStack Query for client/server data orchestration.
- Supabase for authentication and profile persistence.
- Python data pipelines for Jolpica reference data, FastF1 session ingestion,
  OpenF1 context where available, and generated product views.
- Vercel/Lovable deployment from the repository root.

## Runtime Data Model

Public F1 product pages use the generated bundled snapshot by default. This is
intentional: Supabase public product tables can lag behind the latest local
pipeline refresh, so the app should not prefer remote public data unless it has
been explicitly refreshed and validated.

Set `F1_INSIGHTX_PUBLIC_DATA_SOURCE=supabase` only after Supabase public
product tables are current through the latest completed race.

Account and profile flows still require Supabase Auth and server-side profile
helpers.

## Source Layout

- `src/routes`: active TanStack routes.
- `src/lib/f1.functions.ts`: public F1 server-function boundary.
- `src/lib/f1.server.ts`: optional Supabase-backed public data reads.
- `src/lib/f1.fallback.ts`: bundled snapshot fallback mapping.
- `src/data`: generated root UI snapshot modules and small runtime helpers.
- `data`: offline ingestion, builders, validators, generated artifacts, and SQL.
- `docs`: operational, architecture, release, and methodology documentation.
- `apps/web`: archived Next.js UI retained for historical reference only.

## Current Data State

- Season: 2026.
- Latest completed race: round 13, Italian Grand Prix, Monza,
  2026-09-06.
- Next race: round 14, Spanish Grand Prix, Madring, 2026-09-13.
- Driver standings leader: Kimi Antonelli, 267 points.
- Constructor standings leader: Mercedes, 468 points.
- Race Analysis reports available: 13.
- Telemetry and analytics product views include Monza FP1, FP2, FP3,
  qualifying, and race sessions.

## Data Pipeline

Recommended full refresh order:

```bash
python data/fetch_reference_data.py --start-season 2026 --end-season 2026
python data/normalize_results.py
python data/build_product_views.py
python data/fastf1_ingest.py --season 2026 --round 13 --sessions FP1 FP2 FP3 Q R --include-telemetry --only-missing --sleep-seconds 2
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python build_telemetry_features.py --start-season 2020 --end-season 2026
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python data/build_race_analysis_views.py
python data/build_race_week_layers.py
python data/build_strategy_lab_layers.py
python build_product_manifest.py
python build_season_state.py
python build_product_manifest.py
```

Recommended validation set:

```bash
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python validate_race_analysis_views.py
python validate_season_state.py
python validate_product_manifest.py
npx tsc --noEmit
npm run lint
npm run build
```

## Product Honesty Rules

- Do not claim exact overtakes, incident causes, or race-control causes when
  the local source is only lap-position or track-status based.
- Label energy deployment as a proxy unless true ERS/battery data exists.
- Preserve confidence and weakest-assumption fields in user-facing analysis.
- Prefer explicit unavailable states over invented precision.
- Keep runtime payloads bounded; raw telemetry and heavy staging artifacts must
  stay out of request handling.

## Handoff Notes

- The root app should run locally with `npm run dev`; the expected active local
  URL is `http://127.0.0.1:8080` when that port is available.
- `apps/web` package scripts intentionally fail with an archive message.
- The Lovable-connected git history should not be rewritten; avoid force pushes,
  rebases, squash/amend of pushed commits, or other history rewrites.
- Before deploying, confirm the bundled snapshot and any optional Supabase
  public product tables agree on latest completed race and next race.
