# Deployment

## Target stack

- `Frontend + API routes`: Vercel Hobby
- `Database`: Supabase Free
- `Scheduled data refresh`: GitHub Actions

This keeps the app inexpensive to run while preserving a realistic production shape for demos and portfolio use.

## Vercel setup

### Recommended project configuration

Create a Vercel project from this repository and set:

- `Framework Preset`: Next.js
- `Root Directory`: `apps/web`
- `Build Command`: leave default for Next.js
- `Install Command`: leave default or `npm install`

### Required environment variables

Set these in the Vercel project:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` is only used server-side in route handlers.
- `DATABASE_URL` is not required on Vercel because the deployed app uses the Supabase HTTP client, not direct Postgres connections.

## Supabase setup

### Initial database bootstrapping

1. Create a Supabase project on the free plan.
2. Copy the pooled connection string into local `.env.local` as `DATABASE_URL`.
3. Run:

```bash
python data/fetch_reference_data.py --start-season 2024 --end-season 2025
python data/normalize_results.py
python data/load_supabase.py
```

### Recommended Supabase environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## GitHub Actions setup

The repo includes:

- [CI workflow](../.github/workflows/ci.yml)
- [Data refresh workflow](../.github/workflows/data-refresh.yml)

### Repository secrets

Add these GitHub repository secrets:

- `DATABASE_URL`
- `JOLPICA_BASE_URL` optional if overriding the default

The scheduled refresh workflow will:

1. fetch fresh reference data
2. normalize curated outputs
3. load them into Supabase

## Local fallback mode

If Supabase env vars are missing, the app can still run locally against `data/curated/*.csv`.

That is useful for:

- local UI work
- demoing the UI without a live DB
- development before the first Supabase bootstrap

## Recommended release flow

1. Run local checks:

```bash
npm run lint
npm run build
```

2. Push to GitHub.
3. Let GitHub Actions run CI.
4. Merge to `main`.
5. Vercel deploys automatically.
6. Trigger `Data Refresh` manually the first time, then rely on the schedule.

## Free-tier tradeoffs

- Vercel Hobby is fine for a portfolio app, but function limits still apply.
- Supabase Free can pause inactive projects, so keep the project in occasional use.
- GitHub Actions scheduled jobs are reliable enough for this use case, but not a substitute for full production orchestration.
