# Strategy Lab

Strategy Lab is a deterministic, explainable race strategy simulator. It is data-driven, but it is not a machine-learning model and should not be described as a calibrated race prediction engine.

The current product surface is a pit-wall strategy console: one race-specific hero, a sticky desktop control rail, a result-first strategy canvas, stint lanes, pit-window strips, position transition bands, and compact risk/sensitivity modules.

## Inputs

- Canonical FastF1 laps, results, stints, weather, and session summaries.
- Strategy product views in `data/strategy_lab`.
- Telemetry-derived strategy signals for driver/car behavior.
- Track archetype weights for power sensitivity, braking, traction, degradation, and track position.

## Model Scope

Strategy Lab models:

- fuel correction to separate fuel burn from tyre degradation
- non-linear tyre phases
- compound and out-lap warmup effects
- decomposed pit loss
- basic traffic and overtaking constraints
- weather grip states
- energy deployment proxy hooks for 2026-era scenarios
- sensitivity explanations tied to actual modeled factors

It does not model:

- true battery state or ERS deployment maps
- exact driver intent
- full race-control stochastic behavior
- exact corner-by-corner vehicle dynamics

## UI Runtime Contract

- Keep simulation math, presets, API contracts, and product-view schemas separate from the presentation layer.
- Controls may be sticky on desktop but must stack before outputs on mobile.
- Loading and failure states should stay inside the pit-wall workspace, not replace the whole route with a generic page.
- Dropdowns and scroll rails should use the shared dark/select and custom-scrollbar treatment.

## Product Output Rules

Use finish bands, gain/loss ranges, confidence, weakest assumption, and sensitivity drivers. Avoid exact probabilities or wording that implies calibrated certainty.

Energy deployment must always be labelled as a proxy. Track and segment effects should be presented as modeled influences, not precise engineering telemetry claims.
