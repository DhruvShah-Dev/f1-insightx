# Production Checks

Generated: 2026-06-18

This is the canonical pre-production audit matrix for F1 InsightX. It complements `docs/RELEASE_CHECKLIST.md` and `SECURITY_ISSUES.md`.

Production must not be promoted if any P0 gate fails. Known exceptions must be written down before release, with owner, expiry, reason, and verification evidence.

## Required Gates

| Gate | Severity | Pass Criteria | Failure Handling |
| --- | --- | --- | --- |
| Clean install | P0 | `npm ci` completes from the committed lockfile. | Block production. |
| Web lint | P0 | `npm run lint --workspace web` exits 0. | Block production. |
| TypeScript | P0 | `npm run typecheck` exits 0. | Block production. |
| Web tests | P0 | `npm test --workspace web` exits 0. | Block production. |
| Production build | P0 | `npm run build --workspace web` exits 0 from a clean checkout. | Block production. |
| Production dependency audit | P0 for high/critical, P1 for moderate | `npm audit --omit=dev` has no high/critical vulnerabilities. Moderate findings are documented in `SECURITY_ISSUES.md`. | Block high/critical; document accepted moderate risk. |
| Generated artifact guard | P0 | `python check_generated_artifacts.py` passes. | Block production unless deploy intentionally provides artifacts outside Git. |
| Product manifest | P0 | `python validate_product_manifest.py` passes. | Block production. |
| Season state | P0 | `python validate_season_state.py` passes and current/next race facts are manually confirmed. | Block production. |
| Supabase heartbeat | P0 for Supabase-backed release | `/api/health/supabase` returns `ok: true` and `source: "supabase"`. | Block production for Supabase-backed release. |
| Security exceptions | P0 | Open security exceptions are reviewed in `SECURITY_ISSUES.md`. | Block if unreviewed high/critical risk exists. |

## Issue Taxonomy

Use these issue types and sub-issues when recording audit findings.

| Type | Severity Guide | Sub-Issues |
| --- | --- | --- |
| Security | P0 for exploitable auth/data leak/RCE, P1 for production abuse or missing hardening, P2 for defense-in-depth. | Dependency vulnerabilities; leaked secrets/env misuse; missing CSP/security headers; weak auth/session handling; missing same-origin checks; rate-limit bypass or memory fallback; Supabase RLS/grant misconfiguration; GitHub Actions token/supply-chain risks. |
| Correctness | P0 for broken production routes or wrong persisted data, P1 for user-visible bad calculations, P2 for narrow edge cases. | Failing tests/typecheck/build; route/API contract regressions; stale season state; wrong race/week/session selection; incorrect scoring/standings/leaderboards. |
| Data Quality | P0 for required production artifact missing, P1 for stale or misleading product data, P2 for minor metadata gaps. | Missing generated artifacts; stale CSV/JSON manifests; schema mismatch; row count anomalies; invalid OpenF1/FastF1 source assumptions; proxy metrics mislabeled as factual telemetry. |
| Reliability | P0 for deploy/CI blocker, P1 for scheduled job failure or broken fallback, P2 for noisy operational risk. | CI-only failures; build-time missing file failures; degraded fallback not intentional; Supabase heartbeat failures; scheduled data workflow failures. |
| Performance | P0 for production outage risk, P1 for major latency/payload regression, P2 for optimization debt. | Large runtime CSV reads; uncapped API payloads; oversized analytics/detail responses; slow build/prerender paths; unnecessary client-side rendering. |
| Maintainability | P1 when it hides production risk, P2 for routine cleanup debt. | Oversized modules; duplicated CSV/path/pipeline logic; inconsistent API envelopes; unclear error handling; weak test coverage around shared helpers. |
| UX/Accessibility | P0 for unusable core flow, P1 for major route/control breakage, P2 for polish or narrow viewport issues. | Broken responsive layouts; unreadable controls/dropdowns; missing loading/error/unavailable states; auth flow dead ends; keyboard/focus issues. |
| Compliance/Policy | P0 for false privacy/security claim or missing required legal surface, P1 for policy mismatch, P2 for wording cleanup. | Privacy/cookie page mismatch; contact email missing; unsupported analytics/tracking claims; public claims inconsistent with data quality. |

