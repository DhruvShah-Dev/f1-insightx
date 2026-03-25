# Data Workspace

This folder will contain the Python ingestion and feature-engineering layer for F1 InsightX.

## Planned responsibilities

- fetch public F1 datasets
- normalize historical race and qualifying data
- compute fantasy value metrics
- compute strategy priors and circuit profiles
- load curated outputs into Supabase

## Install

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r data/requirements.txt
```

## Early execution plan

The first scripts added in M1 should be:

1. `fetch_reference_data.py`
2. `normalize_results.py`
3. `load_supabase.py`

## M1 pipeline

### 1. Fetch raw data snapshots

```bash
python data/fetch_reference_data.py --start-season 2024 --end-season 2025
```

This writes raw Jolpica responses into `data/raw/reference`.

### 2. Normalize into curated CSVs

```bash
python data/normalize_results.py
```

This produces:

- `data/curated/drivers.csv`
- `data/curated/constructors.csv`
- `data/curated/circuits.csv`
- `data/curated/races.csv`
- `data/curated/qualifying_results.csv`
- `data/curated/race_results.csv`
- `data/curated/strategy_profiles.csv`
- `data/curated/fantasy_pricing.csv`

### 3. Load into Supabase/Postgres

Set `DATABASE_URL` in `.env.local`, then run:

```bash
python data/load_supabase.py
```

## Scope notes

- `strategy_profiles.csv` is intentionally lightweight in M1 and only derives simple rolling overtake and reliability scores from historical results.
- `fantasy_pricing.csv` is a schema placeholder in M1 so the downstream app can depend on a stable table shape before live pricing ingestion is added.
