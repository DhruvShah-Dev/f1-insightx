# Architecture

## Chosen shape

The v1 architecture is a single deployable web product with one managed database and an offline Python data layer:

- `apps/web`: Next.js 16 app for UI, API routes, and server-side orchestration
- `Supabase Postgres`: primary relational database
- `data/`: Python workspace for ingesting, cleaning, and scoring F1 data
- `GitHub Actions`: scheduled refresh for static and historical datasets
- `Vercel Hobby`: hosting for the web app

This keeps the runtime surface area small while still showing full-stack breadth.

## Why this is the right v1 architecture

- `0$ friendly`: Vercel Hobby + Supabase Free + GitHub Actions is the lowest-friction free combination with strong DX.
- `Portfolio value`: combines modern React product engineering, API design, SQL modeling, and Python analytics in one project.
- `Maintainability`: one primary deploy target and one DB is appropriate for a solo developer.
- `Extensibility`: prediction logic starts rule-based and can later absorb offline-trained statistical models without reworking the UI or schema.

## Runtime flow

1. A user opens the Next.js app.
2. The app loads reference data such as drivers, constructors, circuits, races, and fantasy pricing from Supabase.
3. The user submits either a race simulation scenario or a fantasy lineup request.
4. Next.js server routes execute the relevant orchestration logic:
   - race simulation engine for scenario outcomes
   - lineup optimization engine for fantasy recommendations
5. Results are returned with explanation objects, confidence bands, and comparison metrics.
6. Saved scenarios and lineups can be persisted later without changing the core flow.

## Data flow

1. Python scripts pull from public F1 data sources.
2. Raw files are normalized into canonical tables.
3. Derived features are computed for strategy profiles, fantasy value scores, and race priors.
4. Curated outputs are loaded into Supabase.
5. The app reads only the curated layer for speed and consistency.

## Prediction philosophy

The app must not imply certainty. V1 should present:

- scenario-based simulations
- transparent heuristics
- confidence labels tied to input stability and data coverage
- explanation text describing which assumptions pushed the outcome

## Module boundaries

### Race Prediction Lab

- Input capture and scenario editing in the frontend
- scenario validation in server routes
- deterministic and heuristic simulation in backend logic
- result views with ranking tables, probability cards, and explanation panels

### Fantasy Team Builder

- budget and preference form in the frontend
- pricing, scoring weights, and constraints from curated tables
- lineup optimization in backend logic
- recommendation variants: safe, balanced, aggressive

## Planned technical evolution

- `V1`: deterministic rules + heuristic scoring
- `V2`: historical calibration and scenario comparison storage
- `V3`: offline-trained statistical models, richer telemetry features, account-based saved workspaces
