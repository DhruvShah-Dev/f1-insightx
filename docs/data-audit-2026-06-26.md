# F1 InsightX Data Audit And ML Readiness Review

Audit date: 2026-06-26
Scope: local generated data artifacts, validators, deterministic product heuristics, and pre-ML datasets in this repository.

## Overall Assessment

Status: share with caveats.

The current F1 InsightX data estate is internally consistent enough for deterministic product surfaces, analytics exploration, Strategy Lab baselines, and pre-ML feature validation. The existing validator suite passes across OpenF1 quality, canonical FastF1, telemetry features, analytics views, race analysis, ML schema templates, generated ML datasets, product manifest, generated artifact guard, Python tests, and web tests.

The main caveat is proxy interpretation. Race Analysis intentionally relies on inferred/proxy signals where exact gaps, overtakes, and race-control causes are unavailable. Release-time freshness and active-race coverage checks are tracked in `docs/manual-audit-tasks.md`.

## Raw Data Audit

The raw and staged layers are substantial and are treated as offline source archives, not runtime dependencies:

| Layer | Inventory | Primary use |
| --- | ---: | --- |
| `data/raw` | 2,195 JSON, 3,353 CSV, 1,324 parquet, 2 JSONL files | OpenF1, FastF1, reference snapshots, optional telemetry and position archives |
| `data/staged` | 5,199 CSV, 689 JSON files | normalized OpenF1 and FastF1 session extracts |
| `data/canonical_fastf1` | 361,422 laps, 13,261 results, 46,958 stints, 13,040 session-summary rows, 76 drivers | manifest-gated canonical session layer |

OpenF1 source quality passes validation. `data/staged/openf1/reports/openf1_race_quality.csv` has 70 rows, 69 available OpenF1 races, 55 primary cross-check rows, and mean coverage score 0.7592. Coverage and source agreement scores are numeric and bounded in `[0, 1]`; the required `openf1_quality_v1` source label is preserved.

Canonical FastF1 also passes validation. The canonical validator reports 660 sessions in laps/results/stints, 659 sessions in session summaries, and no validation errors. Weather propagation is effectively complete for canonical laps, with air temperature, track temperature, humidity, wind speed, and wind direction at 99.94% coverage and rainfall non-null at 100.0%.

Raw/staged risk assessment:

- Severity: medium. The source archive is broad, but freshness must be read through product manifests and quality reports rather than file modification time alone.
- Risk: partial or failed sessions may exist in raw/staged folders. The current canonical validator mitigates this by requiring manifest-gated complete sessions before records flow into canonical product tables.
- Recommended automation: keep the canonical manifest-gating check and OpenF1 quality validation in the release checklist; add no new hard-coded distribution thresholds until late-arriving session behavior is better characterized.

## Modeled Data Evaluation

The modeled product layers validate cleanly, with caveats clearly separated from errors.

| Surface | Evidence | Status |
| --- | --- | --- |
| Curated product views | `data/curated` includes races, drivers, constructors, standings, model features, prediction snapshots, fantasy inputs, and strategy profiles generated on 2026-06-17 | usable, no validator failure found |
| Canonical FastF1 | 361,422 lap rows, 13,261 result rows, 46,958 stint rows | passed |
| Telemetry features | 663 processed sessions, 0 sessions missing telemetry; 13,060 lap-summary rows and 91,569-104,289 segment/profile rows depending on artifact | passed |
| Analytics views | 663 session index rows; 122,479 driver comparisons; 975,725 segment/braking/throttle rows; 856,389 straight/energy-proxy rows | passed |
| Race Analysis | 52 race analyses; 58,465 pace-evolution rows; 58,392 position-timeline rows; 1,787 pit-strategy rows | passed with warnings |
| Strategy Lab | `strategy_lab_signal_quality.json` has model version `strategy_lab_model_v2`, 22 drivers with telemetry signals, 34 track archetype rows, and no validation errors | usable with freshness caveat |
| Product manifest | surfaces include analytics, analytics index, canonical FastF1, race analysis, race week, season state, strategy lab, and telemetry features | passed with warning |

Race Analysis warnings are expected and should remain stakeholder-visible:

- 335 stints have limited degradation confidence.
- Neutralization context is track-status-only; causes are unavailable.
- Position movement is inferred from lap-position timing data.
- Traffic proxy is built without exact gap data.
- Race-control messages are unavailable for 52 race analyses.

Analytical risk assessment:

- Severity: low to medium for Race Analysis caveats because the caveats are explicitly labeled and do not appear to be presented as exact overtakes, exact traffic gaps, or race-control causes.

## Heuristics Model Review

F1 InsightX is currently deterministic and heuristic-driven, not ML-driven. This distinction is important and should remain explicit in product and documentation language.

Reviewed heuristic families:

- Strategy Lab simulator: deterministic lap-time accumulation with bounded tyre degradation, pit-loss, traffic, weather, fuel, reliability, aggression, telemetry-proxy, and track-archetype modifiers.
- Telemetry proxy scoring: corner speed, braking, throttle, straight-line, and energy-deployment proxy features derived from precomputed telemetry artifacts.
- Pit Wall Picks scoring: exact position picks score 3 points, adjacent position picks score 1 point, incorrect picks score 0, and missing official results remain pending.
- Prediction/fantasy baseline outputs: deterministic product CSVs in `data/curated` and `data/predictions`, including `prediction_snapshots.csv`, `fantasy_inputs.csv`, `strategy_baselines.csv`, and `fastf1_prediction_snapshots.csv`.

