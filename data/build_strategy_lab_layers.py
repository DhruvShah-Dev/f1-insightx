from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.settings import load_settings


SCENARIO_TEMPLATES: list[dict[str, Any]] = [
    {
        "scenario_code": "balanced_1_stop",
        "scenario_label": "Balanced one-stop",
        "pit_stop_count": 1,
        "compound_sequence": ["medium", "hard"],
        "stint_weights": [0.43, 0.57],
    },
    {
        "scenario_code": "defensive_1_stop",
        "scenario_label": "Defensive one-stop",
        "pit_stop_count": 1,
        "compound_sequence": ["hard", "medium"],
        "stint_weights": [0.48, 0.52],
    },
    {
        "scenario_code": "balanced_2_stop",
        "scenario_label": "Balanced two-stop",
        "pit_stop_count": 2,
        "compound_sequence": ["medium", "hard", "soft"],
        "stint_weights": [0.31, 0.39, 0.30],
    },
    {
        "scenario_code": "attack_2_stop",
        "scenario_label": "Attack two-stop",
        "pit_stop_count": 2,
        "compound_sequence": ["soft", "medium", "soft"],
        "stint_weights": [0.27, 0.41, 0.32],
    },
]

STRATEGY_LAB_MODEL_VERSION = "strategy_lab_model_v2"
STRATEGY_LAB_SCENARIO_TEMPLATE_VERSION = "strategy_templates_v1"
FUEL_CORRECTION_S_PER_LAP = 0.035
TELEMETRY_SIGNAL_FORMULAS = {
    "corner_speed_strength": "1 - mean speed_delta_vs_session_best normalized to a 0-35 kph practical range",
    "braking_strength": "mean late_brake_score and brake_intensity_proxy blend",
    "throttle_pickup_strength": "inverse normalized throttle_pickup_distance_m with traction_exit_score support",
    "traction_exit_strength": "mean traction_exit_score",
    "straight_line_strength": "terminal speed rank blended with straight acceleration_score",
    "energy_deployment_proxy_strength": "mean deployment_proxy_score; proxy only, not ERS/battery state",
    "lift_and_coast_tendency": "mean high-speed low-throttle non-brake proxy",
    "clipping_risk_proxy": "mean speed plateau proxy on straights",
}
DRIVER_CODE_FALLBACK = {
    "albon": "ALB",
    "alonso": "ALO",
    "antonelli": "ANT",
    "bearman": "BEA",
    "bottas": "BOT",
    "colapinto": "COL",
    "doohan": "DOO",
    "gasly": "GAS",
    "hadjar": "HAD",
    "hamilton": "HAM",
    "hulkenberg": "HUL",
    "lawson": "LAW",
    "leclerc": "LEC",
    "max_verstappen": "VER",
    "norris": "NOR",
    "ocon": "OCO",
    "perez": "PER",
    "piastri": "PIA",
    "russell": "RUS",
    "sainz": "SAI",
    "stroll": "STR",
    "tsunoda": "TSU",
    "zhou": "ZHO",
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def ensure_columns(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=columns)
    normalized = frame.copy()
    for column in columns:
        if column not in normalized.columns:
            normalized[column] = None
    return normalized[columns]


def build_materialization_metadata(prefix: str) -> tuple[str, str]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    build_version = f"{prefix}_{generated_at.replace('-', '').replace(':', '')}"
    return generated_at, build_version


def clamp01(value: float | int | None, default: float = 0.0) -> float:
    if value is None or pd.isna(value):
        return default
    return max(0.0, min(1.0, float(value)))


def parse_num(value: Any, default: float | None = None) -> float | None:
    if value is None or value == "" or pd.isna(value):
        return default
    return float(value)


def frame_value(frame: pd.DataFrame, column: str, default: Any = None) -> Any:
    if frame.empty or column not in frame.columns:
        return default
    value = frame.iloc[0][column]
    if pd.isna(value):
        return default
    return value


def classify_race_difficulty(value: float | None) -> str:
    if value is None:
        return "Balanced"
    if value >= 72:
        return "High"
    if value >= 54:
        return "Medium"
    return "Low"


def infer_nominal_race_laps(race_id: str, races: pd.DataFrame, race_results: pd.DataFrame) -> int:
    race_row = races[races["id"] == race_id].head(1)
    if race_row.empty:
        return 57
    circuit_id = str(race_row.iloc[0]["circuit_id"])
    circuit_race_ids = races[races["circuit_id"].astype(str) == circuit_id]["id"].astype(str).tolist()
    same_circuit_results = race_results[race_results["race_id"].astype(str).isin(circuit_race_ids)].copy()
    same_circuit_results["laps_completed"] = pd.to_numeric(same_circuit_results["laps_completed"], errors="coerce")
    if same_circuit_results["laps_completed"].notna().any():
        return int(round(float(same_circuit_results["laps_completed"].median())))
    return 57


def default_compound_delta(compound: str) -> float:
    return {
        "soft": -0.35,
        "medium": 0.0,
        "hard": 0.42,
        "intermediate": 1.15,
        "wet": 2.0,
    }.get(compound, 0.0)


def default_compound_degradation(compound: str) -> float:
    return {
        "soft": 0.095,
        "medium": 0.065,
        "hard": 0.045,
        "intermediate": 0.082,
        "wet": 0.07,
    }.get(compound, 0.06)


def build_stint_lengths(total_laps: int, compounds: list[str], weights: list[float], max_lengths: dict[str, int]) -> list[int]:
    if len(compounds) == 1:
        return [total_laps]
    weighted = [max(6, int(round(total_laps * weight))) for weight in weights]
    total = sum(weighted)
    weighted[-1] += total_laps - total
    lengths: list[int] = []
    remaining = total_laps
    for index, compound in enumerate(compounds):
        if index == len(compounds) - 1:
            lengths.append(max(1, remaining))
            continue
        max_len = max_lengths.get(compound, max(10, int(total_laps / len(compounds))))
        chosen = max(6, min(max_len, weighted[index], remaining - (len(compounds) - index - 1) * 6))
        lengths.append(chosen)
        remaining -= chosen
    return lengths


def simulate_strategy(
    *,
    base_race_pace_s: float,
    pace_evolution_s_per_lap: float,
    pit_loss_s: float,
    total_laps: int,
    compounds: list[str],
    stint_lengths: list[int],
    compound_deltas: dict[str, float],
    compound_degradation: dict[str, float],
    tyre_management_score: float,
    pit_efficiency_adjustment_s: float,
    aggression_score: float,
    energy_deployment_proxy_score: float = 0.5,
    race_season: int = 2025,
) -> tuple[float, float]:
    cumulative_time = 0.0
    global_lap = 0
    degradation_samples: list[float] = []

    for stint_index, compound in enumerate(compounds):
        stint_laps = stint_lengths[min(stint_index, len(stint_lengths) - 1)]
        degradation_rate = max(0.01, compound_degradation.get(compound, 0.06) * (1.08 - tyre_management_score * 0.35))
        compound_delta = compound_deltas.get(compound, 0.0)
        for stint_lap in range(1, stint_laps + 1):
            global_lap += 1
            fuel_offset = (total_laps - global_lap - total_laps / 2) * FUEL_CORRECTION_S_PER_LAP
            pace_evolution = global_lap * pace_evolution_s_per_lap * (1.0 - aggression_score * 0.08)
            phase = stint_lap / max(stint_laps, 1)
            plateau = 0.55 if phase < 0.45 else 1.0 if phase < 0.78 else 1.35
            cliff_start = 0.82 if compound == "soft" else 0.88 if compound == "medium" else 0.93
            cliff = ((phase - cliff_start) / max(1 - cliff_start, 0.01)) ** 2 if phase > cliff_start else 0.0
            nonlinear_degradation = max(0.0, (stint_lap - 1) * degradation_rate * plateau + cliff * degradation_rate * 8)
            warmup_penalty = (0.32 if compound == "hard" else 0.18 if compound == "medium" else 0.10) if stint_lap == 1 else 0.0
            energy_proxy_offset = -(energy_deployment_proxy_score - 0.5) * 0.05 * phase if race_season >= 2026 else 0.0
            lap_time = base_race_pace_s + compound_delta + fuel_offset + pace_evolution + nonlinear_degradation + warmup_penalty + energy_proxy_offset
            cumulative_time += lap_time
        degradation_samples.append(degradation_rate)
        if stint_index < len(compounds) - 1:
            cumulative_time += max(16.0, pit_loss_s + pit_efficiency_adjustment_s - aggression_score * 0.35)

    return round(cumulative_time, 3), round(sum(degradation_samples) / max(len(degradation_samples), 1), 4)


def telemetry_energy_score(energy_proxy: pd.DataFrame, driver_code: str, season: int, round_number: int) -> float:
    if energy_proxy.empty or not driver_code or "deployment_proxy_score" not in energy_proxy.columns:
        return 0.5
    frame = energy_proxy[energy_proxy["driver"].astype(str).str.upper() == driver_code.upper()].copy()
    if frame.empty:
        return 0.5
    frame["season"] = pd.to_numeric(frame["season"], errors="coerce")
    frame["round"] = pd.to_numeric(frame["round"], errors="coerce")
    same_event = frame[(frame["season"] == season) & (frame["round"] == round_number)]
    prior = frame[(frame["season"] < season) | ((frame["season"] == season) & (frame["round"] < round_number))]
    source = same_event if not same_event.empty else prior if not prior.empty else frame
    scores = pd.to_numeric(source["deployment_proxy_score"], errors="coerce").dropna()
    if scores.empty:
        return 0.5
    confidence_multiplier = 1.0 if not same_event.empty else 0.35
    return round(0.5 + (float(scores.tail(80).mean()) - 0.5) * confidence_multiplier, 6)


def bounded_score(value: Any, default: float = 0.5) -> float:
    if value is None or pd.isna(value):
        return default
    return round(max(0.0, min(1.0, float(value))), 6)


def event_slug(value: Any) -> str:
    text = str(value or "").lower()
    return "".join(char if char.isalnum() else "-" for char in text).strip("-")


def driver_code_for(driver_id: str, driver_code_map: dict[str, Any]) -> str:
    mapped = str(driver_code_map.get(driver_id, "") or "")
    return mapped if mapped else DRIVER_CODE_FALLBACK.get(driver_id, "")


def driver_signal_source(frame: pd.DataFrame, driver_code: str, season: int, round_number: int) -> tuple[pd.DataFrame, float]:
    if frame.empty or not driver_code or "driver" not in frame.columns:
        return pd.DataFrame(), 0.0
    source = frame[frame["driver"].astype(str).str.upper() == driver_code.upper()].copy()
    if source.empty:
        return pd.DataFrame(), 0.0
    source["season"] = pd.to_numeric(source["season"], errors="coerce")
    source["round"] = pd.to_numeric(source["round"], errors="coerce")
    same_event = source[(source["season"] == season) & (source["round"] == round_number)]
    prior = source[(source["season"] < season) | ((source["season"] == season) & (source["round"] < round_number))]
    if not same_event.empty:
        return same_event, 1.0
    if not prior.empty:
        return prior.tail(240), 0.55
    return source.tail(240), 0.35


def telemetry_strategy_signals(
    *,
    driver_code: str,
    season: int,
    round_number: int,
    corner_speed: pd.DataFrame,
    corner_braking: pd.DataFrame,
    corner_throttle: pd.DataFrame,
    straight_speed: pd.DataFrame,
    energy_proxy: pd.DataFrame,
    lap_summary: pd.DataFrame,
    track_position_sensitivity: float,
    degradation_anchor: float,
) -> dict[str, Any]:
    speed_source, speed_conf = driver_signal_source(corner_speed, driver_code, season, round_number)
    braking_source, braking_conf = driver_signal_source(corner_braking, driver_code, season, round_number)
    throttle_source, throttle_conf = driver_signal_source(corner_throttle, driver_code, season, round_number)
    straight_source, straight_conf = driver_signal_source(straight_speed, driver_code, season, round_number)
    energy_source, energy_conf = driver_signal_source(energy_proxy, driver_code, season, round_number)
    lap_source, lap_conf = driver_signal_source(lap_summary, driver_code, season, round_number)

    corner_delta = pd.to_numeric(speed_source.get("speed_delta_vs_session_best"), errors="coerce") if not speed_source.empty else pd.Series(dtype=float)
    corner_speed_strength = bounded_score(1 - float(corner_delta.mean()) / 35.0) if corner_delta.notna().any() else 0.5
    late_brake = pd.to_numeric(braking_source.get("late_brake_score"), errors="coerce") if not braking_source.empty else pd.Series(dtype=float)
    brake_intensity = pd.to_numeric(braking_source.get("brake_intensity_proxy"), errors="coerce") if not braking_source.empty else pd.Series(dtype=float)
    braking_strength = bounded_score(late_brake.mean() * 0.65 + brake_intensity.mean() * 0.35) if late_brake.notna().any() else 0.5
    pickup = pd.to_numeric(throttle_source.get("throttle_pickup_distance_m"), errors="coerce") if not throttle_source.empty else pd.Series(dtype=float)
    traction = pd.to_numeric(throttle_source.get("traction_exit_score"), errors="coerce") if not throttle_source.empty else pd.Series(dtype=float)
    throttle_pickup_strength = bounded_score((1 - pickup.rank(pct=True).mean()) * 0.55 + traction.mean() * 0.45) if pickup.notna().any() and traction.notna().any() else 0.5
    traction_exit_strength = bounded_score(traction.mean()) if traction.notna().any() else 0.5
    terminal_speed = pd.to_numeric(straight_source.get("terminal_speed_kph"), errors="coerce") if not straight_source.empty else pd.Series(dtype=float)
    acceleration = pd.to_numeric(straight_source.get("acceleration_score"), errors="coerce") if not straight_source.empty else pd.Series(dtype=float)
    straight_line_strength = bounded_score(terminal_speed.rank(pct=True).mean() * 0.55 + acceleration.mean() * 0.45) if terminal_speed.notna().any() else 0.5
    deployment = pd.to_numeric(energy_source.get("deployment_proxy_score"), errors="coerce") if not energy_source.empty else pd.Series(dtype=float)
    lift_coast = pd.to_numeric(energy_source.get("lift_and_coast_score"), errors="coerce") if not energy_source.empty else pd.Series(dtype=float)
    clipping = pd.to_numeric(energy_source.get("clipping_proxy_score"), errors="coerce") if not energy_source.empty else pd.Series(dtype=float)
    energy_strength = bounded_score(deployment.mean()) if deployment.notna().any() else 0.5
    lift_and_coast = bounded_score(lift_coast.mean(), 0.0) if lift_coast.notna().any() else 0.0
    clipping_risk = bounded_score(clipping.mean(), 0.0) if clipping.notna().any() else 0.0
    braking_pct = pd.to_numeric(lap_source.get("braking_pct"), errors="coerce") if not lap_source.empty else pd.Series(dtype=float)
    full_throttle_pct = pd.to_numeric(lap_source.get("full_throttle_pct"), errors="coerce") if not lap_source.empty else pd.Series(dtype=float)
    tyre_stress = bounded_score((braking_pct.mean() / 28.0) * 0.45 + (full_throttle_pct.mean() / 100.0) * 0.25 + clipping_risk * 0.15 + lift_and_coast * 0.15) if braking_pct.notna().any() else 0.5

    overtaking_attack = bounded_score(straight_line_strength * 0.34 + braking_strength * 0.24 + energy_strength * 0.22 + corner_speed_strength * 0.2)
    defending_strength = bounded_score(straight_line_strength * 0.36 + traction_exit_strength * 0.24 + energy_strength * 0.24 + braking_strength * 0.16)
    traffic_sensitivity = bounded_score(track_position_sensitivity * 0.65 + (1 - overtaking_attack) * 0.35)
    undercut_suitability = bounded_score(tyre_stress * 0.36 + traffic_sensitivity * 0.22 + throttle_pickup_strength * 0.18 + overtaking_attack * 0.14 + (1 - lift_and_coast) * 0.1)
    high_degradation_risk = bounded_score(min(degradation_anchor, 0.18) / 0.18 * 0.5 + tyre_stress * 0.5)
    proxy_confidence = round(max(0.0, min(1.0, (speed_conf + braking_conf + throttle_conf + straight_conf + energy_conf + lap_conf) / 6)), 6)

    return {
        "corner_speed_strength": corner_speed_strength,
        "braking_strength": braking_strength,
        "throttle_pickup_strength": throttle_pickup_strength,
        "traction_exit_strength": traction_exit_strength,
        "straight_line_strength": straight_line_strength,
        "energy_deployment_proxy_strength": energy_strength,
        "lift_and_coast_tendency": lift_and_coast,
        "clipping_risk_proxy": clipping_risk,
        "overtaking_attack_score": overtaking_attack,
        "defending_strength_score": defending_strength,
        "tyre_stress_proxy": tyre_stress,
        "traffic_sensitivity_score": traffic_sensitivity,
        "undercut_suitability_score": undercut_suitability,
        "high_degradation_risk_score": high_degradation_risk,
        "telemetry_proxy_confidence": proxy_confidence,
        "telemetry_signal_source": "same_event" if proxy_confidence >= 0.95 else "historical_prior" if proxy_confidence > 0 else "fallback",
    }


def track_archetype_from_features(
    event_name: str,
    corner_speed: pd.DataFrame,
    corner_braking: pd.DataFrame,
    corner_throttle: pd.DataFrame,
    straight_speed: pd.DataFrame,
    stints: pd.DataFrame,
) -> dict[str, Any]:
    slug = event_slug(event_name)
    event_filter = lambda frame: frame[frame["event"].astype(str).map(event_slug).str.contains(slug[:10], na=False)] if not frame.empty and "event" in frame.columns else pd.DataFrame()
    corners = event_filter(corner_speed)
    braking = event_filter(corner_braking)
    throttle = event_filter(corner_throttle)
    straights = event_filter(straight_speed)
    event_stints = stints[stints["event_name"].astype(str).map(event_slug).str.contains(slug[:10], na=False)] if not stints.empty and "event_name" in stints.columns else pd.DataFrame()

    straight_score = bounded_score(pd.to_numeric(straights.get("terminal_speed_kph"), errors="coerce").mean() / 340.0 * 0.6 + pd.to_numeric(straights.get("acceleration_score"), errors="coerce").mean() * 0.4) if not straights.empty else 0.5
    braking_score = bounded_score(pd.to_numeric(braking.get("brake_intensity_proxy"), errors="coerce").mean() * 1.9) if not braking.empty else 0.5
    traction_score = bounded_score(1 - pd.to_numeric(throttle.get("traction_exit_score"), errors="coerce").mean()) if not throttle.empty else 0.5
    degradation_score = bounded_score(pd.to_numeric(event_stints.get("degradation_per_lap_s"), errors="coerce").clip(lower=0, upper=0.18).mean() / 0.18) if not event_stints.empty else 0.5
    track_position_score = bounded_score((1 - straight_score) * 0.5 + traction_score * 0.28 + braking_score * 0.22)

    weights = {
        "straight_line_weight": straight_score,
        "braking_weight": braking_score,
        "traction_weight": traction_score,
        "degradation_weight": degradation_score,
        "track_position_weight": track_position_score,
    }
    dominant = max(weights.items(), key=lambda item: item[1])[0]
    archetype = {
        "straight_line_weight": "power-sensitive",
        "braking_weight": "braking-heavy",
        "traction_weight": "traction-sensitive",
        "degradation_weight": "high-degradation",
        "track_position_weight": "track-position-dominant",
    }.get(dominant, "mixed")
    if max(weights.values()) - min(weights.values()) < 0.18:
        archetype = "mixed"
    return {
        "track_archetype": archetype,
        **{key: round(value, 6) for key, value in weights.items()},
        "archetype_confidence": 0.62 if not straights.empty and not corners.empty else 0.35,
    }


def rank01(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.notna().sum() <= 1:
        return pd.Series(0.5, index=series.index)
    return numeric.rank(pct=True).fillna(0.5)


def build_track_archetype_table(
    corner_speed: pd.DataFrame,
    corner_braking: pd.DataFrame,
    corner_throttle: pd.DataFrame,
    straight_speed: pd.DataFrame,
    lap_summary: pd.DataFrame,
    stints: pd.DataFrame,
) -> pd.DataFrame:
    if straight_speed.empty and corner_speed.empty:
        return pd.DataFrame()

    def with_slug(frame: pd.DataFrame, event_column: str = "event") -> pd.DataFrame:
        if frame.empty or event_column not in frame.columns:
            return pd.DataFrame()
        copy = frame.copy()
        copy["event_slug"] = copy[event_column].map(event_slug)
        return copy

    corner = with_slug(corner_speed)
    braking = with_slug(corner_braking)
    throttle = with_slug(corner_throttle)
    straight = with_slug(straight_speed)
    laps = with_slug(lap_summary)
    stint_frame = with_slug(stints, "event_name")

    event_index = sorted(
        set(corner.get("event_slug", pd.Series(dtype=str)).dropna())
        | set(braking.get("event_slug", pd.Series(dtype=str)).dropna())
        | set(throttle.get("event_slug", pd.Series(dtype=str)).dropna())
        | set(straight.get("event_slug", pd.Series(dtype=str)).dropna())
        | set(laps.get("event_slug", pd.Series(dtype=str)).dropna())
    )
    rows = pd.DataFrame({"event_slug": event_index})
    if rows.empty:
        return rows

    if not corner.empty:
        corner_agg = corner.groupby("event_slug").agg(
            race_name=("event", "last"),
            apex_speed_mean=("apex_speed_kph", "mean"),
            corner_count=("corner_id", "nunique"),
        )
        rows = rows.merge(corner_agg, on="event_slug", how="left")
    if not braking.empty:
        braking_agg = braking.groupby("event_slug").agg(
            brake_intensity_mean=("brake_intensity_proxy", "mean"),
            late_brake_mean=("late_brake_score", "mean"),
        )
        rows = rows.merge(braking_agg, on="event_slug", how="left")
    if not throttle.empty:
        throttle_agg = throttle.groupby("event_slug").agg(
            traction_exit_mean=("traction_exit_score", "mean"),
            throttle_pickup_distance_mean=("throttle_pickup_distance_m", "mean"),
        )
        rows = rows.merge(throttle_agg, on="event_slug", how="left")
    if not straight.empty:
        straight_agg = straight.groupby("event_slug").agg(
            terminal_speed_mean=("terminal_speed_kph", "mean"),
            acceleration_mean=("acceleration_score", "mean"),
            clipping_mean=("clipping_proxy_score", "mean"),
            straight_count=("segment_id", "nunique"),
        )
        rows = rows.merge(straight_agg, on="event_slug", how="left")
    if not laps.empty:
        lap_agg = laps.groupby("event_slug").agg(
            avg_speed_mean=("avg_speed_kph", "mean"),
            full_throttle_mean=("full_throttle_pct", "mean"),
            braking_pct_mean=("braking_pct", "mean"),
        )
        rows = rows.merge(lap_agg, on="event_slug", how="left")
    if not stint_frame.empty and "degradation_per_lap_s" in stint_frame.columns:
        stint_agg = stint_frame.groupby("event_slug").agg(
            degradation_mean=("degradation_per_lap_s", lambda series: pd.to_numeric(series, errors="coerce").clip(lower=0, upper=0.18).mean())
        )
        rows = rows.merge(stint_agg, on="event_slug", how="left")

    for column in [
        "apex_speed_mean", "brake_intensity_mean", "late_brake_mean", "traction_exit_mean",
        "throttle_pickup_distance_mean", "terminal_speed_mean", "acceleration_mean", "clipping_mean",
        "avg_speed_mean", "full_throttle_mean", "braking_pct_mean", "degradation_mean",
    ]:
        if column not in rows.columns:
            rows[column] = pd.NA

    terminal_rank = rank01(rows["terminal_speed_mean"])
    avg_speed_rank = rank01(rows["avg_speed_mean"])
    full_throttle_rank = rank01(rows["full_throttle_mean"])
    acceleration_rank = rank01(rows["acceleration_mean"])
    brake_pct_rank = rank01(rows["braking_pct_mean"])
    brake_intensity_rank = rank01(rows["brake_intensity_mean"])
    late_brake_rank = rank01(rows["late_brake_mean"])
    apex_rank = rank01(rows["apex_speed_mean"])
    traction_exit_rank = rank01(rows["traction_exit_mean"])
    pickup_rank = rank01(rows["throttle_pickup_distance_mean"])
    degradation_rank = rank01(rows["degradation_mean"])
    clipping_rank = rank01(rows["clipping_mean"])
    corner_count_rank = rank01(rows.get("corner_count", pd.Series(0.5, index=rows.index)))

    rows["straight_line_weight"] = (terminal_rank * 0.45 + avg_speed_rank * 0.20 + full_throttle_rank * 0.20 + acceleration_rank * 0.15).clip(0, 1)
    rows["braking_weight"] = (brake_pct_rank * 0.35 + brake_intensity_rank * 0.35 + late_brake_rank * 0.30).clip(0, 1)
    rows["traction_weight"] = ((1 - apex_rank) * 0.25 + (1 - traction_exit_rank) * 0.35 + pickup_rank * 0.25 + (1 - avg_speed_rank) * 0.15).clip(0, 1)
    rows["degradation_weight"] = (degradation_rank * 0.65 + clipping_rank * 0.15 + brake_pct_rank * 0.20).clip(0, 1)
    rows["track_position_weight"] = ((1 - rows["straight_line_weight"]) * 0.34 + rows["traction_weight"] * 0.26 + rows["braking_weight"] * 0.14 + corner_count_rank * 0.26).clip(0, 1)

    label_map = {
        "straight_line_weight": "power-sensitive",
        "braking_weight": "braking-heavy",
        "traction_weight": "traction-sensitive",
        "degradation_weight": "high-degradation",
        "track_position_weight": "track-position-dominant",
    }
    weight_columns = list(label_map)
    labels: list[str] = []
    confidence: list[float] = []
    for _, row in rows.iterrows():
        weights = {column: float(row[column]) for column in weight_columns}
        ordered = sorted(weights.items(), key=lambda item: item[1], reverse=True)
        spread = ordered[0][1] - ordered[-1][1]
        labels.append("mixed" if spread < 0.16 else label_map[ordered[0][0]])
        confidence.append(round(max(0.25, min(0.86, 0.35 + spread * 0.9)), 6))

    rows["track_archetype"] = labels
    rows["archetype_confidence"] = confidence
    rows["race_name"] = rows["race_name"].fillna(rows["event_slug"].str.replace("-", " ").str.title()) if "race_name" in rows.columns else rows["event_slug"].str.replace("-", " ").str.title()
    rows["id"] = rows["event_slug"]
    rows["race_id"] = rows["event_slug"]
    rows["season"] = None
    rows["round"] = None
    rows["formula_note"] = "normalized telemetry-feature archetype; approximate circuit segmentation, bounded multi-label weights"
    rows["source_label"] = "strategy_lab_track_archetype_v2"
    output_columns = [
        "id", "season", "round", "race_id", "race_name", "track_archetype", "straight_line_weight",
        "braking_weight", "traction_weight", "degradation_weight", "track_position_weight",
        "archetype_confidence", "formula_note", "source_label",
    ]
    for column in weight_columns:
        rows[column] = rows[column].round(6)
    return rows[output_columns].sort_values("race_name").reset_index(drop=True)


def resolve_track_archetype(race_name: str, archetypes: pd.DataFrame) -> dict[str, Any]:
    if archetypes.empty:
        return {
            "track_archetype": "mixed",
            "straight_line_weight": 0.5,
            "braking_weight": 0.5,
            "traction_weight": 0.5,
            "degradation_weight": 0.5,
            "track_position_weight": 0.5,
            "archetype_confidence": 0.25,
        }
    slug = event_slug(race_name)
    exact = archetypes[archetypes["id"].astype(str) == slug]
    if exact.empty:
        exact = archetypes[archetypes["id"].astype(str).str.contains(slug[:10], na=False)]
    row = exact.iloc[0] if not exact.empty else archetypes.iloc[0]
    return {
        "track_archetype": row["track_archetype"],
        "straight_line_weight": float(row["straight_line_weight"]),
        "braking_weight": float(row["braking_weight"]),
        "traction_weight": float(row["traction_weight"]),
        "degradation_weight": float(row["degradation_weight"]),
        "track_position_weight": float(row["track_position_weight"]),
        "archetype_confidence": float(row["archetype_confidence"]),
    }


def main() -> None:
    settings = load_settings()
    strategy_lab_dir = settings.strategy_lab_dir
    strategy_lab_dir.mkdir(parents=True, exist_ok=True)

    curated = settings.curated_dir
    race_week = settings.race_week_dir

    races = read_csv(curated / "races.csv")
    race_results = read_csv(curated / "race_results.csv")
    drivers = read_csv(curated / "drivers.csv")
    constructors = read_csv(curated / "constructors.csv")

    race_week_overview = read_csv(race_week / "race_week_overview.csv")
    race_week_driver_board = read_csv(race_week / "race_week_driver_board.csv")
    race_week_strategy = read_csv(race_week / "race_week_strategy.csv")
    driver_features = read_csv(race_week / "driver_features.csv")
    constructor_features = read_csv(race_week / "constructor_features.csv")
    race_context_features = read_csv(race_week / "race_context_features.csv")
    driver_signals = read_csv(race_week / "driver_signals.csv")
    constructor_signals = read_csv(race_week / "constructor_signals.csv")
    race_week_confidence = read_csv(race_week / "race_week_confidence.csv")
    telemetry_lap_summary = read_csv(settings.strategy_lab_dir.parent / "telemetry_features" / "telemetry_lap_summary.csv")
    corner_speed = read_csv(settings.strategy_lab_dir.parent / "telemetry_features" / "corner_speed_profile.csv")
    corner_braking = read_csv(settings.strategy_lab_dir.parent / "telemetry_features" / "corner_braking_profile.csv")
    corner_throttle = read_csv(settings.strategy_lab_dir.parent / "telemetry_features" / "corner_throttle_profile.csv")
    straight_speed = read_csv(settings.strategy_lab_dir.parent / "telemetry_features" / "straight_speed_profile.csv")
    energy_proxy = read_csv(settings.strategy_lab_dir.parent / "telemetry_features" / "energy_deployment_proxy.csv")
    canonical_stints = read_csv(settings.canonical_fastf1_dir / "stints_canonical.csv")

    driver_name_map = dict(zip(drivers["id"], drivers["full_name"])) if not drivers.empty else {}
    driver_code_map = dict(zip(drivers["id"], drivers["driver_code"])) if not drivers.empty and "driver_code" in drivers.columns else {}
    constructor_name_map = dict(zip(constructors["id"], constructors["name"])) if not constructors.empty else {}
    overview_rows: list[dict[str, Any]] = []
    strategy_feature_rows: list[dict[str, Any]] = []
    driver_profile_rows: list[dict[str, Any]] = []
    constructor_profile_rows: list[dict[str, Any]] = []
    comparison_rows: list[dict[str, Any]] = []
    pit_window_rows: list[dict[str, Any]] = []
    projection_rows: list[dict[str, Any]] = []
    telemetry_signal_rows: list[dict[str, Any]] = []
    all_track_archetypes = build_track_archetype_table(
        corner_speed,
        corner_braking,
        corner_throttle,
        straight_speed,
        telemetry_lap_summary,
        canonical_stints,
    )
    strategy_lab_generated_at, strategy_lab_build_version = build_materialization_metadata("strategy_lab")

    for _, overview_row in race_week_overview.iterrows():
        race_id = str(overview_row["race_id"])
        season = int(overview_row["season"])
        round_number = int(overview_row["round"])
        circuit_id = str(overview_row["circuit_id"])
        race_name = str(overview_row["race_name"])
        context_row = race_context_features[race_context_features["race_id"].astype(str) == race_id].head(1)
        context_signal = race_week_confidence[
            (race_week_confidence["race_id"].astype(str) == race_id)
            & (race_week_confidence["entity_type"].astype(str) == "race")
        ].head(1)
        degradation_bias = parse_num(context_row["tire_degradation_bias"].iloc[0], 5.0) if not context_row.empty else 5.0
        overtake_difficulty = parse_num(context_row["overtake_difficulty"].iloc[0], 5.0) if not context_row.empty else 5.0
        high_speed_bias = parse_num(context_row["high_speed_bias"].iloc[0], 5.0) if not context_row.empty else 5.0
        strategic_complexity_score = parse_num(context_row["strategic_complexity_score"].iloc[0], 58.0) if not context_row.empty else 58.0
        nominal_race_laps = infer_nominal_race_laps(race_id, races, race_results)
        track_signals = resolve_track_archetype(race_name, all_track_archetypes)
        pit_loss_estimate_s = round(17.5 + overtake_difficulty * 0.72 + high_speed_bias * 0.28, 2)
        driver_board_for_race = race_week_driver_board[race_week_driver_board["race_id"].astype(str) == race_id].copy()
        strategy_for_race = race_week_strategy[race_week_strategy["race_id"].astype(str) == race_id].copy()
        driver_features_for_race = driver_features[driver_features["race_id"].astype(str) == race_id].copy()
        driver_signals_for_race = driver_signals[driver_signals["race_id"].astype(str) == race_id].copy()
        constructor_features_for_race = constructor_features[constructor_features["race_id"].astype(str) == race_id].copy()
        constructor_signals_for_race = constructor_signals[constructor_signals["race_id"].astype(str) == race_id].copy()
        feature_build_version = str(overview_row.get("build_version") or "")

        constructor_profile_map: dict[str, dict[str, Any]] = {}
        for _, constructor_row in constructor_features_for_race.iterrows():
            constructor_id = str(constructor_row["constructor_id"])
            signal_row = constructor_signals_for_race[constructor_signals_for_race["constructor_id"].astype(str) == constructor_id].head(1)
            pit_efficiency_score = clamp01(
                (
                    (parse_num(signal_row["strategy_signal"].iloc[0], 0.5) if not signal_row.empty else 0.5) * 0.55
                    + clamp01(parse_num(constructor_row["reliability_score"], 0.6), 0.6) * 0.45
                ),
                0.55,
            )
            pit_loss_adjustment_s = round((0.55 - pit_efficiency_score) * 1.6, 3)
            strategy_success_proxy = round(
                clamp01(
                    (parse_num(signal_row["overall_signal"].iloc[0], 0.5) if not signal_row.empty else 0.5) * 0.6
                    + pit_efficiency_score * 0.4,
                    0.5,
                ),
                6,
            )
            double_stack_risk_score = round(clamp01(1 - pit_efficiency_score * 0.7, 0.3), 6)
            confidence_score = round(clamp01(parse_num(signal_row["overall_signal"].iloc[0], 0.45) if not signal_row.empty else 0.45, 0.45), 6)
            constructor_profile = {
                "id": f"{race_id}|{constructor_id}",
                "season": season,
                "round": round_number,
                "race_id": race_id,
                "constructor_id": constructor_id,
                "pit_efficiency_score": pit_efficiency_score,
                "pit_loss_adjustment_s": pit_loss_adjustment_s,
                "strategy_success_proxy": strategy_success_proxy,
                "double_stack_risk_score": double_stack_risk_score,
                "confidence_score": confidence_score,
                "source_label": "strategy_lab_constructor_profile_v1",
            }
            constructor_profile_rows.append(constructor_profile)
            constructor_profile_map[constructor_id] = constructor_profile

        best_strategy_votes: dict[str, int] = {}
        projection_candidates: list[dict[str, Any]] = []
        for _, driver_row in driver_board_for_race.iterrows():
            driver_id = str(driver_row["driver_id"])
            constructor_id = str(driver_row["constructor_id"])
            feature_row = driver_features_for_race[driver_features_for_race["driver_id"].astype(str) == driver_id].head(1)
            signal_row = driver_signals_for_race[driver_signals_for_race["driver_id"].astype(str) == driver_id].head(1)
            strategy_row = strategy_for_race[strategy_for_race["driver_id"].astype(str) == driver_id].head(1)
            confidence_row = race_week_confidence[
                (race_week_confidence["race_id"].astype(str) == race_id)
                & (race_week_confidence["entity_type"].astype(str) == "driver")
                & (race_week_confidence["entity_id"].astype(str) == driver_id)
            ].head(1)
            constructor_profile = constructor_profile_map.get(
                constructor_id,
                {
                    "pit_efficiency_score": 0.55,
                    "pit_loss_adjustment_s": 0.0,
                    "strategy_success_proxy": 0.5,
                    "double_stack_risk_score": 0.35,
                    "confidence_score": 0.45,
                },
            )

            base_race_pace_s = parse_num(driver_row["long_run_pace_s"], None)
            if base_race_pace_s is None:
                base_race_pace_s = parse_num(frame_value(feature_row, "avg_race_pace_s"), 90.0)
            base_quali_pace_s = parse_num(driver_row["one_lap_pace_s"], None)
            if base_quali_pace_s is None:
                base_quali_pace_s = parse_num(frame_value(feature_row, "quali_pace_s"), base_race_pace_s - 8.0)

            degradation_anchor = parse_num(driver_row["degradation_s_per_lap"], None)
            if degradation_anchor is None:
                degradation_anchor = parse_num(frame_value(feature_row, "tyre_degradation_slope"), 0.065)

            consistency_score = clamp01(parse_num(frame_value(feature_row, "consistency_score"), 0.5), 0.5)
            racecraft_proxy = clamp01(parse_num(frame_value(signal_row, "racecraft_signal"), 0.5), 0.5)
            driver_code = driver_code_for(driver_id, driver_code_map)
            energy_proxy_score = telemetry_energy_score(energy_proxy, driver_code, season, round_number)
            telemetry_signals = telemetry_strategy_signals(
                driver_code=driver_code,
                season=season,
                round_number=round_number,
                corner_speed=corner_speed,
                corner_braking=corner_braking,
                corner_throttle=corner_throttle,
                straight_speed=straight_speed,
                energy_proxy=energy_proxy,
                lap_summary=telemetry_lap_summary,
                track_position_sensitivity=float(track_signals["track_position_weight"]),
                degradation_anchor=float(degradation_anchor),
            )
            telemetry_signal_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "driver_code": driver_code,
                    "track_archetype": track_signals["track_archetype"],
                    **telemetry_signals,
                    "proxy_note": "derived from precomputed FastF1 telemetry features; energy fields are proxy only, not true ERS/battery state",
                    "source_label": "strategy_lab_telemetry_signals_v1",
                }
            )
            traffic_sensitivity_score = round(clamp01(telemetry_signals["traffic_sensitivity_score"] * 0.68 + (overtake_difficulty / 10) * 0.22 + (1 - racecraft_proxy) * 0.10, 0.55), 6)
            weather_grip_sensitivity_score = round(clamp01(parse_num(frame_value(context_row, "weather_risk_index"), 45.0) / 100), 6)
            # These strategy-profile heuristics are bounded proxies, not observed truths.
            # They should shape scenario comparisons without overpowering direct pace and degradation inputs.
            aggressive_tendency = round(clamp01(racecraft_proxy * 0.7 + (1 - consistency_score) * 0.3, 0.5), 6)
            tyre_management_score = round(clamp01((1 - min(0.18, degradation_anchor) / 0.18) * 0.45 + consistency_score * 0.30 + (1 - telemetry_signals["tyre_stress_proxy"]) * 0.25, 0.5), 6)
            early_pit_bias = round(clamp01(0.38 + telemetry_signals["undercut_suitability_score"] * 0.32 + (degradation_bias - 5) * 0.035 + aggressive_tendency * 0.08, 0.5), 6)
            late_pit_bias = round(clamp01(0.45 + tyre_management_score * 0.15 - aggressive_tendency * 0.1, 0.5), 6)
            driver_confidence = round(clamp01(parse_num(confidence_row["confidence_score"].iloc[0], 0.3) if not confidence_row.empty else 0.3, 0.3), 6)

            pace_evolution = round(0.018 + (10 - degradation_bias) * 0.0015, 4)
            baseline_stop_count = int(parse_num(frame_value(strategy_row, "recommended_stop_count"), 1))
            baseline_strategy_code = "balanced_2_stop" if baseline_stop_count >= 2 else "balanced_1_stop"
            baseline_window_start = int(parse_num(frame_value(strategy_row, "pit_window_start_lap"), max(12, int(nominal_race_laps * 0.34))))
            baseline_window_end = int(parse_num(frame_value(strategy_row, "pit_window_end_lap"), baseline_window_start + 8))

            compound_delta_soft = round(default_compound_delta("soft") - aggressive_tendency * 0.08, 4)
            compound_delta_medium = round(default_compound_delta("medium"), 4)
            compound_delta_hard = round(default_compound_delta("hard") + (degradation_bias - 5) * 0.03 - tyre_management_score * 0.06, 4)
            tyre_stress_multiplier = 0.9 + telemetry_signals["tyre_stress_proxy"] * 0.28 + track_signals["degradation_weight"] * 0.12
            degradation_soft = round(default_compound_degradation("soft") * (0.7 + degradation_bias / 8.0) * (1.08 - tyre_management_score * 0.18) * tyre_stress_multiplier, 4)
            degradation_medium = round(default_compound_degradation("medium") * (0.72 + degradation_bias / 9.0) * (1.05 - tyre_management_score * 0.15) * tyre_stress_multiplier, 4)
            degradation_hard = round(default_compound_degradation("hard") * (0.75 + degradation_bias / 10.0) * (1.02 - tyre_management_score * 0.12) * tyre_stress_multiplier, 4)
            stint_soft = max(10, min(22, int(round(nominal_race_laps * (0.22 + tyre_management_score * 0.04)))))
            stint_medium = max(14, min(28, int(round(nominal_race_laps * (0.33 + tyre_management_score * 0.05)))))
            stint_hard = max(18, min(34, int(round(nominal_race_laps * (0.40 + tyre_management_score * 0.06)))))

            strategy_feature_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "nominal_race_laps": nominal_race_laps,
                    "base_race_pace_s": round(base_race_pace_s, 4),
                    "base_quali_pace_s": round(base_quali_pace_s, 4),
                    "pace_evolution_s_per_lap": pace_evolution,
                    "pit_loss_s": pit_loss_estimate_s,
                    "fuel_correction_s_per_lap": FUEL_CORRECTION_S_PER_LAP,
                    "traffic_sensitivity_score": traffic_sensitivity_score,
                    "weather_grip_sensitivity_score": weather_grip_sensitivity_score,
                    "energy_deployment_proxy_score": energy_proxy_score,
                    "corner_speed_strength": telemetry_signals["corner_speed_strength"],
                    "braking_strength": telemetry_signals["braking_strength"],
                    "throttle_pickup_strength": telemetry_signals["throttle_pickup_strength"],
                    "traction_exit_strength": telemetry_signals["traction_exit_strength"],
                    "straight_line_strength": telemetry_signals["straight_line_strength"],
                    "energy_deployment_proxy_strength": telemetry_signals["energy_deployment_proxy_strength"],
                    "lift_and_coast_tendency": telemetry_signals["lift_and_coast_tendency"],
                    "clipping_risk_proxy": telemetry_signals["clipping_risk_proxy"],
                    "overtaking_attack_score": telemetry_signals["overtaking_attack_score"],
                    "defending_strength_score": telemetry_signals["defending_strength_score"],
                    "tyre_stress_proxy": telemetry_signals["tyre_stress_proxy"],
                    "undercut_suitability_score": telemetry_signals["undercut_suitability_score"],
                    "high_degradation_risk_score": telemetry_signals["high_degradation_risk_score"],
                    "track_archetype": track_signals["track_archetype"],
                    "track_position_sensitivity_score": track_signals["track_position_weight"],
                    "telemetry_proxy_confidence": telemetry_signals["telemetry_proxy_confidence"],
                    "baseline_stop_count": baseline_stop_count,
                    "baseline_strategy_code": baseline_strategy_code,
                    "baseline_pit_window_start_lap": baseline_window_start,
                    "baseline_pit_window_end_lap": baseline_window_end,
                    "compound_delta_soft_s": compound_delta_soft,
                    "compound_delta_medium_s": compound_delta_medium,
                    "compound_delta_hard_s": compound_delta_hard,
                    "degradation_soft_s_per_lap": degradation_soft,
                    "degradation_medium_s_per_lap": degradation_medium,
                    "degradation_hard_s_per_lap": degradation_hard,
                    "stint_length_soft_laps": stint_soft,
                    "stint_length_medium_laps": stint_medium,
                    "stint_length_hard_laps": stint_hard,
                    "source_label": "strategy_lab_features_v2",
                }
            )

            driver_profile_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "aggressive_tendency_score": aggressive_tendency,
                    "tyre_management_score": tyre_management_score,
                    "early_pit_bias_score": early_pit_bias,
                    "late_pit_bias_score": late_pit_bias,
                    "racecraft_proxy_score": racecraft_proxy,
                    "confidence_score": driver_confidence,
                    "source_label": "strategy_lab_driver_profile_v1",
                }
            )

            comparison_candidates: list[dict[str, Any]] = []
            for scenario in SCENARIO_TEMPLATES:
                max_lengths = {
                    "soft": stint_soft,
                    "medium": stint_medium,
                    "hard": stint_hard,
                    "intermediate": max(12, stint_medium),
                    "wet": max(12, stint_medium),
                }
                stint_lengths = build_stint_lengths(
                    nominal_race_laps,
                    scenario["compound_sequence"],
                    scenario["stint_weights"],
                    max_lengths,
                )
                total_time_s, average_stint_degradation_s = simulate_strategy(
                    base_race_pace_s=base_race_pace_s,
                    pace_evolution_s_per_lap=pace_evolution,
                    pit_loss_s=pit_loss_estimate_s,
                    total_laps=nominal_race_laps,
                    compounds=scenario["compound_sequence"],
                    stint_lengths=stint_lengths,
                    compound_deltas={
                        "soft": compound_delta_soft,
                        "medium": compound_delta_medium,
                        "hard": compound_delta_hard,
                    },
                    compound_degradation={
                        "soft": degradation_soft,
                        "medium": degradation_medium,
                        "hard": degradation_hard,
                    },
                    tyre_management_score=tyre_management_score,
                    pit_efficiency_adjustment_s=float(constructor_profile["pit_loss_adjustment_s"]),
                    aggression_score=aggressive_tendency,
                    energy_deployment_proxy_score=energy_proxy_score,
                    race_season=season,
                )

                comparison_candidates.append(
                    {
                        "scenario_code": scenario["scenario_code"],
                        "scenario_label": scenario["scenario_label"],
                        "pit_stop_count": scenario["pit_stop_count"],
                        "compound_sequence": " / ".join(scenario["compound_sequence"]),
                        "stint_lengths": stint_lengths,
                        "total_race_time_s": total_time_s,
                        "average_stint_degradation_s": average_stint_degradation_s,
                    }
                )

            comparison_candidates = sorted(comparison_candidates, key=lambda item: item["total_race_time_s"])
            baseline_time = next(
                (item["total_race_time_s"] for item in comparison_candidates if item["scenario_code"] == baseline_strategy_code),
                comparison_candidates[0]["total_race_time_s"],
            )
            base_projection = int(parse_num(driver_row["projected_finish"], 10))
            for recommendation_rank, comparison in enumerate(comparison_candidates, start=1):
                delta_vs_baseline_s = round(comparison["total_race_time_s"] - baseline_time, 1)
                finish_adjustment = int(round(delta_vs_baseline_s / 2.3))
                estimated_finish_position = max(1, min(len(driver_board_for_race), base_projection + finish_adjustment))
                projection_band = max(2, int(round((1 - driver_confidence) * 5 + abs(delta_vs_baseline_s) * 0.35)))
                confidence_score = round(clamp01(driver_confidence * 0.75 + float(constructor_profile["confidence_score"]) * 0.25, 0.35), 6)
                rationale = (
                    f"{comparison['scenario_label']} ranks {'ahead of' if delta_vs_baseline_s <= 0 else 'behind'} the baseline "
                    f"because tyre-management proxy {tyre_management_score:.2f} and pit-efficiency proxy {float(constructor_profile['pit_efficiency_score']):.2f} "
                    f"shift the expected stint loss profile."
                )
                comparison_rows.append(
                    {
                        "id": f"{race_id}|{driver_id}|{comparison['scenario_code']}",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "scenario_code": comparison["scenario_code"],
                        "scenario_label": comparison["scenario_label"],
                        "pit_stop_count": comparison["pit_stop_count"],
                        "compound_sequence": comparison["compound_sequence"],
                        "total_race_time_s": round(comparison["total_race_time_s"], 1),
                        "delta_vs_baseline_s": delta_vs_baseline_s,
                        "average_stint_degradation_s": comparison["average_stint_degradation_s"],
                        "estimated_finish_position": estimated_finish_position,
                        "estimated_finish_band_low": max(1, estimated_finish_position - projection_band),
                        "estimated_finish_band_high": min(len(driver_board_for_race), estimated_finish_position + projection_band),
                        "confidence_score": confidence_score,
                        "recommendation_rank": recommendation_rank,
                        "rationale": rationale,
                        "source_label": "strategy_lab_comparison_v1",
                    }
                )

                stop_lap_accumulator = 0
                compounds = comparison["compound_sequence"].split(" / ")
                for stop_index, stint_length in enumerate(comparison["stint_lengths"][:-1], start=1):
                    stop_lap_accumulator += stint_length
                    pit_window_rows.append(
                        {
                            "id": f"{race_id}|{driver_id}|{comparison['scenario_code']}|{stop_index}",
                            "season": season,
                            "round": round_number,
                            "race_id": race_id,
                            "driver_id": driver_id,
                            "constructor_id": constructor_id,
                            "scenario_code": comparison["scenario_code"],
                            "stop_number": stop_index,
                            "window_start_lap": max(1, stop_lap_accumulator - 2),
                            "window_end_lap": min(nominal_race_laps - 1, stop_lap_accumulator + 2),
                            "compound_in": compounds[stop_index - 1],
                            "compound_out": compounds[stop_index],
                            "source_label": "strategy_lab_pit_window_v1",
                        }
                    )

            top_strategy = comparison_candidates[0]
            best_strategy_votes[top_strategy["scenario_code"]] = best_strategy_votes.get(top_strategy["scenario_code"], 0) + 1
            projection_candidates.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "baseline_strategy_code": baseline_strategy_code,
                    "baseline_total_time_s": round(baseline_time, 1),
                    "projected_finish": base_projection,
                    "finish_band_low": max(1, base_projection - max(2, int(round((1 - driver_confidence) * 4.5)))),
                    "finish_band_high": min(len(driver_board_for_race), base_projection + max(2, int(round((1 - driver_confidence) * 4.5)))),
                    "win_probability": round(max(5.0, min(55.0, 32 - base_projection * 1.5)) / 5) * 5,
                    "podium_probability": round(max(10.0, min(85.0, 76 - base_projection * 3.8)) / 5) * 5,
                    "confidence_score": driver_confidence,
                    "source_label": "strategy_lab_projection_v1",
                }
            )

        projection_rows.extend(projection_candidates)
        best_strategy_code = max(best_strategy_votes.items(), key=lambda item: item[1])[0] if best_strategy_votes else "balanced_2_stop"
        best_strategy_template = next((scenario for scenario in SCENARIO_TEMPLATES if scenario["scenario_code"] == best_strategy_code), SCENARIO_TEMPLATES[0])
        key_insight = (
            f"{best_strategy_template['scenario_label']} projects as the cleanest opening profile for {race_name} because "
            f"pit loss is around {pit_loss_estimate_s:.1f}s and tyre stress trends {classify_race_difficulty(degradation_bias * 10)}."
        )
        overview_rows.append(
            {
                "id": race_id,
                "season": season,
                "round": round_number,
                "race_id": race_id,
                "race_name": race_name,
                "circuit_id": circuit_id,
                "archetype_label": overview_row["archetype_label"] if "archetype_label" in overview_row else None,
                "race_difficulty": classify_race_difficulty(strategic_complexity_score),
                "nominal_race_laps": nominal_race_laps,
                "pit_loss_estimate_s": pit_loss_estimate_s,
                "best_strategy_code": best_strategy_code,
                "best_strategy_label": best_strategy_template["scenario_label"],
                "key_insight": key_insight,
                "confidence_score": round(clamp01(parse_num(context_signal["confidence_score"].iloc[0], 0.3) if not context_signal.empty else 0.3, 0.3), 6),
                "model_version": STRATEGY_LAB_MODEL_VERSION,
                "scenario_template_version": STRATEGY_LAB_SCENARIO_TEMPLATE_VERSION,
                "feature_build_version": feature_build_version or None,
                "generated_at": strategy_lab_generated_at,
                "build_version": strategy_lab_build_version,
                "source_label": "strategy_lab_overview_v1",
            }
        )

    outputs = {
        "strategy_features": ensure_columns(
            pd.DataFrame(strategy_feature_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id", "nominal_race_laps",
                "base_race_pace_s", "base_quali_pace_s", "pace_evolution_s_per_lap", "pit_loss_s",
                "fuel_correction_s_per_lap", "traffic_sensitivity_score", "weather_grip_sensitivity_score", "energy_deployment_proxy_score",
                "corner_speed_strength", "braking_strength", "throttle_pickup_strength", "traction_exit_strength",
                "straight_line_strength", "energy_deployment_proxy_strength", "lift_and_coast_tendency", "clipping_risk_proxy",
                "overtaking_attack_score", "defending_strength_score", "tyre_stress_proxy", "undercut_suitability_score",
                "high_degradation_risk_score", "track_archetype", "track_position_sensitivity_score", "telemetry_proxy_confidence",
                "baseline_stop_count", "baseline_strategy_code", "baseline_pit_window_start_lap", "baseline_pit_window_end_lap",
                "compound_delta_soft_s", "compound_delta_medium_s", "compound_delta_hard_s",
                "degradation_soft_s_per_lap", "degradation_medium_s_per_lap", "degradation_hard_s_per_lap",
                "stint_length_soft_laps", "stint_length_medium_laps", "stint_length_hard_laps", "source_label",
            ],
        ),
        "telemetry_strategy_signals": ensure_columns(
            pd.DataFrame(telemetry_signal_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id", "driver_code", "track_archetype",
                "corner_speed_strength", "braking_strength", "throttle_pickup_strength", "traction_exit_strength",
                "straight_line_strength", "energy_deployment_proxy_strength", "lift_and_coast_tendency", "clipping_risk_proxy",
                "overtaking_attack_score", "defending_strength_score", "tyre_stress_proxy", "traffic_sensitivity_score",
                "undercut_suitability_score", "high_degradation_risk_score", "telemetry_proxy_confidence",
                "telemetry_signal_source", "proxy_note", "source_label",
            ],
        ),
        "track_archetype_weights": ensure_columns(
            all_track_archetypes,
            [
                "id", "season", "round", "race_id", "race_name", "track_archetype", "straight_line_weight",
                "braking_weight", "traction_weight", "degradation_weight", "track_position_weight",
                "archetype_confidence", "formula_note", "source_label",
            ],
        ),
        "driver_strategy_profile": ensure_columns(
            pd.DataFrame(driver_profile_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id",
                "aggressive_tendency_score", "tyre_management_score", "early_pit_bias_score", "late_pit_bias_score",
                "racecraft_proxy_score", "confidence_score", "source_label",
            ],
        ),
        "constructor_strategy_profile": ensure_columns(
            pd.DataFrame(constructor_profile_rows),
            [
                "id", "season", "round", "race_id", "constructor_id",
                "pit_efficiency_score", "pit_loss_adjustment_s", "strategy_success_proxy",
                "double_stack_risk_score", "confidence_score", "source_label",
            ],
        ),
        "strategy_lab_overview": ensure_columns(
            pd.DataFrame(overview_rows),
            [
                "id", "season", "round", "race_id", "race_name", "circuit_id", "archetype_label", "race_difficulty",
                "nominal_race_laps", "pit_loss_estimate_s", "best_strategy_code", "best_strategy_label",
                "key_insight", "confidence_score", "model_version", "scenario_template_version", "feature_build_version", "generated_at", "build_version", "source_label",
            ],
        ),
        "strategy_comparison": ensure_columns(
            pd.DataFrame(comparison_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id", "scenario_code", "scenario_label",
                "pit_stop_count", "compound_sequence", "total_race_time_s", "delta_vs_baseline_s",
                "average_stint_degradation_s", "estimated_finish_position", "estimated_finish_band_low",
                "estimated_finish_band_high", "confidence_score", "recommendation_rank", "rationale", "source_label",
            ],
        ),
        "pit_window": ensure_columns(
            pd.DataFrame(pit_window_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id", "scenario_code", "stop_number",
                "window_start_lap", "window_end_lap", "compound_in", "compound_out", "source_label",
            ],
        ),
        "race_projection": ensure_columns(
            pd.DataFrame(projection_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id", "baseline_strategy_code",
                "baseline_total_time_s", "projected_finish", "finish_band_low", "finish_band_high",
                "win_probability", "podium_probability", "confidence_score", "source_label",
            ],
        ),
    }

    for name, frame in outputs.items():
        frame.to_csv(strategy_lab_dir / f"{name}.csv", index=False)

    signal_frame = outputs["telemetry_strategy_signals"]
    archetype_frame = outputs["track_archetype_weights"]
    report = {
        "model_version": STRATEGY_LAB_MODEL_VERSION,
        "telemetry_signal_coverage": {
            "rows": int(len(signal_frame)),
            "drivers_with_signals": int(signal_frame["driver_id"].nunique()) if not signal_frame.empty else 0,
            "missing_signal_count": int(signal_frame.isna().sum().sum()) if not signal_frame.empty else 0,
        },
        "track_archetype_coverage": {
            "rows": int(len(archetype_frame)),
            "archetypes": sorted(archetype_frame["track_archetype"].dropna().unique().tolist()) if not archetype_frame.empty else [],
        },
        "proxy_confidence_distribution": {
            "min": round(float(signal_frame["telemetry_proxy_confidence"].min()), 4) if not signal_frame.empty else None,
            "median": round(float(signal_frame["telemetry_proxy_confidence"].median()), 4) if not signal_frame.empty else None,
            "max": round(float(signal_frame["telemetry_proxy_confidence"].max()), 4) if not signal_frame.empty else None,
        },
        "formula_notes": TELEMETRY_SIGNAL_FORMULAS,
        "proxy_note": "Energy deployment fields are proxy-derived from precomputed telemetry features only; no true ERS or battery state is available.",
        "validation_errors": [],
    }
    if signal_frame.empty:
        report["validation_errors"].append("telemetry_strategy_signals has zero rows")
    if archetype_frame.empty:
        report["validation_errors"].append("track_archetype_weights has zero rows")
    reports_dir = settings.strategy_lab_dir.parent / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / "strategy_lab_signal_quality.json").write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
