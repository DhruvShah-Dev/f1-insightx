# F1 InsightX — Full Repository Audit

Date: 2026-04-16

Scope covered:
- Next.js App Router frontend and product surfaces
- Supabase auth, middleware, and account/profile flows
- API routes and shared server helpers
- CSV fallback/runtime serving logic
- Python data pipeline, schema, and loader design
- CI/test posture

Notion status:
- Notion MCP tools were not exposed in this session, so this audit could not be written directly to Notion.
- This document is the structured backlog artifact for later import.

## Findings

### 1. Supabase auth middleware does not await token refresh
- Severity: High
- Category: Security / Auth / Runtime Stability
- Subsystem: Auth middleware
- Area/Page: Global request path
- Affected Files:
  - `apps/web/src/lib/auth/supabase-middleware.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - The middleware calls `void supabase.auth.getUser()` and immediately returns the response.
  - That means token refresh/cookie mutation is not guaranteed to complete before the response leaves middleware.
  - This creates auth lifecycle instability and can produce inconsistent session behavior under expiry or refresh paths.
- Suggested fix:
  - Await `supabase.auth.getUser()` in middleware and follow the Supabase SSR middleware pattern exactly.
  - Keep cookie mutation and response creation coupled to the awaited call.
- Effort: Small

### 2. Service-role Supabase client is used broadly for public read paths
- Severity: High
- Category: Security / System Design
- Subsystem: Server data access
- Area/Page: Public product surfaces and reference APIs
- Affected Files:
  - `apps/web/src/lib/server/supabase.ts`
  - `apps/web/src/lib/server/f1-platform.ts`
  - `apps/web/src/lib/server/reference-data.ts`
  - `apps/web/src/lib/server/race-week-product.ts`
  - `apps/web/src/lib/server/strategy-lab-product.ts`
  - `apps/web/src/lib/server/race-history.ts`
  - `apps/web/src/lib/server/race-context.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - Public read paths are routinely backed by a service-role client instead of anon/RLS-safe access.
  - If one route or helper leaks unintended query capability later, the blast radius is full database scope instead of table-limited public access.
  - This also hides policy mistakes because production reads bypass RLS entirely.
- Suggested fix:
  - Split server DB access into two clients:
    - anon/RLS-safe client for public reads
    - service-role client only for admin-only mutation/orchestration
  - Reserve service-role usage for account bootstrap, protected writes, and pipeline/admin tasks.
- Effort: Large

### 3. Runtime source of truth is still ambiguous across Supabase, curated CSV, and product CSV layers
- Severity: High
- Category: Architecture / Fallback Logic / Data Integrity
- Subsystem: Runtime serving
- Area/Page: Homepage, Race Week, Strategy Lab, race detail, reference data
- Affected Files:
  - `apps/web/src/lib/server/csv.ts`
  - `apps/web/src/lib/server/f1-platform.ts`
  - `apps/web/src/lib/server/reference-data.ts`
  - `apps/web/src/lib/server/race-history.ts`
  - `apps/web/src/lib/server/race-context.ts`
  - `apps/web/src/lib/server/race-week-product.ts`
  - `apps/web/src/lib/server/strategy-lab-product.ts`
  - `README.md`
  - `data/README.md`
  - `docs/architecture.md`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - Public surfaces can serve different answers depending on whether Supabase succeeds, whether curated CSV exists, and whether product CSV artifacts have been materialized recently.
  - `readCsv` silently returns `[]` on missing files, which makes degraded behavior look like empty product state instead of an operational fault.
  - Documentation still describes curated CSV as canonical even though canonical/session/product layers now extend beyond that model.
- Suggested fix:
  - Declare one serving truth per product surface.
  - Treat CSV fallback as explicit degraded mode, not silent equivalence.
  - Fail loudly for required product files and centralize freshness checks.
  - Update docs to reflect the actual layered data architecture.
- Effort: Large

