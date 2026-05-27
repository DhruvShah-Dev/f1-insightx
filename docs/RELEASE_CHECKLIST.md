# Release Checklist

This document is the deployment contract for F1 InsightX. It separates source
code from generated data, defines what the web runtime expects, and lists the
steps required before a Vercel preview or production promotion.

## Deployment Artifact Policy

Generated artifacts fall into four groups:

| Group | Policy | Runtime required | Rebuildable | Notes |
| --- | --- | --- | --- | --- |
| Source scripts, validators, SQL, docs, tests | Tracked | No | Yes | Commit these normally. |
| Small curated/reference CSVs | Tracked when intentional | Yes for CSV fallback | Yes | Used by Race Week, references, archive, Strategy Lab joins, and local fallback paths. |
| Small product CSVs for lightweight deploy | Tracked when intentionally small | Yes for current Race Week / Strategy Lab fallback | Yes | Current `data/race_week/*.csv` and most `data/strategy_lab/*.csv` are small enough to bundle if the release chooses CSV fallback. |
| Large generated product artifacts | Ignored | Yes for flagship surfaces unless regenerated at deploy time | Yes | Analytics global CSVs, Analytics indexed shards/traces, Race Analysis product views, canonical FastF1, telemetry features, reports. |

Do not commit raw FastF1 data, staged data, telemetry parquet/feather/arrow,
cache folders, reports, or large indexed/generated data. If production needs
those runtime artifacts, generate them during a deploy packaging step or publish
them through a deliberate artifact release process.

## Runtime Dependency Matrix

| Surface / API | Runtime dependency | Current git policy | Missing behavior |
| --- | --- | --- | --- |
| Home `/` | curated CSVs, Race Week summary, season state if present | curated small CSVs tracked; `data/season_state.json` currently untracked | falls back/degrades depending on helper |
| Race Week `/predictions`, `/raceweek`, `/api/platform/race-week` | `data/race_week/race_week_*.csv`, curated races/circuits | currently tracked small product CSVs | required CSVs missing cause product unavailability |
| Strategy Lab `/lab`, `/api/strategy-lab/races/[raceId]` | `data/strategy_lab/*.csv`, curated races/drivers/constructors/circuits | most product CSVs tracked; telemetry/archetype source signals ignored | required CSVs missing cause product unavailability |
| Analytics `/analytics`, `/api/analytics/*` | `data/analytics/analytics_session_index.csv`, `data/analytics/indexed/analytics_session_manifest.json`, session shards, optional trace shards | ignored except `.gitkeep`; CI uses tiny fixtures | hard requirement for production Analytics; traces degrade if absent |
| Race Analysis `/race-analysis`, `/race-analysis/[raceId]` | `data/race_analysis/*.csv` | ignored except `.gitkeep` | optional loader returns empty/unavailable if absent |
| Race Archive `/races/[raceId]` and reference APIs | curated CSVs or Supabase public tables | curated generated CSVs are generally ignored except intentional small tracked files | degraded if neither Supabase nor CSV fallback exists |
| Account/Profile | Supabase Auth, `user_profiles`, service-role server key for profile helpers | no generated artifact | unavailable without Supabase env/config |
| Supabase heartbeat `/api/health/supabase` | anon read of `public.races` | no generated artifact | returns `503` if Supabase env, grants, RLS, or data are missing |

Hard runtime requirements that are currently ignored:

- `data/analytics/analytics_session_index.csv`
- `data/analytics/indexed/analytics_session_manifest.json`
- `data/analytics/indexed/sessions/*.json.gz`
- `data/analytics/indexed/traces/analytics_trace_manifest.json` and trace shards for representative telemetry visuals
- `data/race_analysis/*.csv`
- `data/reports/product_manifest.json` if freshness validation is displayed or audited in production
- `data/season_state.json` if shared season-state defaults must be authoritative

## Tracked vs Ignored Recommendation

| Path | Recommendation | Reason |
| --- | --- | --- |
| `apps/**`, `data/*.py`, root `build_*.py`, root `validate_*.py`, `tests/**`, `docs/**`, `data/sql/**`, `supabase/migrations/**` | Track | Source, validation, migrations, and release docs. |
| `apps/web/test-fixtures/**` | Track | Required for CI-safe unit tests without large product artifacts. |
| `data/curated/*.csv` | Track only if intentionally small/current; otherwise generate | Runtime fallback uses these files. Decide per release. |
| `data/race_week/*.csv` | Track for lightweight CSV fallback if size stays small | Current product views are small and deployment-friendly. |
| `data/strategy_lab/*.csv` | Track for lightweight CSV fallback if size stays small | Current product views are small; source telemetry signal CSVs remain ignored. |
| `data/season_state.json` | Decide before release: track as small runtime manifest or deploy-generate | Runtime helper reads it. Stale or missing state changes product defaults. |
| `data/analytics/*.csv`, `data/analytics/indexed/**` | Ignore; deploy-generate or artifact-publish | Large generated flagship data. |
| `data/race_analysis/**` | Ignore; deploy-generate or artifact-publish | Generated post-race product views can grow quickly. |
| `data/reports/**` | Ignore; deploy-generate | Reports are build evidence, not source. |
| `data/raw/**`, `data/staged/**`, `data/canonical_fastf1/*.csv`, `data/telemetry_features/**` | Ignore | Heavy rebuildable pipeline artifacts. |
| `data/ml/generated/**` | Ignore | Deterministic ML datasets are rebuildable and not product runtime data. |

