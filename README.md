# F1 InsightX

F1 InsightX is a Formula 1 analytics web app built around two product surfaces: a race strategy simulator and a fantasy lineup optimizer. The project is designed to be portfolio-ready, visually polished, and deployable on low-cost infrastructure.

## Features

- Strategy Lab with scenario-based race simulation, projected finishing order, and confidence output
- Fantasy Builder with budget-aware optimization, safe vs aggressive variants, and captain recommendations
- Current-season constructors and drivers standings, plus recent race archive coverage on the home page
- Dedicated race detail pages with circuit visuals, podium, fastest lap, qualifying, and classification context
- Centralized local asset pipeline for teams, drivers, and circuit visuals

## Tech stack

- Frontend: Next.js 16, React, TypeScript, Tailwind CSS
- Backend: Next.js App Router server routes
- Data pipeline: Python, Jolpica, FastF1
- Database target: Supabase Postgres
- Automation: GitHub Actions
- Deployment target: Vercel Hobby + Supabase Free

## Repository structure

```text
apps/
  web/        Next.js app, UI components, server routes, local assets
config/       Environment and shared project notes
data/         Python ingestion, normalization, and SQL schema
docs/         Architecture, data-source, API, and deployment documentation
scripts/      Local setup and maintenance utilities
```

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` at the repo root. The Next app is configured to read root-level env files in this monorepo. If Supabase variables are missing, the public read-only parts of the app can still fall back to curated CSV data.

Required/optional variables are documented in [.env.example](./.env.example).

On a minimal setup, some standings, archive, and race-week surfaces may render empty states until you either connect Supabase or generate local curated datasets through the data pipeline.

Rate-limit and abuse-protection defaults are documented in [Abuse Protection](./docs/abuse-protection.md). They do not require extra paid infrastructure.

### 3. Run the web app

```bash
npm run dev
```

App URL: `http://localhost:3000`

Optional public-contact variable:

- `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` for privacy/deletion request routing in the app UI and legal pages

## Data pipeline

### Python setup

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r data/requirements.txt
```

### Refresh reference data

```bash
python data/fetch_reference_data.py --start-season 2024 --end-season 2026
python data/normalize_results.py
```

### Load into Supabase/Postgres

```bash
python data/load_supabase.py
```

### Refresh local driver portraits

```bash
python scripts/refresh_driver_portraits.py
```

## Project status

- Current state: feature-complete portfolio build with ongoing UI and data refinement
- Deployment config is included, but production infrastructure still needs your own Vercel/Supabase setup
- The repository is structured for public GitHub, portfolio, and demo use

## Documentation

- [Architecture](./docs/architecture.md)
- [Data Sources](./docs/data-sources.md)
- [Schema Outline](./docs/schema-outline.md)
- [API Contracts](./docs/api-contracts.md)
- [Deployment Guide](./docs/deployment.md)
- [Milestones](./docs/milestones.md)
- [Supabase Auth Setup](./docs/supabase-auth-setup.md)
- [Abuse Protection](./docs/abuse-protection.md)
- [Error Handling](./docs/error-handling.md)
- [Privacy Policy](./apps/web/src/app/privacy/page.tsx)
- [Terms of Use](./apps/web/src/app/terms/page.tsx)
- [Cookie Notice](./apps/web/src/app/cookies/page.tsx)
