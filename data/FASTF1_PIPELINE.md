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

## Commands

```bash
python data/fastf1_ingest.py --start-season 2024 --end-season 2026
python data/build_fastf1_features.py
python data/build_fastf1_models.py
```

Orchestrated:

```bash
python data/run_fastf1_pipeline.py --start-season 2024 --end-season 2026
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
