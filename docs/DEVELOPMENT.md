# Development

## Prerequisites

- Node.js 20+
- npm 10+
- Python 3.11+ recommended for data pipeline work

## Install

```bash
npm install
npm run data:install
```

Use `.env.local` for local Supabase settings. Real environment files are ignored by git and must stay local.

## Web App

```bash
npm run dev
npm run test --workspace web
npm run typecheck
npm run lint --workspace web
npm run build --workspace web
```

The web runtime should read product views only. Raw FastF1 telemetry, parquet files, cache directories, and broad filesystem scans do not belong in API routes or client components.

## Release Readiness Checklist

Before syncing to GitHub:

```bash
git status --short
npm run test --workspace web
npm run typecheck
npm run lint --workspace web
npm run build --workspace web
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python build_product_manifest.py
python validate_product_manifest.py
python check_generated_artifacts.py
python -m pytest tests/test_analytics_views.py tests/test_telemetry_features.py
```

Review generated data before staging. Large generated CSVs and indexes should normally be regenerated, not committed.
