# Data Sources

## V2 source strategy

Use free, public, and stable sources with different roles instead of relying on one endpoint for everything.

## Primary sources

### Jolpica F1 API

Role:

- historical race calendar
- drivers
- constructors
- circuits
- results
- qualifying summaries

Why:

- simple structured API
- strong fit for normalized historical tables
- practical replacement for older Ergast-style usage

Reference:

- https://github.com/jolpica/jolpica-f1

### FastF1 legacy

Role:

- immutable session evidence through 2026 round 17
- pre-2023 session history, outside OpenF1 coverage
- reviewed legacy circuit geometry

Why:

- preserves reproducibility of previously published releases
- never receives new production writes

Reference:

- https://docs.fastf1.dev/

### OpenF1

Role:

- sole session-data provider from 2026 round 18 onward
- required session, timing, telemetry, weather, tyre, and location endpoints
- deterministic cleaned inputs for all enriched products

Why:

- free historical access without authentication
- JSON/CSV REST API is easy to snapshot into the offline pipeline
- retains exact raw JSON and quarantines invalid records instead of rewriting them

Limits:

- free tier is historical only, not live session data
- keep ingestion under 3 requests per second and 30 requests per minute
- data before 2023 is not available

Reference:

- https://openf1.org/docs/

### FIA official documents

Role:

- final classification cross-checks
- penalties and official confirmations

Why:

- useful as a verification source for edge cases

Reference:

- https://www.fia.com/

### Official F1 Fantasy rules and pricing pages

Role:

- roster format
- scoring logic
- pricing assumptions

Why:

- needed to keep the fantasy module grounded in real game mechanics

Reference:

- https://www.formula1.com/

## V1 curated tables expected from these sources

- `drivers`
- `constructors`
- `circuits`
- `races`
- `race_results`
- `qualifying_results`
- `fantasy_pricing`
- `strategy_profiles`

## Modeling principle

Historical structured data should be trusted first. Rich telemetry and weather features are now ingested through FastF1, but should remain additive rather than mandatory for every product surface.

OpenF1 should be used as a consolidation source, not as a browser runtime dependency. Snapshot it offline, generate coverage/source-agreement reports, then let product builders consume compact CSV outputs.
