# Schema Outline

This is the initial relational model for v1. It is intentionally practical rather than exhaustive.

## Core reference tables

### `drivers`

- `id`
- `driver_code`
- `permanent_number`
- `first_name`
- `last_name`
- `full_name`
- `nationality`
- `date_of_birth`

### `constructors`

- `id`
- `constructor_code`
- `name`
- `nationality`

### `circuits`

- `id`
- `circuit_code`
- `name`
- `location`
- `country`
- `lat`
- `lng`
- `altitude_m`
- `track_length_km`
- `high_speed_bias`
- `overtake_difficulty`
- `tire_degradation_bias`

### `races`

- `id`
- `season`
- `round`
- `race_name`
- `official_name`
- `circuit_id`
- `scheduled_at`
- `sprint_weekend`

## Historical performance tables

### `qualifying_results`

- `id`
- `race_id`
- `driver_id`
- `constructor_id`
- `position`
- `q1_time_ms`
- `q2_time_ms`
- `q3_time_ms`
- `status`

### `race_results`

- `id`
- `race_id`
- `driver_id`
- `constructor_id`
- `grid_position`
- `finish_position`
- `finish_status`
- `points`
- `laps_completed`
- `fastest_lap_rank`

## Product-specific tables

### `fantasy_pricing`

- `id`
- `season`
- `round`
- `entity_type`
- `entity_id`
- `price`
- `source_label`

### `strategy_profiles`

- `id`
- `race_id`
- `driver_id`
- `expected_pit_stops`
- `tire_management_score`
- `overtake_score`
- `reliability_score`
- `wet_weather_score`
- `safety_car_gain_score`

### `predictions`

- `id`
- `created_at`
- `scenario_type`
- `input_payload`
- `result_payload`
- `confidence_label`

### `saved_lineups`

- `id`
- `created_at`
- `user_id` nullable in v1
- `budget`
- `strategy_style`
- `lineup_payload`
- `expected_score`

## V1 modeling notes

- keep derived scores denormalized where it improves query simplicity
- store scenario and lineup outputs as JSON payloads initially
- avoid auth-coupled schema until saved-user features are actually built
