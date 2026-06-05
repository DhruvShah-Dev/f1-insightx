# Analytics

Analytics is the driver-vs-driver telemetry comparison surface. It uses precomputed product views only; it is not a raw telemetry explorer.

The current UI is an adaptive telemetry workstation: a compact command deck, integrated battle rail, real circuit geometry, representative SVG traces, synchronized approximate-segment focus, and a concise engineering strip.

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

Representative telemetry traces must come from offline trace shards or precomputed product payloads. The page may render SVG traces, but it must not smooth, infer, or rebuild raw telemetry at request time.

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

## UI Rules

- Keep the first viewport product-first: command controls, battle context, circuit/trace canvas, and mode navigation.
- Preserve URL parameters for `sessionId`, `driverA`, `driverB`, `tab`, and `segmentId`.
- If both drivers are from the same constructor, use deterministic comparison colors so the traces remain readable. These colors are visual aids only; team names and telemetry values remain source-derived.
- Keep native dropdowns readable with dark option styling and avoid hidden scroll affordance on horizontal mode rails.

## Product Honesty

- Say `approximate segment`, not exact corner name, until manually refined circuit maps exist.
- Say `energy deployment proxy`, not battery usage or true ERS data.
- Keep charts lightweight and product-ready. Avoid giant tables and raw trace dumps.
- Do not imply same-team comparison colors are official driver identity colors.

## Regeneration

```bash
python data/build_analytics_views.py
python data/build_analytics_indexes.py
python data/build_analytics_telemetry_traces.py
python validate_analytics_views.py
python validate_analytics_telemetry_traces.py
```

Large generated CSVs and session shards are ignored by default. If a deployment needs bundled data, generate them as part of the deployment artifact process rather than committing raw telemetry or cache files.
