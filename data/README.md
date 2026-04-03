# Data Workspace

This directory contains the F1 InsightX data pipeline: raw source fetches, normalized curated tables, and product-facing feature views.

## Layers

### 1. Raw

- `data/raw/reference`
- Snapshotted public API responses from Jolpica
- Schedule, race results, qualifying, sprint, and metadata provenance

### 2. Curated

- `drivers.csv`
- `constructors.csv`
- `circuits.csv`
- `races.csv`
- `qualifying_results.csv`
- `race_results.csv`
- `sprint_results.csv`
- `strategy_profiles.csv`
- `fantasy_pricing.csv`

These files are normalized from raw source payloads and form the canonical event/session layer.

### 3. Product analytics / feature layer

- `driver_standings.csv`
- `constructor_standings.csv`
- `race_week_context.csv`
- `model_features.csv`
- `prediction_snapshots.csv`
- `fantasy_inputs.csv`

These are the product-facing views used by the homepage, Strategy Lab, Fantasy Builder, race-week predictions, and future forecasting work.

## Pipeline

### 1. Fetch raw data

```bash
python data/fetch_reference_data.py --start-season 2025 --end-season 2026
```

### 2. Normalize staged tables

```bash
python data/normalize_results.py
```

### 3. Build product views and prediction inputs

```bash
python data/build_product_views.py
```

### 4. Load into Supabase / Postgres

```bash
python data/load_supabase.py
```

## Product outputs

### Race week context

`race_week_context.csv` identifies:

- latest completed race
- next scheduled race
- schedule status per round
- prior-race context for point-in-time features

### Point-in-time features

`model_features.csv` is leakage-safe for pre-race prediction:

- recent finish / qualifying trends
- recent points trend
- teammate delta
- consistency and DNF rate
- constructor form
- standings context
- strategy-derived overtake / reliability priors

### Prediction snapshots

`prediction_snapshots.csv` stores one prediction snapshot per upcoming race-week field:

- projected finish
- winner / podium / top-10 probabilities
- model version
- generated timestamp
- compact rationale

### Fantasy inputs

`fantasy_inputs.csv` converts prediction snapshots into reusable fantasy scores and price proxies for both drivers and constructors.

## Update workflow through the season

1. Run `fetch_reference_data.py` daily or before race-week refreshes.
2. Run `normalize_results.py` after new raw data arrives.
3. Run `build_product_views.py` to regenerate standings, features, and prediction snapshots.
4. Run `load_supabase.py` to publish tables for the web app.

This keeps the app current without hardcoding "latest race" content into UI components.
