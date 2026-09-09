# Strategy Modeling

Strategy modeling is a deterministic, explainable data layer for race strategy context. It is data-driven, but it is not a machine-learning model and should not be described as a calibrated race prediction engine.

The former public `/lab` route is retired in the active root UI. Current strategy outputs support Race Week, Picks, and Analysis surfaces through generated product views.

## Inputs

- Canonical FastF1 laps, results, stints, weather, and session summaries.
- Strategy product views in `data/strategy_lab`.
- Telemetry-derived strategy signals for driver/car behavior.
- Track archetype weights for power sensitivity, braking, traction, degradation, and track position.

## Model Scope

Strategy modeling covers:

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

## Runtime Contract

- Keep strategy math, assumptions, and product-view schemas separate from presentation components.
- Do not expose a new public strategy route without updating route docs, release checks, and navigation.
- Loading and failure states should degrade inside the consuming surface rather than replacing a whole route with a generic page.
- Generated strategy outputs must carry confidence and weakest-assumption fields.

## Product Output Rules

Use finish bands, gain/loss ranges, confidence, weakest assumption, and sensitivity drivers. Avoid exact probabilities or wording that implies calibrated certainty.

Energy deployment must always be labelled as a proxy. Track and segment effects should be presented as modeled influences, not precise engineering telemetry claims.
