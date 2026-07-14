# ML-Ready Data Layer

This directory is reserved for ML-ready schema templates and future leakage-safe feature datasets. The current product remains deterministic; no model training or inference artifact is shipped from this folder.

## Current Status

- No model training is implemented.
- No inference artifacts are stored here.
- `schema_templates/*.csv` files define expected columns and are intentionally empty except for headers.
- Generated ML datasets belong under ignored folders such as `data/ml/generated/`.
- Deterministic product layers remain the source of truth until ML has enough validated data and evaluation coverage.

## Dataset Rules

- Every future row must include feature or label version, source race/session, generated timestamp, quality flags, and proxy flags.
- Pre-race features must not include same-race outcomes, post-race stint summaries, pit-cycle effects, or Race Analysis explanations.
- In-race and post-race feature sets must be separated from pre-race prediction features.
- Energy fields must remain proxy-labelled and must never claim true ERS or battery state.
- Training, validation, and test splits must be time-aware. Do not random-split race rows across seasons in a way that leaks future form into older predictions.
- Persist evaluation summaries and model cards before any model output becomes a product dependency.

## Templates

The current templates cover:

- driver race features
- team race features
- stint features
- pit strategy features
- telemetry-style features
- track features
- race outcome labels
- data quality labels
