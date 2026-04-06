# FastF1 Data Pipeline

This directory contains the production-minded raw FastF1 ingestion foundation for F1 InsightX.

## Install

Create or activate a Python virtual environment, then install:

```bash
pip install -r data_pipeline/requirements.txt
```

## Structure

```text
data_pipeline/
  fastf1/
    config/
    ingest/
    extract/
    storage/
    utils/
    raw/
    cache/
    logs/
  scripts/
```

## Caching

FastF1 caching is mandatory and is enabled through the configured cache directory:

```python
fastf1.Cache.enable_cache("data_pipeline/fastf1/cache")
```

Configurable paths:

- `FASTF1_PIPELINE_CACHE_DIR`
- `FASTF1_PIPELINE_RAW_DIR`
- `FASTF1_PIPELINE_LOGS_DIR`

## Historical coverage

The ingestion CLI is built to process:

- every completed event from 2020 through 2025
- 2026 through the latest available completed event at runtime

Future 2026 events are skipped dynamically using schedule/session metadata.

## Raw storage layout

```text
data_pipeline/fastf1/raw/{year}/{round}_{event_name}/{session_type}/
  session_meta.json
  results.csv
  laps.csv
  weather.csv
  best_laps.csv
  stints.csv
  telemetry.parquet
  position.parquet
```

## Run ingestion

Ingest one session:

```bash
python data_pipeline/scripts/run_fastf1_ingestion.py session --year 2026 --race "Miami Grand Prix" --session FP2
```

Ingest a full race weekend:

```bash
python data_pipeline/scripts/run_fastf1_ingestion.py weekend --year 2026 --race "Miami Grand Prix"
```

Ingest a full season:

```bash
python data_pipeline/scripts/run_fastf1_ingestion.py season --year 2026
```

Ingest the full range from the first 2020 race to the latest completed 2026 event:

```bash
python data_pipeline/scripts/run_fastf1_ingestion.py full-range
```

Optional telemetry and position extraction:

```bash
python data_pipeline/scripts/run_fastf1_ingestion.py session --year 2026 --race "Miami Grand Prix" --session FP2 --telemetry
```
