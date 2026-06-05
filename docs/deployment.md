# Deployment

## Target Stack

- Next.js App Router on Vercel
- Supabase for auth, profile, and database-backed surfaces
- Offline Python builders for FastF1, Race Week, Strategy Lab, Analytics, representative telemetry traces, and Race Analysis product views

## Vercel Setup

Recommended project settings:

- `Framework Preset`: Next.js
- `Root Directory`: `apps/web`
- `Install Command`: `npm install`
- `Build Command`: `npm run build`

Required environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` must remain server-side only.

## Generated Data Expectations

The app is designed to consume compact product views. Raw FastF1 data, staged data, cache files, and telemetry parquet should never be deployed.

If Analytics, Strategy Lab, Race Week, or Race Analysis needs bundled CSV/JSON artifacts in production, generate them before packaging:

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python build_telemetry_features.py --start-season 2020 --end-season 2026
python data/build_strategy_lab_layers.py
python data/build_race_week_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python data/build_race_analysis_views.py
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python validate_race_analysis_views.py
python build_product_manifest.py
python validate_product_manifest.py
python build_season_state.py
python validate_season_state.py
python check_generated_artifacts.py
```

For normal GitHub syncs, keep large generated outputs ignored and publish them through an explicit artifact process if deployment needs them.

## Runtime Boundaries

- API routes should read product views only.
- Analytics detail modes should use session-scoped indexed shards.
- Analytics representative traces should come from offline trace artifacts only.
- Raw telemetry processing belongs in offline Python builders.
- Energy deployment is a proxy, not true battery or ERS telemetry.
- Segment IDs are approximate until manually refined circuit maps exist.
- Same-team Analytics comparison colors are visual aids and do not change source-derived constructor labels.

## Supabase Heartbeat

Free-tier Supabase projects can pause after inactivity. The repo includes a lightweight scheduled heartbeat in `.github/workflows/supabase-heartbeat.yml`.

Configure the GitHub repository variable:

```text
F1_INSIGHTX_HEARTBEAT_URL=https://<production-domain>/api/health/supabase
```

The endpoint performs one anon-key read against `public.races` and does not touch heavyweight product routes. See `docs/SUPABASE_HEARTBEAT.md`.

## Release Checks

```bash
npm run test --workspace web
npm run typecheck
npm run lint --workspace web
npm run build --workspace web
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python build_product_manifest.py
python validate_product_manifest.py
python validate_season_state.py
python check_generated_artifacts.py
python -m pytest tests/test_analytics_views.py tests/test_telemetry_features.py
```

## Privacy Baseline

The app ships legal/privacy/cookie surfaces and Supabase session cookies. Before public launch, confirm the privacy contact address, data retention behavior, and any analytics or monitoring additions match the published policy.
