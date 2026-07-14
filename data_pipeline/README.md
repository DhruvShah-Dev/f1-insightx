# FastF1 Data Pipeline

This directory contains the raw FastF1 ingestion foundation for F1 InsightX. It stores cache-backed session downloads, raw extracts, and logs that feed the canonical product pipeline under `data/`.

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

Tracked source lives in `config`, `ingest`, `extract`, `storage`, `utils`, and `scripts`. Generated raw data, cache files, logs, and Python caches are ignored.

## Caching

FastF1 caching is mandatory and is enabled through the configured cache directory:

```python
fastf1.Cache.enable_cache("data_pipeline/fastf1/cache")
```

Configurable paths:

- `FASTF1_PIPELINE_CACHE_DIR`
- `FASTF1_PIPELINE_RAW_DIR`
- `FASTF1_PIPELINE_LOGS_DIR`

The default cache and raw directories can be large. Do not commit generated season folders or `fastf1_http_cache.sqlite`.

## Historical coverage

The ingestion CLI is built to process:

- every completed event from 2020 through 2025
- 2026 through the latest available completed event at runtime

Future 2026 events are skipped dynamically using schedule/session metadata.

The current local archive summary is generated at `2026-07-09T16:01:09Z`: 674 completed sessions out of 698 targets, with telemetry files present for 663 sessions.

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

## Validation

After ingestion, run the downstream archive and product checks from the repo root:

```bash
python data/validate_fastf1_archive.py --start-season 2020 --end-season 2026 --sessions FP1 FP2 FP3 Q SQ S R
python validate_canonical_fastf1.py
python check_generated_artifacts.py
```
