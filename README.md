# F1 InsightX

**Premium F1 telemetry and race intelligence.**

F1 InsightX turns deterministic FastF1, OpenF1, and reference-data pipelines into focused race-week, picks, strategy, championship, and post-race product experiences. The Next.js application reads compact offline-generated product views and indexed shards; it does not parse raw telemetry at runtime.

## Product Preview

Screenshots were refreshed from the local Next.js app on July 14, 2026.

### Home - Race Intelligence Overview

First-screen race command view with the next race, product navigation, and season context for the active Formula 1 weekend.

![F1 InsightX home race intelligence overview](docs/assets/screenshots/home.webp)

### Race Analysis - Post-Race Intelligence

Cinematic completed-race reports built from observed results and deterministic pace, stint, strategy, weather, track-status, traffic-proxy, and position-movement views.

![F1 InsightX Race Analysis report](docs/assets/screenshots/race-analysis.webp)

### Race Week - Weekend Command Center

Upcoming-race context, circuit features, conditions, and generated race-week signals for the Belgian Grand Prix without inventing unavailable session data.

![F1 InsightX Race Week command center](docs/assets/screenshots/race-week.webp)

### Championship - Season Control

Driver, constructor, and race-derived season records with historical year switching and team-aware visual context.

![F1 InsightX Championship standings](docs/assets/screenshots/championship.webp)

## Product Surfaces

- **Home**: next-race overview, circuit preview, race history, and standings entry points.
- **Race Analysis**: completed-race story, strategy, pace evolution, weather, track-status, traffic-proxy, and position-movement views.
- **Race Week**: current weekend context, schedule, conditions, circuit metadata, and qualifying prediction signals.
- **Picks**: authenticated Pit Wall Picks entries, lock windows, race scoring, and leaderboards.
- **Strategy Lab**: deterministic stint and race-strategy simulation with explicit assumptions and sensitivity drivers.
- **Championship**: driver standings, constructor standings, historical season switching, and achievement-style leaderboards.
- **Account/Profile**: Supabase-backed authentication, profile, privacy, and account-management flows.

Analytics remains an underlying telemetry product layer and data source. The public `/analytics` route currently redirects to `/race-analysis`, so it is not presented as a primary README screenshot surface.

Fantasy remains available as API-backed optimization logic and generated data, but it is not a primary README screenshot surface.

## Latest Data Snapshot

The latest local season state is `season_state_20260709T162227Z`, generated at `2026-07-09T16:22:27Z`, with validation status `passed` across the current product layers listed below.

| Surface | Current evidence |
| --- | --- |
| Canonical FastF1 | 369,010 laps, 13,569 results, 48,188 stints, 13,368 session-summary rows, 77 drivers |
| FastF1 archive | 674 completed sessions out of 698 targets; telemetry files present for 663 sessions |
| Telemetry features | `telemetry_features_20260628T134108Z`; validation passed |
| Analytics layer | 663 indexed sessions; `analytics_views_20260709T161249Z`; validation passed |
| Race Analysis | 54 race analyses, 60,841 position timeline rows, 1,879 pit-strategy rows |
| Race Week | Belgian Grand Prix, round 10, scheduled `2026-07-19T13:00:00Z`; race-week product view available |
| Strategy Lab | Belgian Grand Prix strategy product available |
| Picks | Race challenge and pit-stop result inputs generated for the Picks surface |

Freshness caveat: Race Analysis and standings are current through the British Grand Prix. Analytics and telemetry are available through the Barcelona Grand Prix, so the app labels those surfaces as not fully current until British Grand Prix telemetry processing is refreshed.

## Architecture

```text
FastF1 archive
  -> staged session extracts
  -> canonical FastF1 tables
  -> telemetry and deterministic feature layers
  -> compact product views and indexes
  -> Next.js server-first product surfaces
```

| Layer | Purpose |
| --- | --- |
| `data/raw/fastf1` | Generated FastF1 archive, manifests, and cache-adjacent artifacts |
| `data/staged/fastf1` | Generated per-session extracts |
| `data/canonical_fastf1` | Validated canonical laps, results, stints, sessions, and weather |
| `data/telemetry_features` | Telemetry-derived segment, braking, throttle, straight-line, and energy-proxy features |
| `data/strategy_lab` | Deterministic Strategy Lab product views |
| `data/analytics` | Telemetry product views, indexed session shards, and representative trace artifacts |
| `data/race_analysis` | Completed-race intelligence views |
| `data/race_week` | Current race-week context, predictions, circuit metadata, and weekend readiness views |
| `data/predictions` | Picks challenges, pit-stop result inputs, and deterministic prediction snapshots |
| Supabase | Authentication, profiles, and deployable database-backed surfaces |

## Local Development

Requirements: Node.js 20+, npm 10+, Python 3.11+, and the Python packages in `data/requirements.txt`.

```bash
npm install
npm run data:install
npm run dev
```

Create `.env.local` from `.env.example` only when testing Supabase-backed auth and profile flows. Never commit real environment files or secrets.

## Validation

```bash
npm run test --workspace web
npm run typecheck
npm run lint --workspace web
npm run build --workspace web
npm run assets:audit
python check_generated_artifacts.py
python validate_product_manifest.py
```

## Data Refresh

Core deterministic refresh order:

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
python data/build_strategy_lab_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python data/build_race_analysis_views.py
python validate_race_analysis_views.py
python data/build_race_week_layers.py
python data/build_pit_wall_picks.py
python build_season_state.py
python build_product_manifest.py
python validate_product_manifest.py
python check_generated_artifacts.py
```

## Product Integrity

- Energy deployment is a **proxy**, not true ERS or battery telemetry.
- Analytics uses **approximate segments** and does not claim unverified named-corner precision.
- Same-team Analytics colors are comparison aids only; constructor names and telemetry values remain source-derived.
- Position movement, traffic, DRS-window, dirty-air, and related values remain explicitly labelled as proxy or derived where exact evidence is unavailable.
- Race-control causes and exact overtakes are not invented.
- Strategy Lab presents deterministic scenario ranges and assumptions, not ML predictions.
- Public leaderboard payloads must not expose raw Supabase user IDs.

## Artifact and Deployment Policy

Commit source, SQL, migrations, tests, documentation, fixtures, and intentionally small runtime product views. Do not commit raw FastF1 archives, cache data, parquet telemetry, canonical CSVs, telemetry feature CSVs, or large generated Analytics and Race Analysis outputs without an explicit release decision.

The web app targets Vercel using Next.js App Router. Supabase-backed auth/profile flows require:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`

See [Release Checklist](docs/RELEASE_CHECKLIST.md) for the runtime artifact matrix, build order, Supabase checks, deployment flow, and post-deploy QA.

## Documentation

- [Development](docs/DEVELOPMENT.md)
- [Data Pipeline](docs/DATA_PIPELINE.md)
- [Data Sources](docs/data-sources.md)
- [Analytics](docs/ANALYTICS.md)
- [Strategy Lab](docs/STRATEGY_LAB.md)
- [Deployment](docs/deployment.md)
- [Supabase Auth Setup](docs/supabase-auth-setup.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
