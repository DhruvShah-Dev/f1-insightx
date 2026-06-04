# Telemetry Coverage Upgrade Plan

Last audited: 2026-05-10

## Current Coverage

F1 InsightX currently stores FastF1 telemetry as precomputed offline artifacts. Runtime APIs and UI do not read raw telemetry.

Current local telemetry footprint:

| Layer | Artifact count | Size | Notes |
| --- | ---: | ---: | --- |
| Raw fastest-lap telemetry parquet | 648 | 128.04 MB | One fastest lap per driver per complete session where available |
| Raw fastest-lap position parquet | 647 | 115.82 MB | Matching fastest-lap position traces where available |
| Staged telemetry CSV | 0 | 0 MB | No staged telemetry trace layer |
| Telemetry feature CSVs | 7 | 75.86 MB | Lap, segment, braking, throttle, straight, energy proxy, driver delta |
| Analytics product CSVs | 8 | 581.60 MB | Pairwise product views; indexed for runtime |
| Race Analysis CSVs | 14 | 20.68 MB | Lap/position/traffic/status product views |

Raw telemetry availability by session type:

| Session | Sessions | Complete | Telemetry | Position |
| --- | ---: | ---: | ---: | ---: |
| FP1 | 135 | 132 | 132 | 131 |
| FP2 | 114 | 111 | 111 | 111 |
| FP3 | 108 | 105 | 105 | 105 |
| Q | 135 | 133 | 133 | 133 |
| R | 135 | 128 | 127 | 127 |
| S | 26 | 26 | 26 | 26 |
| SQ | 20 | 14 | 14 | 14 |

Telemetry feature coverage:

| Feature view | Rows | Primary grain |
| --- | ---: | --- |
| telemetry_lap_summary | 12,736 | session-driver-selected lap |
| corner_speed_profile | 101,704 | session-driver-selected lap-segment |
| corner_braking_profile | 101,704 | session-driver-selected lap-segment |
| corner_throttle_profile | 101,704 | session-driver-selected lap-segment |
| straight_speed_profile | 89,308 | session-driver-selected lap-straight |
| energy_deployment_proxy | 89,308 | session-driver-selected lap-straight |
| driver_corner_delta | 101,704 | session-driver-segment comparison |

The current downloader extracts each driver's fastest lap telemetry and position trace via FastF1. It does not store full-session telemetry, representative race laps, long-run windows, or complete race telemetry.

## What Is Discarded

The current pipeline discards, or never materializes:

- Non-fastest race laps.
- Median clean race laps.
- Representative stint laps.
- FP2 long-run telemetry windows.
- Wet-condition representative laps except when the fastest selected lap happens to be wet.
- Full race telemetry sequences.
- Per-lap car-ahead gaps and exact DRS eligibility.
- True ERS/battery state, which FastF1 does not expose.

## Upgrade Tiers

| Tier | Scope | Storage estimate | Rebuild/runtime cost | Product value | Recommendation |
| --- | --- | ---: | --- | --- | --- |
| A | Current fastest-lap telemetry and features | Current ~244 MB raw traces, ~76 MB feature CSVs | Low rebuild, no runtime raw reads | Strong for Analytics peak style, weak for race pace | Keep as baseline |
| B | Representative telemetry: fastest race lap, median clean race lap, best long-run lap, representative stint lap, best qualifying lap, wet representative lap where available | ~2x-4x raw trace size for selected laps, likely <1 GB total for 2020-2026 | Medium offline rebuild, runtime unchanged | High value for Analytics, Strategy Lab, Race Analysis | Implement next |
| C | Long-run telemetry: FP2 race sims and selected degradation windows | ~4x-8x current raw trace size depending windows | Medium/high offline rebuild | Very high for Strategy Lab tyre/traffic realism | Implement after Tier B |
| D | Expanded race telemetry for selected modern/featured races only | Per featured race can be 20x-60x a fastest-lap race trace | High offline rebuild; requires partitioning | High for flagship Race Analysis and demos | Use selectively |
| E | Full telemetry archive | Multi-GB to tens of GB as seasons grow | High storage, slow rebuilds, heavy validation | ML/replay value, low near-term product ROI | Do not implement yet |

Recommended path: Tier B first, then Tier C for current season and selected benchmark races. Tier D should be opt-in for featured completed races only. Tier E should wait until storage, partitioning, and ML objectives are explicit.

## Deterministic Selection Rules

Representative lap candidates should be selected offline from canonical laps first, then telemetry should be extracted only for chosen lap references.

Clean lap eligibility:

- `is_accurate == true` where available.
- Not deleted.
- Valid `lap_time_s`, sector times, compound, stint, and tyre life.
- Track status is green, or explicitly labelled as non-green context if selected.
- Exclude pit in/out laps using stint transitions.
- Exclude first lap, obvious cooldown laps, and laps with lap-time outliers.

Representative race laps:

