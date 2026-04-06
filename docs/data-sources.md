# Data Sources

## V1 source strategy

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

### FastF1

Role:
- session loading
- lap-level timing
- weather
- results
- optional telemetry and position extraction
- Python-side analysis and feature engineering

Why:
- now powers the session-rich ingestion layer in this repository
- strong tooling for later model development and backtesting

Reference:
- https://docs.fastf1.dev/

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
