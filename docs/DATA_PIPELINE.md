# Data Pipeline

F1 InsightX uses an offline data pipeline. The application runtime consumes compact CSV/JSON product views and Supabase-backed auth/profile data; it does not process raw telemetry on request.

## Layers

- `data/raw/fastf1`: generated FastF1 source archive, manifests, failed-session records, and cache-adjacent data.
- `data/staged/fastf1`: generated session-level extracts such as laps, weather, stints, results, and summaries.
- `data/canonical_fastf1`: generated manifest-gated canonical tables with weather propagated into lap and session summary outputs.
- `data/telemetry_features`: generated telemetry-derived lap, segment, braking, throttle, straight-line, and energy proxy features.
- `data/strategy_lab`: Strategy Lab feature and product CSVs.
- `data/analytics`: Analytics product views and indexed session shards.
- `data/race_analysis`: completed-race product views for strategy, pace, traffic proxy, position movement, and story context.

## Canonical FastF1

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py
```

Canonical output should include only complete manifest-gated sessions. Failed or partial sessions may exist in raw/staged folders, but they must not flow into canonical tables.

## Telemetry Features

```bash
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
```

Telemetry features are derived offline from FastF1 telemetry and position parquet. They are reusable inputs for Strategy Lab and Analytics. They must remain deterministic and clearly label energy deployment as a proxy.

## Strategy Lab Views

```bash
python data/build_strategy_lab_layers.py
```

Strategy Lab combines canonical race data, weather, tyre/stint behavior, telemetry-derived strategy signals, and track archetype weights. The simulator should expose confidence and weakest assumptions instead of exact race predictions.

## Analytics Views

```bash
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python validate_analytics_views.py
```

`data/build_analytics_views.py` creates product CSVs. `data/build_analytics_indexes.py` creates session-scoped compressed shards so the API can avoid loading large global CSVs for detail modes.

Representative telemetry trace artifacts are generated offline and rendered as lightweight SVG traces in Analytics. The web runtime must not rebuild or smooth raw telemetry on request.

## Race Analysis Views

```bash
python data/build_race_analysis_views.py
python validate_race_analysis_views.py
```

Race Analysis views summarize observed race outcomes, pace evolution, stints, weather, track-status phases, traffic proxies, and position movement. They must not invent exact overtakes, race-control causes, DRS certainty, or dirty-air causality.

## Product Freshness Manifest

```bash
python build_product_manifest.py
python validate_product_manifest.py
```

The manifest is written to `data/reports/product_manifest.json` and records each product surface, generated timestamp, build version, source/artifact paths, row counts, validation status, validation command, warnings, errors, and stale threshold.

It does not rebuild heavy data. It only inspects existing artifacts and quality reports.

## Full Refresh Order

```bash
python build_canonical_fastf1.py --start-season 2020 --end-season 2026
python validate_canonical_fastf1.py
python build_telemetry_features.py --start-season 2020 --end-season 2026
python validate_telemetry_features.py
python data/build_strategy_lab_layers.py
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
python data/build_race_analysis_views.py
python validate_race_analysis_views.py
python build_product_manifest.py
python validate_product_manifest.py
```

## Git Policy

Commit pipeline code, validators, tests, and docs. Do not commit raw/staged FastF1 archives, parquet telemetry, canonical CSVs, telemetry feature CSVs, large Analytics CSVs, or indexed shards unless a release explicitly requires bundled data artifacts.