Heuristic validation evidence:

- Web tests pass Strategy Lab scenario behavior, weather sensitivity, fuel correction, nonlinear tyre phases, traffic penalties, telemetry sensitivity, energy-proxy labeling, and Pit Wall Picks scoring.
- Strategy Lab signal quality has no validation errors and preserves the proxy note: energy deployment fields are proxy-derived from precomputed telemetry features only, not true ERS or battery state.
- Analytics product tests also enforce proxy-safe energy wording and cap comparison-detail payloads.

Model-risk assessment:

- Severity: medium. The heuristics are suitable for relative scenario comparison and product explanation, but not calibrated race prediction.
- Confidence: moderate. Tests cover important behavior and proxy labeling, but there is no standalone Strategy Lab data-layer validator equivalent to the analytics or race-analysis validators.
- Required caveat: win and podium fields should be treated as rounded odds proxies, not calibrated probabilities.
- Recommended automation: add a dedicated Strategy Lab validator if Strategy Lab becomes a release-critical surface for each upcoming race.

## Pre-ML Completeness

The pre-ML layer is ready for feature validation and deterministic baselines. It is not ready for training or shipping a predictive ML model.

Generated ML artifacts under `data/ml/generated` pass validation:

| Artifact | Rows | Role |
| --- | ---: | --- |
| `pre_race_driver_features.csv` | 1,090 | one row per driver/race pre-race feature set |
| `pre_race_team_features.csv` | 546 | one row per constructor/race pre-race feature set |
| `pre_race_track_features.csv` | 54 | one row per race/circuit context |
| `race_outcome_labels.csv` | 1,090 | post-race labels kept separate from features |
| `data_quality_labels.csv` | 1,690 | feature/entity quality and proxy metadata |

The generated ML validator checks the core leakage controls:

- Required feature governance columns exist, including feature version, source data version, generated timestamp, feature cutoff race, target race, feature set type, source race IDs, missing flags, proxy counts, proxy flags, proxy-heavy flag, and data quality score.
- Feature rows are `pre_race`.
- Feature source races must occur before the target race.
- Feature files reject label and post-race columns such as finish position, podium flag, DNF flag, teammate delta, label cutoff, and strategy success proxy.
- Labels are separate and include label quality, missing flags, and post-race cutoff metadata.
- Quality and confidence scores are bounded in `[0, 1]`.

ML readiness assessment:

- Ready now: leakage-safe dataset inspection, feature completeness analysis, missing/proxy flag review, deterministic benchmark design, and temporal-split planning.
- Not ready now: exact winner, exact podium, incident, safety-car cause, exact overtake, deep-learning, or calibrated 2026-specific predictive modeling.
- Minimum next steps before ML training: refresh current-state artifacts, lock temporal split policy, run a feature missingness/drift profile by season and race, build deterministic baselines as benchmarks, and write a model card template before any trained model is considered product-ready.

## Evidence Appendix

Commands run for this audit:

```bash
python validate_openf1_quality.py
python validate_canonical_fastf1.py
python validate_telemetry_features.py
python validate_analytics_views.py
python validate_race_analysis_views.py
python validate_ml_schema_templates.py
python validate_ml_datasets.py
python validate_product_manifest.py
python check_generated_artifacts.py
python -m pytest tests
npm run test --workspace web
```

Observed validation summary:

| Command | Result | Key evidence |
| --- | --- | --- |
| `python validate_openf1_quality.py` | passed | 70 report rows, 69 available OpenF1 races, mean coverage score 0.7592 |
| `python validate_canonical_fastf1.py` | passed | 361,422 laps, 13,261 results, no warnings or errors |
| `python validate_telemetry_features.py` | passed | 663 sessions processed, 0 sessions missing telemetry |
| `python validate_analytics_views.py` | passed | 663 expected telemetry sessions and 663 analytics sessions |
| `python validate_race_analysis_views.py` | passed with warnings | 52 race analyses and explicit proxy/availability caveats |
| `python validate_ml_schema_templates.py` | passed | 8 schema templates checked |
| `python validate_ml_datasets.py` | passed | 1,090 driver feature rows and 1,090 label rows |
| `python validate_product_manifest.py` | passed with warning | `season_state` stale by threshold |
| `python check_generated_artifacts.py` | passed | generated artifact guard passed |
| `python -m pytest tests` | passed | 37 Python tests passed |
| `npm run test --workspace web` | passed | 59 web tests passed |

## Assumptions

- This audit reviews local repository artifacts and does not perform a live source refresh.
- Existing generated artifacts are accepted as evidence unless a validator marks them stale or invalid.
- Freshness is evaluated through product reports and manifests, not file timestamps alone.
- Pre-ML readiness means readiness for feature validation and deterministic baselines, not model training or production ML deployment.
- Proxy-derived signals must remain labeled as proxy-only, especially energy deployment, traffic, overtakes, position movement, and race-control context.
