from __future__ import annotations

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
            fuel_offset = ((total_laps - global_lap) / max(total_laps, 1) - 0.5) * 0.9
            pace_evolution = global_lap * pace_evolution_s_per_lap * (1.0 - aggression_score * 0.08)
            lap_time = base_race_pace_s + compound_delta + fuel_offset + pace_evolution + (stint_lap - 1) * degradation_rate
            cumulative_time += lap_time
        degradation_samples.append(degradation_rate)
        if stint_index < len(compounds) - 1:
            cumulative_time += max(16.0, pit_loss_s + pit_efficiency_adjustment_s - aggression_score * 0.35)

    return round(cumulative_time, 3), round(sum(degradation_samples) / max(len(degradation_samples), 1), 4)


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

    driver_name_map = dict(zip(drivers["id"], drivers["full_name"])) if not drivers.empty else {}
    constructor_name_map = dict(zip(constructors["id"], constructors["name"])) if not constructors.empty else {}
    overview_rows: list[dict[str, Any]] = []
    strategy_feature_rows: list[dict[str, Any]] = []
    driver_profile_rows: list[dict[str, Any]] = []
    constructor_profile_rows: list[dict[str, Any]] = []
    comparison_rows: list[dict[str, Any]] = []
    pit_window_rows: list[dict[str, Any]] = []
    projection_rows: list[dict[str, Any]] = []

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
        pit_loss_estimate_s = round(17.5 + overtake_difficulty * 0.72 + high_speed_bias * 0.28, 2)
        driver_board_for_race = race_week_driver_board[race_week_driver_board["race_id"].astype(str) == race_id].copy()
        strategy_for_race = race_week_strategy[race_week_strategy["race_id"].astype(str) == race_id].copy()
        driver_features_for_race = driver_features[driver_features["race_id"].astype(str) == race_id].copy()
        driver_signals_for_race = driver_signals[driver_signals["race_id"].astype(str) == race_id].copy()
        constructor_features_for_race = constructor_features[constructor_features["race_id"].astype(str) == race_id].copy()
        constructor_signals_for_race = constructor_signals[constructor_signals["race_id"].astype(str) == race_id].copy()

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
            aggressive_tendency = round(clamp01(racecraft_proxy * 0.7 + (1 - consistency_score) * 0.3, 0.5), 6)
            tyre_management_score = round(clamp01((1 - min(0.18, degradation_anchor) / 0.18) * 0.65 + consistency_score * 0.35, 0.5), 6)
            early_pit_bias = round(clamp01(0.45 + (degradation_bias - 5) * 0.05 + aggressive_tendency * 0.1, 0.5), 6)
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
            degradation_soft = round(default_compound_degradation("soft") * (0.7 + degradation_bias / 8.0) * (1.08 - tyre_management_score * 0.18), 4)
            degradation_medium = round(default_compound_degradation("medium") * (0.72 + degradation_bias / 9.0) * (1.05 - tyre_management_score * 0.15), 4)
            degradation_hard = round(default_compound_degradation("hard") * (0.75 + degradation_bias / 10.0) * (1.02 - tyre_management_score * 0.12), 4)
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
                    "source_label": "strategy_lab_features_v1",
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
                delta_vs_baseline_s = round(comparison["total_race_time_s"] - baseline_time, 3)
                finish_adjustment = int(round(delta_vs_baseline_s / 2.3))
                estimated_finish_position = max(1, min(len(driver_board_for_race), base_projection + finish_adjustment))
                projection_band = max(1, int(round((1 - driver_confidence) * 5 + abs(delta_vs_baseline_s) * 0.25)))
                confidence_score = round(clamp01(driver_confidence * 0.75 + float(constructor_profile["confidence_score"]) * 0.25, 0.35), 6)
                rationale = (
                    f"{comparison['scenario_label']} projects {'less' if delta_vs_baseline_s <= 0 else 'more'} race time than the baseline "
                    f"because {driver_name_map.get(driver_id, driver_id)} carries a tyre-management score of {tyre_management_score:.2f} "
                    f"and {constructor_name_map.get(constructor_id, constructor_id)} has a pit-efficiency score of {float(constructor_profile['pit_efficiency_score']):.2f}."
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
                        "total_race_time_s": comparison["total_race_time_s"],
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
                    "baseline_total_time_s": baseline_time,
                    "projected_finish": base_projection,
                    "finish_band_low": max(1, base_projection - max(1, int(round((1 - driver_confidence) * 4)))),
                    "finish_band_high": min(len(driver_board_for_race), base_projection + max(1, int(round((1 - driver_confidence) * 4)))),
                    "win_probability": round(max(0.1, 28 - base_projection * 1.2), 3),
                    "podium_probability": round(max(1.0, 70 - base_projection * 3.2), 3),
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
                "source_label": "strategy_lab_overview_v1",
            }
        )

    outputs = {
        "strategy_features": ensure_columns(
            pd.DataFrame(strategy_feature_rows),
            [
                "id", "season", "round", "race_id", "driver_id", "constructor_id", "nominal_race_laps",
                "base_race_pace_s", "base_quali_pace_s", "pace_evolution_s_per_lap", "pit_loss_s",
                "baseline_stop_count", "baseline_strategy_code", "baseline_pit_window_start_lap", "baseline_pit_window_end_lap",
                "compound_delta_soft_s", "compound_delta_medium_s", "compound_delta_hard_s",
                "degradation_soft_s_per_lap", "degradation_medium_s_per_lap", "degradation_hard_s_per_lap",
                "stint_length_soft_laps", "stint_length_medium_laps", "stint_length_hard_laps", "source_label",
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
                "key_insight", "confidence_score", "source_label",
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


if __name__ == "__main__":
    main()