## Automated Checks

Run these from the repository root unless noted.

| Area | Command | Pass Expectation | Notes |
| --- | --- | --- | --- |
| Node install | `npm ci` | Installs exactly from `package-lock.json`. | Run in a clean checkout before final production signoff. |
| Web lint | `npm run lint --workspace web` | Exit 0, no ESLint errors. | Warnings should be reviewed before production. |
| Typecheck | `npm run typecheck` | Exit 0. | Uses `apps/web/tsconfig.json`. |
| Web tests | `npm test --workspace web` | All TAP tests pass. | Confirms auth, rate limit, CSV, analytics, standings, scoring, and route helpers. |
| Build | `npm run build --workspace web` | Next.js production build succeeds. | Must be tested without relying on untracked local artifacts. |
| Production audit | `npm audit --omit=dev` | No high/critical findings. | Current accepted moderate Next/PostCSS advisory must stay documented in `SECURITY_ISSUES.md`. |
| Python deps | `python -m pip install -r data/requirements.txt` | Installs successfully in a clean Python environment. | Prefer CI or virtualenv evidence. |
| Python tests | `python -m pytest tests` | All tests pass. | Covers analytics views, telemetry features, ML datasets, OpenF1 quality, Pit Wall Picks, Race Analysis, and timing deltas. |
| Artifact guard | `python check_generated_artifacts.py` | No invalid generated artifacts are staged for Git. | Blocks accidental large/raw artifact commits. |
| Product manifest | `python validate_product_manifest.py` | Manifest exists and matches expected product data state. | Required for production readiness evidence. |
| Season state | `python validate_season_state.py` | Current/next/latest race state is valid. | Also manually confirm against current F1 calendar before launch. |
| OpenF1 quality | `python validate_openf1_quality.py` | Quality report is valid when OpenF1-backed outputs are included. | Required when OpenF1 quality output is part of release evidence. |
| Analytics views | `python validate_analytics_views.py` | Analytics CSV/product views validate. | Required when Analytics is enabled beyond degraded state. |
| Analytics traces | `python validate_analytics_telemetry_traces.py` | Trace manifests and shards validate. | Required only when representative telemetry traces are deployed. |
| Race Analysis | `python validate_race_analysis_views.py` | Race Analysis product views validate. | Required when Race Analysis is enabled beyond degraded state. |
| Telemetry features | `python validate_telemetry_features.py` | Telemetry feature outputs validate. | Required when rebuilding feature-derived product data. |
| Canonical FastF1 | `python validate_canonical_fastf1.py` | Canonical FastF1 outputs validate. | Required when canonical data was rebuilt for the release. |

## Manual QA Checks

Run this matrix on preview first and production after promotion.

Routes and APIs:

- `/`
- `/analytics`
- `/race-analysis`
- `/lab`
- `/predictions`
- `/raceweek`
- `/picks`
- `/account`
- `/privacy`
- `/terms`
- `/cookies`
- `/api/health`
- `/api/health/supabase`
- `/api/analytics/sessions`
- `/api/platform/race-week`

Viewports:

- Desktop: `1440`
- Laptop: `1280`
- Tablet: `768`
- Mobile: `390`

Manual assertions:

- No blank pages, uncaught errors, broken navigation, or infinite loading states.
- Unavailable states are intentional, readable, and consistent with deployed artifacts.
- Auth sign-in and sign-out work, including provider-error fallback messaging.
- Protected account/profile flows reject anonymous users and do not leak profile data.
- Charts, tables, controls, and dropdowns render without overlap or unreadable text.
- Race Week, Home, Analytics, Strategy Lab, Race Analysis, and Picks agree on season state.
- Supabase heartbeat returns healthy in production for Supabase-backed releases.
- Privacy, cookie, terms, and account copy match actual cookies, auth behavior, and data use.
- Proxy metrics are labeled as proxy/approximate where applicable and do not claim true ERS/battery telemetry.

