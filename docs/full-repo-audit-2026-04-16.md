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
