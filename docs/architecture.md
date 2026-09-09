# Architecture

F1 InsightX is a server-first TanStack Start product backed by offline FastF1 data builders and Supabase auth/profile storage. The runtime consumes compact product views; raw telemetry, canonical rebuilds, and heavy generated artifacts stay outside request handling.

## Product Surfaces

- **Race Week**: current event command center with schedule, circuit metadata, conditions, and race-week order.
- **Compare**: driver-vs-driver telemetry workstation using indexed session shards, real circuit geometry, representative traces, approximate segments, and proxy-safe energy labels.
- **Picks**: public race-week prediction board backed by the current next-race product view.
- **Analysis**: completed-race intelligence reports built from observed results and offline product views.
- **Account/Profile**: Supabase auth, profile settings, privacy, and account-management routes.

Fantasy work is intentionally hidden from the public product until it is rebuilt as a separate surface.

## Runtime Flow

1. A user opens a TanStack Start route.
2. Server functions load small curated/product views from the bundled generated snapshot by default, or Supabase-backed public tables when `F1_INSIGHTX_PUBLIC_DATA_SOURCE=supabase`.
3. Client components only manage interaction state such as form controls, synchronized telemetry focus, picks, and auth/profile forms.
4. Server functions return bounded product payloads and never parse raw FastF1 telemetry at runtime.
5. Product surfaces display data quality, proxy wording, and unavailable states instead of inventing missing precision.

## Data Flow

```text
FastF1 archive
  -> staged session extracts
  -> canonical laps/results/stints/weather
  -> telemetry and deterministic feature layers
  -> strategy modeling, analytics/Compare, Race Week, and Analysis product views
  -> indexed/sharded runtime artifacts
  -> TanStack Start server-first surfaces
```

## Module Boundaries

- `src`: active TanStack Start routes, UI components, server functions, auth/profile helpers, and client utilities.
- `apps/web`: archived Next.js UI; its package scripts intentionally fail and should not receive new product work.
- `data`: offline builders, generated-data schemas, validators, and product-view generation scripts.
- `supabase`: migrations and explicit Data API grants.
- `docs`: release policy, data-source notes, architecture, and product integrity documentation.

## Integrity Rules

- Compare uses approximate segments unless named segment metadata is manually verified.
- Energy deployment remains a proxy, not true ERS or battery state.
- Analysis must not invent exact overtakes, incident causes, or DRS certainty.
- Strategy-modeling outputs return deterministic scenario bands and assumptions, not calibrated ML predictions.
- ML work remains postponed until deterministic datasets and leakage controls are explicitly approved.

## Deployment Shape

The web app targets Vercel from the repository root. Supabase provides auth/profile persistence and optional database-backed product/reference reads. Large Compare, Analysis, canonical, telemetry, and ML-generated artifacts are ignored by Git and must be generated or attached through a deliberate deployment artifact process.
