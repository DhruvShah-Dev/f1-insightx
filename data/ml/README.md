# ML-Ready Data Layer

This directory is reserved for ML-ready schema templates and future leakage-safe feature datasets.

Current status:

- No model training is implemented.
- No inference artifacts are stored here.
- Templates are intentionally empty except for headers.
- Deterministic product layers remain the source of truth until ML has enough validated data.

Rules:

- Every future row must include feature/label version, source race/session, generated timestamp, quality flags, and proxy flags.
- Pre-race features must not include same-race outcomes, post-race stint summaries, pit-cycle effects, or Race Analysis explanations.
- In-race and post-race feature sets must be separated from pre-race prediction features.
- Energy fields must remain proxy-labelled and must never claim true ERS or battery state.
