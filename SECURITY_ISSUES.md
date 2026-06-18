# Security Issues

Generated: 2026-06-18

Scope reviewed:
- `npm audit --omit=dev`
- Web security helpers and API-adjacent code under `apps/web/src`
- Next.js headers/configuration
- GitHub Actions workflow configuration
- Python data pipeline dependency and subprocess surfaces

## Open Issues

### 1. Moderate dependency vulnerability: PostCSS via Next.js

- Severity: Moderate
- Source: `npm audit --omit=dev`
- Affected packages: `next`, transitive `postcss`
- Advisory: `GHSA-qx2v-qp2m-jg93`
- CWE: `CWE-79`
- Location: `apps/web/package.json`, `package-lock.json`
- Current finding: Next.js currently pulls a vulnerable PostCSS version below `8.5.10`.
- Risk: XSS exposure if vulnerable PostCSS CSS stringification paths are reachable through framework/tooling behavior.
- Current blocker: `npm audit fix --force` suggests installing `next@9.3.3`, which is a breaking downgrade and should not be applied.
- Recommended fix: Monitor for a Next.js release that includes fixed PostCSS, then upgrade `next` and `eslint-config-next` together and refresh `package-lock.json`.
- Verification: `npm audit --omit=dev` should report zero production vulnerabilities after the upstream fix is available.

### 2. Production rate limiting can silently degrade to process-local memory

- Severity: Medium
- Location: `apps/web/src/lib/security/rate-limit.ts`
- Finding: Production rate limiting falls back to in-memory limits when Upstash configuration is missing or unavailable.
- Risk: In-memory limits are per-process and per-instance, so abuse protection is weaker on scaled or restarted deployments.
- Existing mitigation: A production warning is emitted once per fallback reason.
- Recommended fix: Fail closed for sensitive policies in production, or add a deployment health check that fails when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are missing.
- Verification: Add a production-mode test that sensitive routes cannot use memory fallback unless an explicit development/test override is set.

### 3. Content Security Policy is not configured

- Severity: Medium
- Location: `apps/web/next.config.ts`
- Finding: Security headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`, but no `Content-Security-Policy`.
- Risk: If an injection bug appears elsewhere, the browser has less protection against script execution, data exfiltration, and unsafe framing/resource loading.
- Recommended fix: Add a CSP compatible with Next.js, Supabase auth, deployed asset hosts, and analytics requirements. Start in `Content-Security-Policy-Report-Only`, review reports, then enforce.
- Verification: Browser responses include CSP headers and the app still supports auth, static assets, API calls, and charts.

### 4. CI does not run production dependency audit

- Severity: Medium
- Location: `.github/workflows/ci.yml`
- Finding: CI runs install, lint, test, typecheck, and build, but does not run `npm audit --omit=dev`.
- Risk: Production dependency vulnerabilities can merge unnoticed.
- Recommended fix: Add a CI step for `npm run audit:prod`. If moderate advisories are temporarily accepted, document the exception and avoid broad permanent allowlists.
- Verification: Pull requests fail on new high/critical production advisories, and known temporary exceptions are explicit.

### 5. Python data dependencies are version-ranged but not locked or audited in CI

- Severity: Medium
- Location: `data/requirements.txt`, `data_pipeline/requirements.txt`, `.github/workflows/data-refresh.yml`, `.github/workflows/race-week-session-refresh.yml`
- Finding: Data workflows install broad dependency ranges directly from requirements files and do not run a Python vulnerability scanner.
- Risk: Scheduled CI jobs may pick up vulnerable or behavior-changing transitive packages without review.
- Recommended fix: Add a lock/constraints file for workflow installs and run `pip-audit` or an equivalent scanner in data refresh CI.
- Verification: Data workflows install from a reproducible constraints file and fail on high/critical Python dependency advisories.

### 6. GitHub Actions use tag-pinned third-party actions, not commit SHAs

- Severity: Low
- Location: `.github/workflows/*.yml`
- Finding: Workflows use actions such as `actions/checkout@v4` and `actions/setup-python@v5` by version tag.
- Risk: Tags are less strict than immutable commit SHAs for supply-chain control.
- Recommended fix: Pin workflow actions to full commit SHAs and use Dependabot/Renovate to keep them updated.
- Verification: Every `uses:` entry references an immutable SHA, with dependency automation opening update PRs.

### 7. Some workflows do not declare least-privilege token permissions

- Severity: Low
- Location: `.github/workflows/ci.yml`, `.github/workflows/data-refresh.yml`, `.github/workflows/race-week-session-refresh.yml`
- Finding: Several workflows omit a top-level `permissions:` block. GitHub then applies repository defaults.
- Risk: If repository defaults are broad, compromised workflow steps may receive more token access than needed.
- Recommended fix: Add `permissions: contents: read` to read-only workflows. Grant broader permissions only where explicitly required.
- Verification: Every workflow declares a minimal `permissions:` block.

### 8. Subprocess-based data orchestration lacks command allowlist tests

- Severity: Low
- Location: `data/run_fastf1_pipeline.py`, `data/refresh_current_race_week_sessions.py`
- Finding: Data orchestration executes subprocess commands. Current usage appears list-based rather than `shell=True`, which is good, but there are no focused tests guarding command construction.
- Risk: Future changes could accidentally introduce shell invocation or user-controlled command arguments.
- Recommended fix: Add tests that assert command arrays are fixed/allowlisted and `shell=True` is never used for pipeline orchestration.
- Verification: Tests fail if orchestration switches to shell string execution or accepts arbitrary command input.

## Positive Findings

- No tracked `.env.local` secrets were found during this pass.
- No `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, or `new Function` usage was found under `apps/web/src`.
- Sensitive account/profile routes already use authentication, same-origin checks, and rate limiting.
- Supabase profile access is backed by RLS-oriented SQL migrations.
- The Python subprocess calls found use argument arrays and do not use `shell=True`.

## Suggested Triage Order

1. Track the Next/PostCSS advisory and upgrade as soon as a non-downgrade fix is available.
2. Decide whether production rate-limit fallback should fail closed for auth/mutation routes.
3. Add CSP in report-only mode.
4. Add production dependency audits to CI.
5. Add Python dependency locking/auditing for scheduled data workflows.
