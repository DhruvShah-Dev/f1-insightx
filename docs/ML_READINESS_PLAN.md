# ML Readiness Plan

Last audited: 2026-05-10

## Current Position

F1 InsightX is not using machine learning. The current platform is deterministic and product-view driven:

- Canonical FastF1 laps, results, stints, weather, and session summaries.
- Telemetry-derived feature layer from fastest-lap telemetry traces.
- Strategy Lab deterministic simulation and telemetry-informed signals.
- Analytics product views for driver-vs-driver telemetry comparison.
- Race Analysis product views for completed-race explanation.
- Season state and product manifest governance.

ML should wait until the deterministic feature layer is stable, leakage-safe, and temporally versioned.

## Feature Source Classification

| Source | Examples | Classification | ML Use |
| --- | --- | --- | --- |
| Canonical results | finish position, grid, points, status | Observed labels/post-race facts | Labels only for pre-race ML; features only for historical rolling form |
| Canonical laps | lap time, tyre life, compound, position, weather | Observed timing data | In-race/post-race features; rolling historical features |
| Canonical stints | stint length, compound, degradation | Derived deterministic | Post-race/stint models; rolling historical summaries |
| Session summary | representative pace, long-run pace, teammate gap | Derived deterministic | Pre-race if session occurred before feature cutoff |
| Telemetry features | corner speed, braking, throttle, straight, energy proxy | Derived/proxy | Style features with proxy flags |
| Strategy Lab outputs | finish bands, strategy ranking, sensitivity | Derived simulator outputs | Not training input for outcome labels unless explicitly model-stacking later |
| Analytics views | pairwise telemetry comparisons | Derived product views | Style comparisons; avoid label leakage |
| Race Analysis views | story, pit effect, position movement, traffic proxy | Post-race derived/inferred | Explanatory/post-race ML only |
| Track archetypes | power, traction, braking, degradation weights | Derived deterministic | Track features |
| Track status/neutralization | status-only phases | Partial observed context | Context features; no cause labels |
| Position/traffic proxy | position timeline, traffic likely/uncertain | Inferred/proxy | Use only with proxy flags |
| Circuit segment templates | future named segment metadata | Governance scaffold | Not feature-ready until verified |

Unavailable or unsafe now:

- True ERS/battery state.
- Exact overtakes/pass counts.
- Exact DRS eligibility.
- Exact car-ahead gaps.
- Race-control incident causes.
- Tyre temperature.
- Fuel load.

## ML-Ready Tables

Templates live under `data/ml/schema_templates/`. They are header-only and do not contain generated training data.

### driver_race_features

One row per driver per race.

Feature set types:

- `pre_race`: only prior races and completed sessions before race start.
- `in_race`: features available up to a lap/stint cutoff.
- `post_race`: explanatory features after the race.

Core fields:

- Recent form and points.
- Qualifying/race delta history.
- Pace consistency.
- Degradation trend.
- Traffic proxy score.
- Pit strategy effect history.
- Weather exposure.
- Track archetype fit.
- Telemetry style summary.
- Quality/proxy/missing flags.

### team_race_features

One row per constructor per race.

Core fields:

- Pit loss proxy.
- Strategy effectiveness.
- Tyre degradation profile.
- Straight-line, traction, and braking style.
- Reliability/outcome consistency.
- Quality/proxy/missing flags.

### track_features

One row per race/circuit context.

Core fields:

- Track archetype weights.
- Degradation tendency.
- Overtaking/track-position proxy.
- Weather volatility.
- Neutralization frequency proxy.
- Segment confidence.
- Race-control availability.

### stint_features

One row per driver stint.

Core fields:

- Compound and tyre age.
- Stint length.
- Degradation slope.
- Pace stability.
- Race phase.
- Weather state.
- Traffic proxy.
- Confidence and completeness.

### pit_strategy_features

One row per pit stop.

Core fields:

- Pit lap.
- Compound change.
- Pit-cycle movement proxy.
- Estimated pit loss.
- Undercut/overcut proxy.
- Rejoin traffic proxy.
- Confidence.

### telemetry_style_features

One row per driver/session or driver/race.

Core fields:

