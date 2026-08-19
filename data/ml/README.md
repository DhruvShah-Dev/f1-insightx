# ML-Ready Data Layer

This directory is reserved for ML-ready schema templates and future leakage-safe feature datasets. The current product remains deterministic; no model training or inference artifact is shipped from this folder.

F1 InsightX should only ship ML when it improves the product beyond deterministic heuristics and can be evaluated honestly. Until then, this folder is a readiness layer for future startup-scale prediction work, not a marketing claim.

## Current Status

- No model training is implemented.
- No inference artifacts are stored here.
- `schema_templates/*.csv` files define expected columns and are intentionally empty except for headers.
- Generated ML datasets belong under ignored folders such as `data/ml/generated/`.
- Deterministic product layers remain the source of truth until ML has enough validated data and evaluation coverage.

## Product Gate

An ML output can become product-facing only after:

- feature generation is reproducible from versioned inputs
- leakage checks pass for the target use case
- time-aware evaluation beats deterministic baselines
- calibration is measured, not assumed
- a model card documents inputs, exclusions, error modes, and refresh cadence
- fallback behavior exists when the model artifact is missing or stale

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