### 4. Full-table truncate-and-reload loader is operationally brittle
- Severity: High
- Category: Data Platform / Operations
- Subsystem: Data publishing
- Area/Page: Supabase/Postgres load path
- Affected Files:
  - `data/load_supabase.py`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - `load_supabase.py` truncates every table in reverse load order and reloads the full dataset on every run.
  - Optional tables are skipped when files are absent, which can publish an incomplete data state after a refresh.
  - This is not incremental, not race-scoped, and not safe for growing data volume or frequent refreshes.
- Suggested fix:
  - Move to upsert/incremental publication by season/race/table family.
  - Add freshness/version metadata and skip publication if a required product layer is missing.
  - Separate canonical refresh from product-view refresh.
- Effort: Large

### 5. Automated test coverage is effectively absent
- Severity: Medium
- Category: Code Quality / Reliability
- Subsystem: Repository-wide
- Area/Page: CI and verification
- Affected Files:
  - `tests/`
  - `.github/workflows/ci.yml`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - CI runs only lint and build.
  - There are no repo tests for auth flows, route contracts, simulation behavior, fallback mode, or data transformation correctness.
  - This is high regression risk for a repo with many custom server/data layers.
- Suggested fix:
  - Add minimal high-value test coverage first:
    - auth route/session tests
    - product helper contract tests
    - simulation regression tests
    - data build smoke tests
  - Add `typecheck` to CI.
- Effort: Medium

### 6. Several core files are oversized and mix too many concerns
- Severity: Medium
- Category: Code Quality / Maintainability
- Subsystem: Frontend and server helpers
- Area/Page: Strategy Lab, Profile, platform aggregation
- Affected Files:
  - `apps/web/src/components/lab/race-lab-workspace.tsx`
  - `apps/web/src/components/account/profile-page-shell.tsx`
  - `apps/web/src/lib/server/f1-platform.ts`
  - `apps/web/src/lib/server/strategy-lab-product.ts`
  - `apps/web/src/lib/server/race-history.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - These files are each carrying data shaping, business logic, and presentation concerns in one place.
  - That raises review cost, regression cost, and makes reuse harder.
- Suggested fix:
  - Split by concern:
    - selectors/mappers
    - API/client state
    - view components
    - pure simulation/product helpers
- Effort: Medium

### 7. Two overlapping strategy simulation engines still exist
- Severity: Medium
- Category: Architecture / Reusability
- Subsystem: Simulation
- Area/Page: Strategy and race scenario APIs
- Affected Files:
  - `apps/web/src/lib/server/race-simulator.ts`
  - `apps/web/src/lib/server/strategy-lab-simulator.ts`
  - `apps/web/src/app/api/race-scenarios/simulate/route.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - The repo now has both a legacy race-context simulator and a Strategy Lab product-backed simulator with overlapping response concepts.
  - This is a drift risk for API behavior, explanation logic, and confidence semantics.
- Suggested fix:
  - Choose one simulation contract as canonical.
  - Deprecate the older engine or move it behind an explicit compatibility boundary.
- Effort: Medium

### 8. API response conventions are inconsistent across routes
- Severity: Medium
- Category: API Design / Maintainability
- Subsystem: Route handlers
- Area/Page: Account routes vs public product/reference routes
- Affected Files:
  - `apps/web/src/lib/api/errors.ts`
  - `apps/web/src/app/api/account/profile/route.ts`
  - `apps/web/src/app/api/account/export/route.ts`
  - `apps/web/src/app/api/account/username/check/route.ts`
  - `apps/web/src/app/api/account/username/suggest/route.ts`
  - `apps/web/src/app/auth/sign-out/route.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - Some routes use `apiOk`/`apiError`, others return raw `NextResponse.json` payloads with different shapes.
  - This complicates client error handling and makes route behavior less predictable.
- Suggested fix:
  - Normalize route envelopes around shared helpers.
  - Allow explicit exceptions only for file download/redirect responses.
- Effort: Small

### 9. Rate limiting is only truly durable when Upstash is configured
- Severity: Medium
- Category: Security / Abuse Protection
- Subsystem: API protection
- Area/Page: All rate-limited routes
- Affected Files:
  - `apps/web/src/lib/security/rate-limit.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - Without Upstash, the limiter falls back to process memory.
  - In serverless or multi-instance deployments that means inconsistent limits and uneven abuse protection.
