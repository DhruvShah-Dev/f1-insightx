# Manual Audit Tasks

Generated: 2026-06-27

These tasks require upstream releases, production credentials, deployed-preview evidence, or live calendar/source confirmation. They were removed from the local remediation issue list only when they could not be completed safely from the repository alone.

## Upstream Dependency Advisory

- Monitor `next` for a safe non-downgrade fix for the transitive PostCSS advisory `GHSA-qx2v-qp2m-jg93`.
- Current local evidence: `npm audit --omit=dev` still reports the known moderate advisory and suggests an unsafe downgrade to `next@9.3.3`.
- Release gate: `npm run audit:prod` now fails on high/critical production advisories while this documented moderate advisory remains accepted.

## Production Environment Checks

- Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production before enabling sensitive account/auth/mutation routes.
- Confirm `/api/health/supabase` returns `ok: true` and `source: "supabase"` on the deployed production or preview environment.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are available only to server/workflow contexts and are not exposed to client bundles or logs.
- Review CSP report-only telemetry on a deployed preview before changing `Content-Security-Policy-Report-Only` to enforced `Content-Security-Policy`.

## Data Freshness And Coverage

- Manually confirm latest completed race, next race, and current race-week facts against the official F1 calendar before production promotion.
- Refresh `season_state` before a current-state release if `python validate_product_manifest.py` continues to report staleness.
- Rebuild Strategy Lab product data for the upcoming/current race when that surface is expected to support the active race week.

## Manual Preview QA

- Run deployed-preview QA for auth sign-in/sign-out, protected account/profile flows, account export, username checks/suggestions, and CSP report-only behavior.
- Verify Race Week, Home, Strategy Lab, Race Analysis, Championship, Picks, privacy, terms, and cookies pages across desktop and mobile viewports.