- Fastest valid race lap per driver.
- Median clean race lap per driver by stint-adjusted lap time.
- Representative stint lap closest to median lap time for each driver/stint.
- Best long-run lap from stable stint windows with at least 5 clean laps.

Traffic-filtered laps:

- Prefer laps labelled `clean-air likely` from Race Analysis traffic proxy.
- Exclude pit-window laps.
- Down-rank neutralization-affected laps.
- If exact gaps are missing, keep `traffic_filter_confidence` below strong.

Long-run windows:

- Consecutive clean laps in FP2 or Race.
- Minimum 5 laps for a useful window; 8-12 laps preferred.
- Same compound and same stint.
- No pit window overlap.
- Stable track status and no rainfall transition unless building wet-specific windows.

Wet/dry representative laps:

- Dry: rainfall false, stable track temperature.
- Damp/wet: rainfall true or weather state not dry.
- Do not compare wet/dry pace directly without weather state tags.

## Proposed Product Views

### telemetry_clean_lap_index.csv

Purpose: select safe lap references before telemetry extraction.

Grain: session-driver-lap.

Key fields: `season`, `round`, `event`, `session`, `driver`, `lap_number`, `compound`, `stint`, `tyre_life`, `lap_time_s`, `track_status_label`, `traffic_proxy_label`, `clean_lap_score`, `selection_eligibility`, `exclusion_reason`.

Consumers: telemetry extraction, Analytics, Strategy Lab, Race Analysis, future ML.

Storage impact: small CSV.

### telemetry_representative_laps.csv

Purpose: define exactly which laps are extracted beyond fastest lap.

Grain: session-driver-selection type.

Key fields: `selection_type`, `lap_number`, `selection_rank`, `source_reason`, `quality_score`, `traffic_filter_confidence`, `weather_state`, `telemetry_required`.

Consumers: feature builder and product freshness.

Storage impact: small CSV; controls raw trace expansion.

### telemetry_long_run_windows.csv

Purpose: describe stable multi-lap telemetry windows without storing all traces blindly.

Grain: session-driver-window.

Key fields: `start_lap`, `end_lap`, `lap_count`, `compound`, `stint`, `median_pace_s`, `degradation_s_per_lap`, `track_status_context`, `window_quality_score`.

Consumers: Strategy Lab tyre model, Race Analysis stint story, future ML.

Storage impact: small CSV.

### telemetry_driver_style_profiles.csv

Purpose: aggregate driver behaviour across representative laps and long runs.

Grain: season-driver-session type or season-driver-track archetype.

Key fields: `braking_strength`, `throttle_pickup_strength`, `traction_exit_strength`, `straight_line_strength`, `traffic_sensitivity_proxy`, `energy_deployment_proxy_strength`, `sample_lap_count`, `confidence`.

Consumers: Strategy Lab, Analytics, future ML.

Storage impact: small CSV.

### telemetry_track_segments.csv

Purpose: stabilize approximate segment IDs and prepare future named segments.

Grain: circuit-segment.

Key fields: `segment_id`, `segment_kind`, `distance_start_m`, `distance_end_m`, `median_speed_kph`, `braking_frequency`, `throttle_pickup_frequency`, `confidence`, `manual_name_available`.

Consumers: Analytics, Race Analysis, named-segment roadmap.

Storage impact: small CSV.

### telemetry_braking_zones.csv

Purpose: improve braking comparison beyond fixed distance bins.

Grain: session-driver-lap-braking zone.

Key fields: `zone_id`, `start_distance_m`, `end_distance_m`, `braking_duration_s`, `min_speed_kph`, `brake_intensity_proxy`, `late_brake_score`, `confidence`.

Consumers: Analytics and future Race Analysis.

Storage impact: moderate, still product-view sized.

## Recommended Retention Strategy

Keep:

- Current Tier A fastest-lap telemetry for all complete sessions.
- Tier B representative telemetry for all current-season sessions and selected historical seasons.
- Tier C long-run windows for current season plus benchmark races.
- Tier D full race telemetry only for explicitly featured races.

Do not commit:

- Raw telemetry parquet.
- Position parquet.
- Expanded representative telemetry traces.
- Full-session telemetry traces.

Commit:

- Selection scripts.
- Product-view schemas.
- Validators/tests.
- Small manifests and docs.

## Product Honesty Rules

- Continue to call energy features `energy deployment proxy`.
- Do not use true ERS or battery language.
- Keep DRS/gap states as proxy unless exact timing gaps are ingested.
- Keep approximate segment wording until manual circuit metadata exists.
- Label traffic-filtered laps as likely/uncertain, not exact.

## Next Recommendation

Implement Tier B as a controlled offline extraction pass:

1. Build `telemetry_clean_lap_index.csv` from canonical laps, Race Analysis track status, and traffic proxy.
2. Build `telemetry_representative_laps.csv` without extracting telemetry.
3. Validate row counts, clean-lap coverage, and selected lap diversity.
4. Only then add an extraction command for selected laps.

