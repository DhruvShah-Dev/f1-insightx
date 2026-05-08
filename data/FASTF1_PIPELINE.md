# FastF1 Pipeline

## Purpose

This pipeline extends the existing Jolpica -> curated -> product-view flow with a session-rich FastF1 intelligence layer for:

- Strategy Lab
- race-week prediction
- future fantasy modeling
- deeper driver, team, and tyre analysis

It is designed to be reproducible, low-cost, cache-aware, and era-aware.

## Layers

### 1. Raw

- `data/raw/fastf1`
- event schedules
- ingestion manifests
- FastF1 cache bookkeeping

### 2. Staged

- `data/staged/fastf1/<season>/<round>_<event>/<session>/`
- `laps.csv`
- `stints.csv`
- `session_summary.csv`
- optional `results.csv`
- optional `weather.csv`

### 3. Features

- `driver_form_snapshots.csv`
- `constructor_form_snapshots.csv`

### 4. Model inputs

- `stint_model_inputs.csv`
- `prediction_model_inputs.csv`

### 5. Predictions / strategy products

- `strategy_baselines.csv`
- `fastf1_prediction_snapshots.csv`

## 2026 treatment

2026 is a regulation reset year. The pipeline encodes regulation era explicitly and down-weights cross-era history so:

- pre-2026 data can still provide stability
- but 2026 weekend signals dominate
- FP2 receives the strongest race-simulation weight
- FP1 and FP3 remain useful for adaptation, setup, and track evolution

## Downloader

The FastF1 downloader is now cache-first, resumable, and manifest-driven.

- primary archive: `data/raw/fastf1`
- staged session layer: `data/staged/fastf1`
- root files:
  - `ingestion_manifest.jsonl`
  - `ingestion_manifest_index.csv`
  - `failed_sessions.jsonl`
  - `completion_summary.json`

If FastF1 raises its hourly API limit, the downloader stops the run, writes the current summary, and leaves completed session manifests intact. Wait for the limit window to reset, then rerun with `--only-missing` or `--retry-failed`.

Telemetry and position data are optional and stored as parquet only when explicitly requested. They are intended for:

- speed comparisons
- braking maps
- throttle maps
- gear maps
- corner delta analysis
- track path generation
- energy deployment proxy analysis

Do not treat telemetry-derived deployment patterns as true battery or ERS usage unless direct ERS data is available.

## Commands

```bash
python data/fastf1_ingest.py --start-season 2020 --end-season 2026 --only-missing --sleep-seconds 2
python data/fastf1_ingest.py --start-season 2020 --end-season 2026 --sessions FP1 FP2 FP3 Q SQ S R --retry-failed --max-retries 3
python data/fastf1_ingest.py --start-season 2026 --end-season 2026 --include-telemetry --sessions Q R --only-missing --sleep-seconds 3
python data/build_fastf1_features.py
python data/build_fastf1_models.py
```

Orchestrated:

```bash
python data/run_fastf1_pipeline.py --start-season 2024 --end-season 2026
```

Validation:

```bash
python data/validate_fastf1_archive.py --start-season 2020 --end-season 2026 --sessions FP1 FP2 FP3 Q SQ S R
```

## Training and evaluation plan

### Prediction baseline V1

- features from weekend sessions plus recent rolling form
- interpretable weighted scoring baseline
- probabilities derived from rank scores and calibrated heuristics

### Strategy baseline V1

- stint-level FP2-first degradation and stint-length heuristics
- pit-window ranges and stop-count recommendations
- confidence derived from session completeness and FP2 availability

### Recommended evaluation workflow

1. Use time-based splits only.
2. Never train on future sessions from the same weekend target.
3. Evaluate 2026 separately from prior seasons.
4. Track:
   - winner hit rate
   - podium/top-10 calibration
   - rank correlation
   - constructor outlook stability
   - strategy pit-window error bands
5. Inspect feature drift at every regulation boundary.

## Storage guidance

- keep raw telemetry in FastF1 cache, not in frontend payloads
- store staged summaries and model inputs as CSV snapshots locally
- publish only processed outputs to Supabase when needed
- keep the web app reading compact snapshots, not session telemetry
