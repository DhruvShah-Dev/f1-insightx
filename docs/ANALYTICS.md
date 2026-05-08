# Analytics

Analytics is the driver-vs-driver telemetry comparison surface. It uses precomputed product views only; it is not a raw telemetry explorer.

## Runtime Data Contract

The Analytics API reads:

- `analytics_session_index`
- `analytics_driver_comparison`
- `analytics_segment_comparison`
- `analytics_braking_comparison`
- `analytics_throttle_comparison`
- `analytics_straight_comparison`
- `analytics_energy_proxy_comparison`
- `analytics_track_summary`
- indexed session shards under `data/analytics/indexed`

The runtime must not read raw FastF1 parquet telemetry, scan source directories, or process telemetry traces on demand.

## API Surfaces

- `GET /api/analytics/sessions`
- `GET /api/analytics/session/[sessionId]/drivers`
- `GET /api/analytics/compare?sessionId=&driverA=&driverB=&mode=`

Supported comparison modes:

- `overview`
- `segments`
- `braking`
- `throttle`
- `straights`
- `energy-proxy`

Responses should include confidence, weakest assumption, telemetry quality, capped detail rows, and proxy notes where relevant.

## Product Honesty

- Say `approximate segment`, not exact corner name, until manually refined circuit maps exist.
- Say `energy deployment proxy`, not battery usage or true ERS data.
- Keep charts lightweight and product-ready. Avoid giant tables and raw trace dumps.

## Regeneration

```bash
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python validate_analytics_views.py
```

Large generated CSVs and session shards are ignored by default. If a deployment needs bundled data, generate them as part of the deployment artifact process rather than committing raw telemetry or cache files.
