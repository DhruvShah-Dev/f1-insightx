# Data Workspace

This directory contains the F1 InsightX data platform: source snapshots, staged session extracts, canonical FastF1 tables, deterministic feature layers, product-facing views, and SQL loaders.

Generated datasets are intentionally ignored unless they are small fixtures or schema templates. Keep code, validators, SQL, docs, and `.gitkeep` placeholders in git; rebuild large data products from the pipeline.

## Current Local State

Latest local season state: `season_state_20260709T162227Z`, generated at `2026-07-09T16:22:27Z`.

| Layer | Current evidence |
| --- | --- |
| FastF1 archive | 674 completed sessions out of 698 targets; telemetry files present for 663 sessions |
| Canonical FastF1 | 369,010 laps, 13,569 results, 48,188 stints, 13,368 session-summary rows, 77 drivers |
| Race Analysis | 54 race analyses, 60,841 position timeline rows, 1,879 pit-strategy rows |
| Race Week | Belgian Grand Prix, round 10, scheduled `2026-07-19T13:00:00Z` |
| Strategy Lab | Belgian Grand Prix product view available |
| Analytics / telemetry caveat | Analytics and telemetry are available through Barcelona Grand Prix; British Grand Prix telemetry processing is pending |

## Layers

### 1. Raw source snapshots

- `data/raw/reference`: snapshotted Jolpica/reference API payloads.
- `data/raw/openf1`: snapshotted OpenF1 meetings, sessions, and selected session endpoints from 2023 onward.
- `data/raw/fastf1`: FastF1 archive manifests, per-session source tables, optional telemetry parquet, and completion summaries.

Raw folders are ignored and can be regenerated. They should not be used directly by the web app.

### 2. Staged source consolidation

- `data/staged/fastf1`: per-session extracts for practice, qualifying, sprint, and race sessions.
- `data/staged/openf1`: per-season meetings, sessions, endpoint snapshots, and quality reports.

Staged outputs are reproducible feature-engineering inputs and stay out of browser runtime code.

### 3. Canonical FastF1

- `data/canonical_fastf1`: manifest-gated canonical laps, results, stints, session summaries, sessions, entrants, and weather.

Canonical outputs are the validated base for telemetry features, race-week layers, race analysis, and strategy products.

### 4. Product and feature views

- `data/curated`: compact reference/runtime tables such as drivers, constructors, circuits, races, standings, results, prediction snapshots, and fantasy inputs.
- `data/features`: driver and constructor form snapshots.
- `data/model_inputs`: leakage-aware model input tables.
- `data/predictions`: deterministic prediction snapshots, Strategy Lab baselines, Picks challenges, and pit-stop result inputs.
- `data/telemetry_features`: corner, braking, throttle, straight-line, energy-proxy, and lap-summary features.
- `data/analytics`: telemetry comparison views, indexed session shards, track summaries, and trace manifests.
- `data/race_analysis`: completed-race reports and derived post-race intelligence views.
- `data/race_week`: current weekend context, circuit metadata, readiness views, storylines, weather risk, and strategy signals.
- `data/strategy_lab`: deterministic race-strategy scenario inputs and outputs.
- `data/ml`: schema templates for future ML-ready datasets.

## Pipeline

Core refresh order from the repo root:

```bash
python data/fetch_reference_data.py --start-season 2025 --end-season 2026
python data/fetch_openf1_data.py --start-season 2023 --end-season 2026 --session-types Q R --only-missing
python data/build_openf1_quality_report.py
python validate_openf1_quality.py
python data/normalize_results.py
python data/build_product_views.py
python data/load_supabase.py
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
python data/build_strategy_lab_layers.py
python data/build_race_week_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python data/build_race_analysis_views.py
python data/build_pit_wall_picks.py
python build_season_state.py
python build_product_manifest.py
```

Use `npm run data:refresh` for the bundled deterministic refresh path when the full local data estate is available.

## Validation

```bash
python validate_openf1_quality.py
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python validate_race_analysis_views.py
python validate_product_manifest.py
python validate_season_state.py
python check_generated_artifacts.py
```

## Integrity Rules

- Pre-race features must not include same-race outcomes or post-race explanations.
- Energy fields are proxies and must never be labelled as true ERS or battery state.
- Position movement, DRS windows, traffic, dirty-air, overtakes, and race-control causes must be labelled as derived/proxy unless exact source evidence exists.
- Public runtime code should read compact product views or Supabase views, not raw telemetry archives.
- Do not commit raw FastF1 archives, parquet telemetry, canonical CSVs, telemetry features, indexed analytics shards, or large generated reports without an explicit release decision.
