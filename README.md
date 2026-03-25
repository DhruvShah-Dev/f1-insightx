# F1 InsightX

F1 InsightX is a premium Formula 1 analytics web app built around two product modules: a race strategy simulator and a fantasy lineup recommender. It is designed as a portfolio-grade personal project with real data, polished UI, and a deployment path that stays within free-tier infrastructure.

## Features

- Race Prediction Lab with scenario-based strategy inputs, projected finishing order, confidence, and explanation layers
- Fantasy Team Builder with budget-aware optimization, safe vs aggressive variants, and captain recommendations
- Current-season driver standings and latest completed race archive on the home page
- Dedicated race detail pages with circuit visuals, podium, fastest lap, qualifying, and classification context
- Centralized local asset pipeline for teams, drivers, and circuit visuals

## Tech stack

- Frontend: Next.js 16, React, TypeScript, Tailwind CSS
- Backend: Next.js App Router server routes
- Data pipeline: Python, Jolpica, OpenF1
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

Copy `.env.example` to `.env.local` if you want to run against Supabase. If you leave the Supabase variables empty, the app can fall back to curated CSV data.

Required/optional variables are documented in [.env.example](./.env.example).

### 3. Run the web app

```bash
npm run dev
```

App URL: `http://localhost:3000`

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

- Current state: feature-complete portfolio build with active UI/data polish
- Deployment config is included, but production infrastructure still needs your own Vercel/Supabase setup
- The app is suitable for GitHub, resume, and portfolio demos in its current state

## Documentation

- [Architecture](./docs/architecture.md)
- [Data Sources](./docs/data-sources.md)
- [Schema Outline](./docs/schema-outline.md)
- [API Contracts](./docs/api-contracts.md)
- [Deployment Guide](./docs/deployment.md)
- [Milestones](./docs/milestones.md)
