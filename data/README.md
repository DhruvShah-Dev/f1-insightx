# Data Workspace

This directory contains the F1 InsightX data platform: raw source fetches, normalized canonical tables, FastF1 session intelligence, and product-facing feature views.

## Layers

### 1. Raw

- `data/raw/reference`
- Snapshotted public API responses from Jolpica
- Schedule, race results, qualifying, sprint, and metadata provenance

- `data/raw/fastf1`
- FastF1 schedule snapshots and ingestion manifests
- Local cache-backed session bookkeeping for incremental reruns

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

### 3. Staged FastF1 session layer

- `data/staged/fastf1`
- Per-session extracts for FP1, FP2, FP3, Qualifying, Sprint, and Race when available
- Includes:
  - `laps.csv`
  - `stints.csv`
  - `session_summary.csv`
  - optional `results.csv`
  - optional `weather.csv`

This layer is built for reproducible feature engineering and keeps FastF1 telemetry-heavy data out of the web runtime.

### 4. Product analytics / feature layer

- `driver_standings.csv`
- `constructor_standings.csv`
- `race_week_context.csv`
- `model_features.csv`
- `prediction_snapshots.csv`
- `fantasy_inputs.csv`

These are the product-facing views used by the homepage, Strategy Lab, Fantasy Builder, race-week predictions, and future forecasting work.

### 5. FastF1 features / model inputs / predictions

- `data/features/driver_form_snapshots.csv`
- `data/features/constructor_form_snapshots.csv`
- `data/model_inputs/stint_model_inputs.csv`
- `data/model_inputs/prediction_model_inputs.csv`
- `data/predictions/strategy_baselines.csv`
- `data/predictions/fastf1_prediction_snapshots.csv`

These outputs are point-in-time safe, era-aware datasets designed to become the intelligence backbone for Strategy Lab and race-week forecasting.

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

### 5. Run the FastF1 intelligence pipeline

```bash
python data/run_fastf1_pipeline.py --start-season 2024 --end-season 2026
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

## FastF1 architecture

The FastF1 layer is designed around:

- `raw/fastf1`: schedule and ingestion manifests
- `staged/fastf1`: session-level extracted tables
- `features`: reusable driver and constructor form snapshots
- `model_inputs`: strategy and prediction modeling inputs
- `predictions`: production-minded baseline outputs

### 2026-aware modeling

2026 is treated as a regulation reset, not a normal continuation. Historical data is allowed to inform features, but older seasons are down-weighted by era and recency so pre-2026 relationships do not dominate the current rules package.

### Session weighting

- FP1: early setup and acclimatization signal
- FP2: strongest race-simulation and long-run signal
- FP3: final setup refinement and track-state update
- Qualifying: strongest short-run pace anchor
- Sprint and Race: conversion and execution context when available

## Update workflow through the season

1. Run `fetch_reference_data.py` daily or before race-week refreshes.
2. Run `normalize_results.py` after new raw data arrives.
3. Run `build_product_views.py` to regenerate standings, features, and prediction snapshots.
4. Run `load_supabase.py` to publish tables for the web app.
5. Run `run_fastf1_pipeline.py` when you want session-rich practice, degradation, and race-week modeling outputs.

This keeps the app current without hardcoding "latest race" content into UI components.