## Production Data Checks

| Data Surface | Required Check | Failure Mode To Record |
| --- | --- | --- |
| Season state | Validate and manually confirm latest completed race, next race, and current race week. | Stale or contradictory race state. |
| Curated/reference CSVs | Confirm required small fallback CSVs are tracked or Supabase-backed. | Missing fallback data or build-time required file failure. |
| Race Week | Validate current Race Week CSVs or Supabase product tables. | Wrong event/session, stale predictions, missing unavailable state. |
| Strategy Lab | Confirm strategy product CSVs/tables are present for enabled races. | Simulation references missing race or stale model inputs. |
| Analytics | Validate session index, manifest, shards, and optional traces when enabled. | Blank Analytics, oversized payload, missing comparison data. |
| Race Analysis | Validate race analysis CSVs when enabled. | Missing race pages, stale summary, or empty analysis without deliberate degraded state. |
| OpenF1 quality | Validate quality report when OpenF1 freshness/coverage is shown or used. | Unsupported source assumptions or unverified session data. |
| Supabase | Confirm migrations, grants, RLS, service-role env, anon heartbeat read, and profile ownership. | Public data unavailable, private data exposed, or write path broken. |

## Security Checks

- Dependency audit: run `npm audit --omit=dev`; high/critical findings block production.
- Known advisory handling: review `SECURITY_ISSUES.md`; the current Next/PostCSS moderate advisory is accepted only while npm suggests an unsafe Next downgrade.
- Secrets: confirm no `.env.local`, service-role key, database URL, OAuth secret, or Upstash token is tracked or logged.
- Environment boundaries: `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` must remain server/workflow-only.
- Headers: confirm frame, content-type, referrer, permissions, and CSP status. Missing CSP is tracked in `SECURITY_ISSUES.md`.
- Auth and same-origin: mutation/account/auth routes must require authentication and same-origin checks where applicable.
- Rate limiting: sensitive routes must use durable Upstash limits in production or have an explicit documented exception.
- Supabase RLS: profile/user-owned tables must enforce ownership; public tables must be read-only for anon/authenticated roles.
- GitHub Actions: workflows should use least-privilege `permissions:` and pinned actions; gaps are tracked in `SECURITY_ISSUES.md`.

## Performance Checks

- Build output: review `next build` output for unexpected route changes, prerender failures, or large static generation work.
- Runtime data size: large CSV/JSON reads must be optional, pre-indexed, capped, or moved to offline artifacts.
- API payloads: detail endpoints must keep row caps explicit, especially Analytics, Race Analysis, and telemetry-like data.
- Caching: public read endpoints should use intentional cache/no-store behavior; account/auth/write routes must not be publicly cached.
- Client rendering: keep data-heavy product logic server-side and avoid unnecessary client-side computation.
- Degraded states: missing optional data should render fast unavailable states instead of throwing or hanging.

## Release Decision Rules

- Block production for any P0 failure.
- Block production for any high/critical production dependency vulnerability unless a written security exception is approved before release.
- Block production if build/test/typecheck/lint fail in a clean checkout.
- Block production if season state is stale or contradicts the current schedule/results.
- Block Supabase-backed production if `/api/health/supabase` is unhealthy.
- Block production if private account/profile data can be accessed by anonymous or wrong-user requests.
- Block production if enabled flagship surfaces require missing artifacts and do not have an intentional unavailable state.
- Accept P1/P2 issues only when they are documented with severity, owner, target fix date, user impact, and verification evidence.
- Record security exceptions in `SECURITY_ISSUES.md`; record release-specific operational exceptions in the release notes or deployment ticket.
