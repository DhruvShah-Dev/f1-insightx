# Deployment

## Target Stack

- Next.js App Router on Vercel
- Supabase for auth, profile, and database-backed surfaces
- Offline Python builders for FastF1, Strategy Lab, and Analytics product views

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

If Analytics or Strategy Lab needs bundled CSV/JSON artifacts in production, generate them before packaging:

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python build_telemetry_features.py --start-season 2020 --end-season 2026
python data/build_strategy_lab_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python build_product_manifest.py
python validate_product_manifest.py
python check_generated_artifacts.py
```

For normal GitHub syncs, keep large generated outputs ignored and publish them through an explicit artifact process if deployment needs them.

## Runtime Boundaries

- API routes should read product views only.
- Analytics detail modes should use session-scoped indexed shards.
- Raw telemetry processing belongs in offline Python builders.
- Energy deployment is a proxy, not true battery or ERS telemetry.
- Segment IDs are approximate until manually refined circuit maps exist.

## Release Checks

```bash
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

## Privacy Baseline

The app ships legal/privacy/cookie surfaces and Supabase session cookies. Before public launch, confirm the privacy contact address, data retention behavior, and any analytics or monitoring additions match the published policy.