- Corner speed strength.
- Braking strength.
- Throttle pickup.
- Traction exit.
- Straight-line speed.
- Energy deployment proxy.
- Confidence and segment quality.

### race_outcome_labels

One row per driver/race label.

Allowed labels:

- Finish band.
- Points finish.
- Podium flag.
- Top-five flag.
- DNF flag.
- Position delta.
- Teammate delta.
- Race pace rank.
- Strategy success proxy.
- Degradation risk class.
- Pit strategy effectiveness class.

### data_quality_labels

One row per feature entity or table slice.

Core fields:

- Feature completeness.
- Telemetry coverage.
- Weather coverage.
- Race-control availability.
- Position coverage.
- Proxy-heavy flag.
- Inferred-position flag.
- Traffic-proxy-only flag.
- Energy-proxy-only flag.
- Leakage risk level.

## Safe vs Unsafe Labels

Safe earlier:

- Finish band, not exact winner.
- Points finish.
- Teammate advantage.
- Race pace rank.
- DNF flag, with caution because sample size is small.
- Degradation risk class.

Safe only for post-race explanation:

- Strategy success proxy.
- Pit strategy effectiveness.
- Traffic-constrained stint labels.
- Position movement class.

Delay:

- Exact podium probability.
- Exact winner prediction.
- Exact overtake count.
- Incident prediction.
- Safety-car cause prediction.
- True ERS/battery behaviour.

## Leakage Risk Plan

Primary leakage risks:

- Using final classification as a feature to predict finish position.
- Using Race Analysis stints/pit effects to predict the same race.
- Using same-race telemetry after the race as pre-race features.
- Random row splits across drivers within the same race.
- Rolling windows that accidentally include future races.
- Feeding Strategy Lab outputs back into ML labels built from the same deterministic assumptions.

Feature boundaries:

| Feature set | Allowed inputs | Forbidden inputs |
| --- | --- | --- |
| Pre-race | Prior races, current event sessions already completed before cutoff, schedule, track archetype | Race result, race stints, pit effects, Race Analysis, final position |
| In-race | Laps/stints up to cutoff lap, weather/status up to cutoff | Future laps, final classification, post-race summaries |
| Post-race explanatory | Full race timing, stints, pit-cycle proxy, Race Analysis views | Future races |

Every ML-ready row needs `feature_cutoff`, `feature_set_type`, and `source_data_version`.

## Temporal Split Plan

Use temporal splits only:

- Train on past races.
- Validate on later races.
- Test on future held-out races.
- Never random-split rows from the same race across train/test.
- Group by race weekend to avoid same-race leakage.
- Keep 2026 regulation-era features separate.
- Treat 2020-2025 as a weak historical prior.
- Treat 2026 as active adaptation data, not enough by itself yet.

## Sample Size Assessment

Current usable completed Race Analysis coverage is 49 races and roughly 986 driver-race rows. That is enough for:

- Deterministic baselines.
- Simple historical averages.
- Leakage-safe logistic/ordinal baselines later.
- Feature validation and missingness analysis.

It is not enough for:

- Reliable exact winner/podium probabilities.
- Deep learning.
- Sequence models.
- Incident or safety-car prediction.
- Well-calibrated 2026-specific models.

Deterministic systems are likely to outperform ML for near-term product trust until more current-era races and representative telemetry exist.

## Governance and Versioning

Every future dataset must include:

- `feature_version`
- `label_version` where applicable
- `source_data_version`
- `generated_at`
- `feature_cutoff`
- `training_window`
- `feature_set_type`
- `missing_flags`
- `proxy_heavy_flag`
- `confidence` or `quality_score`

Every model later needs a model card:

- Intended use.
- Forbidden use.
- Training window.
- Feature/label versions.
- Temporal split.
- Known leakage controls.
- Calibration status.
- Proxy-data caveats.
- Performance by season/track archetype.

## Recommendation

Do not start ML training yet.

Before ML:

1. Implement Tier B representative telemetry selection.
2. Build leakage-safe `pre_race` driver/team/track feature tables.
3. Build labels separately from features.
4. Validate temporal cutoffs.
5. Run deterministic baselines as benchmarks.