- Suggested fix:
  - Treat in-memory rate limiting as local/dev fallback only.
  - Enforce durable backing store in production.
- Effort: Small

### 10. Product coverage depends on materialized CSV breadth when Supabase is unavailable
- Severity: Medium
- Category: Fallback Logic / Product Reliability
- Subsystem: Race Week / Strategy Lab
- Area/Page: Product-view fallback path
- Affected Files:
  - `data/race_week/*.csv`
  - `data/strategy_lab/*.csv`
  - `apps/web/src/lib/server/race-week-product.ts`
  - `apps/web/src/lib/server/strategy-lab-product.ts`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - The product fallback path is only as complete as the checked-in/generated CSV set.
  - Missing or stale materialization changes product availability, as seen with race-specific 404s on Strategy Lab before the page-level fix.
- Suggested fix:
  - Add explicit freshness/coverage checks and surface degraded-mode status clearly.
  - Avoid treating partial product CSVs as equivalent to live DB-backed product views.
- Effort: Medium

### 11. Image handling has reusable abstraction, but optimization is still intentionally bypassed for local assets
- Severity: Low
- Category: Image Usage / Performance
- Subsystem: Asset rendering
- Area/Page: Driver/team imagery
- Affected Files:
  - `apps/web/src/components/ui/asset-image.tsx`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - `AssetImage` bypasses the Next optimizer for `/assets/*` by default.
  - That keeps behavior simple, but it also gives up optimization opportunities on a media-heavy app.
- Suggested fix:
  - Re-evaluate which local assets actually need `unoptimized`.
  - Keep bypass only for cases where Next image optimization is known to be undesirable.
- Effort: Small

### 12. Track rendering logic is duplicated between static and data-driven components
- Severity: Low
- Category: Reusability / UI Consistency
- Subsystem: Track visuals
- Area/Page: Race Week / Strategy Lab
- Affected Files:
  - `apps/web/src/components/ui/track-map.tsx`
  - `apps/web/src/components/ui/track-layout-card.tsx`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - `TrackMap` can render FastF1/GeoJSON-aware paths, while `TrackLayoutCard` still renders only the static asset path.
  - This duplicates visual logic and creates inconsistent fallback behavior.
- Suggested fix:
  - Make `TrackLayoutCard` compose `TrackMap` rather than parallel it.
- Effort: Small

### 13. Documentation is lagging the implemented layered data architecture
- Severity: Low
- Category: System Design / Documentation
- Subsystem: Docs
- Area/Page: Root docs and data docs
- Affected Files:
  - `README.md`
  - `data/README.md`
  - `docs/architecture.md`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - The docs still describe curated CSV as canonical and understate the newer canonical/session/race-week/strategy-lab layers.
  - That makes onboarding and operational reasoning harder than it should be.
- Suggested fix:
  - Update docs to reflect the actual raw -> canonical -> processed -> product-view serving model.
- Effort: Small

### 14. Existing security hygiene is directionally good, not a threat by itself
- Severity: Not a Threat
- Category: Security
- Subsystem: Auth and profile protection
- Area/Page: Account/auth flows
- Affected Files:
  - `apps/web/src/lib/auth/navigation.ts`
  - `apps/web/src/lib/security/request.ts`
  - `apps/web/src/app/api/account/profile/route.ts`
  - `apps/web/src/app/api/account/export/route.ts`
  - `data/sql/001_core_schema.sql`
- Confirmed / Likely / Suspected: Confirmed
- Why it matters:
  - The repo already has:
    - redirect sanitization
    - origin checks on sensitive account mutations/exports
    - profile-specific RLS on `user_profiles`
    - rate limiting on sensitive routes
  - These do not eliminate the larger architecture issues, but they are real protections and should not be mistaken for missing work.
- Suggested fix:
  - Preserve these controls while tightening service-role scope and middleware correctness.
- Effort: Small
