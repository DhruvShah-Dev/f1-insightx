# Architecture

F1 InsightX is a server-first Next.js product backed by offline FastF1 data builders and Supabase auth/profile storage. The runtime consumes compact product views; raw telemetry, canonical rebuilds, and heavy generated artifacts stay outside request handling.

## Product Surfaces

- **Race Week**: current event command center with schedule, circuit metadata, conditions, and race-week order.
- **Analytics**: driver-vs-driver telemetry workstation using indexed session shards, real circuit geometry, representative traces, approximate segments, and proxy-safe energy labels.
- **Strategy Lab**: deterministic pit-wall strategy console using prebuilt race, stint, pit-window, and sensitivity views.
- **Race Analysis**: completed-race intelligence reports built from observed results and offline product views.
- **Account/Profile**: Supabase auth, profile settings, privacy, and account-management routes.

Fantasy work is intentionally hidden from the public product until it is rebuilt as a separate surface.

## Runtime Flow

1. A user opens a Next.js App Router page.
2. Server components load small curated/product views from tracked fallback data, generated deployment artifacts, or Supabase-backed tables where configured.
3. Client components only manage interaction state such as form controls, Strategy Lab scenarios, synchronized telemetry focus, and auth/profile forms.
4. API routes return bounded product payloads and never parse raw FastF1 telemetry at runtime.
5. Product surfaces display data quality, proxy wording, and unavailable states instead of inventing missing precision.

## Data Flow

```text
FastF1 archive
  -> staged session extracts
  -> canonical laps/results/stints/weather
  -> telemetry and deterministic feature layers
  -> Strategy Lab, Analytics, Race Week, and Race Analysis product views
  -> indexed/sharded runtime artifacts
  -> Next.js server-first surfaces
```

## Module Boundaries

- `apps/web`: routes, UI components, server loaders, API routes, auth/profile helpers, and CI fixtures.
- `data`: offline builders, generated-data schemas, validators, and product-view generation scripts.
- `supabase`: migrations and explicit Data API grants.
- `docs`: release policy, data-source notes, architecture, and product integrity documentation.

## Integrity Rules

- Analytics uses approximate segments unless named segment metadata is manually verified.
- Energy deployment remains a proxy, not true ERS or battery state.
- Race Analysis must not invent exact overtakes, incident causes, or DRS certainty.
- Strategy Lab returns deterministic scenario bands and assumptions, not calibrated ML predictions.
- ML work remains postponed until deterministic datasets and leakage controls are explicitly approved.

## Deployment Shape

The web app targets Vercel. Supabase provides auth/profile persistence and optional database-backed product/reference reads. Large Analytics, Race Analysis, canonical, telemetry, and ML-generated artifacts are ignored by Git and must be generated or attached through a deliberate deployment artifact process.