## Rebuild Order

Use this order when refreshing all product data locally or in a data-build job:

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py

python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py

python data/build_strategy_lab_layers.py
python data/build_race_week_layers.py

python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py

python data/build_race_analysis_views.py
python validate_race_analysis_views.py

python build_product_manifest.py
python validate_product_manifest.py

python build_season_state.py
python validate_season_state.py
```

If time or storage is constrained, do not rebuild raw/canonical/telemetry in
Vercel's regular web build. Prefer a separate data artifact job, then attach the
resulting compact runtime artifacts to the deployment.

## Season-State Refresh Order

Season-state must be generated after every product surface it summarizes:

1. Refresh curated schedule/results.
2. Rebuild Race Week for the current next race.
3. Rebuild Strategy Lab if the next race changed.
4. Rebuild Analytics if telemetry/product availability changed.
5. Rebuild Race Analysis if a completed race was added.
6. Build and validate the product manifest.
7. Build and validate season state.

Expected commands:

```bash
python build_product_manifest.py
python validate_product_manifest.py
python build_season_state.py
python validate_season_state.py
```

Before public deployment, confirm:

- latest completed scheduled race is correct for the deployment date
- latest completed race with results is honest
- latest telemetry/product race is honest
- next race is actually in the future
- warnings are visible or operationally accepted

## Vercel Deployment Flow

Recommended Vercel settings:

- Root Directory: `apps/web`
- Install Command: `npm install`
- Build Command: `npm run build`
- Node: 20+; Node 22 preferred

Required environment variables:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Deployment options:

1. **Source-only deploy with Supabase-backed public data**
   - Requires Supabase tables/views to be loaded and granted.
   - Analytics and Race Analysis still need generated file artifacts unless
     those surfaces are intentionally degraded.

2. **Bundled compact artifact deploy**
   - Generate only runtime product artifacts before packaging.
   - Include ignored Analytics indexes/traces and Race Analysis CSVs in the
     deployment artifact without committing them.
   - Keep raw/staged/canonical/telemetry source artifacts out of the bundle.

3. **Tracked lightweight fallback deploy**
   - Track small curated, Race Week, and Strategy Lab CSVs.
   - Do not track large Analytics/Race Analysis data.
   - Use only for previews where flagship surfaces may be unavailable.

## Supabase Migration and Grant Order

Apply SQL in this order:

1. `data/sql/001_core_schema.sql`
2. `data/sql/002_fastf1_pipeline.sql`
3. `data/sql/003_race_week_schema.sql`
4. `data/sql/004_strategy_lab_schema.sql`
5. `data/sql/005_backend_hardening.sql`
6. `supabase/migrations/202605270001_explicit_data_api_grants.sql`

Then verify:

- `public.races` is readable through anon for heartbeat.
- public product/reference tables are read-only for anon/authenticated.
- `user_profiles` has no anon access.
- `user_profiles` authenticated access is still constrained by RLS ownership.
- service role key exists only in server/Vercel env, never browser code.

## Heartbeat Verification

Configure GitHub repository variable:

```text
F1_INSIGHTX_HEARTBEAT_URL=https://<production-domain>/api/health/supabase
```

After deployment:

1. Open `/api/health/supabase`.
2. Confirm response contains `"ok": true` and `"source": "supabase"`.
3. Manually run the `Supabase Heartbeat` GitHub Actions workflow.
4. Confirm logs report `Supabase heartbeat OK`.

If heartbeat fails, check Supabase env vars, grants, RLS, `public.races` row
count, project pause/billing state, and production domain configuration.

## Pre-Deploy Checks

```bash
python check_generated_artifacts.py
python validate_product_manifest.py
python validate_season_state.py
npm run test --workspace web
npm run typecheck
npm run lint --workspace web
npm run build --workspace web
```

If deployment includes Analytics traces:

```bash
python validate_analytics_telemetry_traces.py
```

If deployment includes Race Analysis:

```bash
python validate_race_analysis_views.py
```

## Post-Deploy QA Flow

Check these URLs on preview and production:

- `/`
- `/analytics`
- `/race-analysis`
- `/race-analysis/2026-04-miami` or the latest available race
- `/lab`
- `/predictions`
- `/account`
- `/privacy`
- `/terms`
- `/cookies`
- `/api/health`
- `/api/health/supabase`
- `/api/analytics/sessions`
- `/api/platform/race-week`

Viewport checks:

- desktop 1440
- laptop 1280
- tablet 768
- mobile 390

Public-access QA must confirm:

- no raw telemetry runtime reads
- no true ERS/battery claims
- approximate segment wording remains visible
- Race Week, Home, Analytics, Strategy Lab, and Race Analysis agree on season state
- Google auth errors degrade cleanly and email fallback is visible
- cookie preferences do not block core navigation after a user choice
- generated artifact gaps produce intentional unavailable states

## Release Decision Gates

Do not promote production if any P0 gate fails:

- build/test/typecheck/lint fail
- generated artifact guard fails
- season state contradicts current schedule/results
- Supabase heartbeat fails with production env
- Google OAuth is suspended or misconfigured and email fallback is not working
- Analytics flagship route lacks required runtime artifacts without a deliberate degraded-state decision
