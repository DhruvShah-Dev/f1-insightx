# F1 InsightX

F1 InsightX is a production-minded Formula 1 analytics platform built with Next.js, Supabase, and Python data pipelines. It combines race-week context, deterministic strategy simulation, fantasy inputs, and telemetry-derived analytics without using machine learning in the simulation path.

## Product Surfaces

- `Race Week`: upcoming and recent race context, schedule state, and race-specific product views.
- `Strategy Lab`: deterministic lap/stint strategy simulation using tyre degradation, pit loss, weather, traffic, fuel correction, telemetry-derived strategy signals, track archetypes, and confidence scoring.
- `Analytics`: driver-vs-driver telemetry feature comparisons using precomputed product views and session-scoped indexed shards.
- `Fantasy Builder`: fantasy-oriented driver and constructor inputs from curated race-week and prediction views.
- `Account/Profile`: Supabase-backed authentication, profile surfaces, and legal/privacy/cookie pages.

## Data Architecture

The web app reads compact product views. It does not read raw FastF1 telemetry at runtime.

1. `data/raw/fastf1`: generated FastF1 archive, manifests, failed-session logs, cache-adjacent artifacts.
2. `data/staged/fastf1`: generated per-session CSV extracts.
3. `data/canonical_fastf1`: generated canonical FastF1 tables with manifest gating and weather propagation.
4. `data/telemetry_features`: generated telemetry-derived lap, segment, braking, throttle, straight-line, and energy deployment proxy features.
5. `data/strategy_lab`: Strategy Lab product views and deterministic simulation inputs.
6. `data/analytics`: generated Analytics product views and indexed session shards.
7. Supabase: auth/profile and deployable database-backed surfaces where configured.

## Local Setup

```bash
npm install
npm run data:install
```

Create `.env.local` from `.env.example` if you need Supabase-backed auth/profile flows. Never commit real `.env*` files.

## Development

```bash
npm run dev
npm run test --workspace web
npm run typecheck
npm run lint --workspace web
npm run build --workspace web
```

## Data Commands

Canonical FastF1:

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py
```

Telemetry features:

```bash
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
```

Strategy Lab:

```bash
python data/build_strategy_lab_layers.py
```

Analytics product views and session indexes:

```bash
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python validate_analytics_views.py
```

Product freshness manifest:

```bash
python build_product_manifest.py
python validate_product_manifest.py
```

Full local product refresh order:

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
python data/build_strategy_lab_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python validate_analytics_views.py
python build_product_manifest.py
python validate_product_manifest.py
python check_generated_artifacts.py
```

Python tests:

```bash
python -m pytest tests/test_analytics_views.py tests/test_telemetry_features.py
```

## Data Artifact Policy

Commit source scripts, SQL, docs, tests, and intentionally small product fixtures. Do not commit raw FastF1 archives, cache data, parquet telemetry, canonical CSVs, telemetry feature CSVs, or large Analytics product/index outputs unless there is an explicit release reason.

Generated artifacts are ignored and should be regenerated with the commands above.

## Product Honesty

- Energy deployment is a proxy derived from speed, throttle, RPM, gear, DRS, and segment behavior. It is not true ERS or battery telemetry.
- Analytics uses approximate segment identifiers. It does not claim exact named-corner precision yet.
- Strategy Lab returns finish bands, gain/loss ranges, confidence, weakest assumptions, and sensitivity drivers. It should not be presented as exact race prediction.

## Deployment Notes

The web app is intended for Vercel with Next.js App Router. Supabase variables are required for deployed auth/profile flows:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`

If generated CSV product views are required in a deployment, regenerate them before packaging or publish them through an explicit artifact/data release process. Keep raw telemetry and cache artifacts out of the deployment bundle.

More detail:

- [Development](docs/DEVELOPMENT.md)
- [Data Pipeline](docs/DATA_PIPELINE.md)
- [Strategy Lab](docs/STRATEGY_LAB.md)
- [Analytics](docs/ANALYTICS.md)
- [Deployment](docs/deployment.md)
