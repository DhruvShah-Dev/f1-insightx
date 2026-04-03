from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from f1_insightx_data.settings import load_settings


POINTS_BY_POSITION = {
    1: 25,
    2: 18,
    3: 15,
    4: 12,
    5: 10,
    6: 8,
    7: 6,
    8: 4,
    9: 2,
    10: 1,
}


@dataclass(frozen=True)
class CanonicalFrames:
    races: pd.DataFrame
    drivers: pd.DataFrame
    constructors: pd.DataFrame
    circuits: pd.DataFrame
    qualifying_results: pd.DataFrame
    race_results: pd.DataFrame
    sprint_results: pd.DataFrame
    strategy_profiles: pd.DataFrame


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def load_frames(curated_dir: Path) -> CanonicalFrames:
    races = read_csv(curated_dir / "races.csv")
    races["scheduled_at"] = pd.to_datetime(races["scheduled_at"], utc=True, errors="coerce")
    races["season"] = races["season"].astype(int)
    races["round"] = races["round"].astype(int)

    qualifying_results = read_csv(curated_dir / "qualifying_results.csv")
    race_results = read_csv(curated_dir / "race_results.csv")
    sprint_path = curated_dir / "sprint_results.csv"
    sprint_results = read_csv(sprint_path) if sprint_path.exists() else pd.DataFrame()
    strategy_profiles = read_csv(curated_dir / "strategy_profiles.csv")

    for frame, column in [
        (qualifying_results, "position"),
        (race_results, "grid_position"),
        (race_results, "finish_position"),
        (race_results, "laps_completed"),
        (race_results, "fastest_lap_rank"),
    ]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    for frame, column in [
        (race_results, "points"),
        (sprint_results, "points"),
        (strategy_profiles, "overtake_score"),
        (strategy_profiles, "reliability_score"),
    ]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)

    if not sprint_results.empty:
        for column in ["grid_position", "finish_position", "laps_completed"]:
            if column in sprint_results.columns:
                sprint_results[column] = pd.to_numeric(sprint_results[column], errors="coerce")

    return CanonicalFrames(
        races=races,
        drivers=read_csv(curated_dir / "drivers.csv"),
        constructors=read_csv(curated_dir / "constructors.csv"),
        circuits=read_csv(curated_dir / "circuits.csv"),
        qualifying_results=qualifying_results,
        race_results=race_results,
        sprint_results=sprint_results,
        strategy_profiles=strategy_profiles,
    )


def build_driver_standings(frames: CanonicalFrames) -> pd.DataFrame:
    completed_races = completed_race_frame(frames)
    season_driver_ids = (
        frames.race_results.merge(frames.races[["id", "season"]], left_on="race_id", right_on="id", how="left")
        .groupby("season")["driver_id"]
        .unique()
        .to_dict()
    )
    season_driver_constructor = (
        frames.race_results.merge(frames.races[["id", "season", "round"]], left_on="race_id", right_on="id", how="left")
        .sort_values(["season", "round"])
        .groupby(["season", "driver_id"])
        .tail(1)[["season", "driver_id", "constructor_id"]]
    )
    constructor_lookup = (
        season_driver_constructor.set_index(["season", "driver_id"])["constructor_id"].to_dict()
    )
    rows: list[dict[str, object]] = []

    for season, season_races in completed_races.groupby("season", sort=True):
        points = {driver_id: 0.0 for driver_id in season_driver_ids.get(season, [])}
        wins = {driver_id: 0 for driver_id in season_driver_ids.get(season, [])}

        season_results = frames.race_results[
            frames.race_results["race_id"].isin(season_races["id"])
        ].merge(season_races[["id", "round"]], left_on="race_id", right_on="id", how="left")
        season_sprints = pd.DataFrame()
        if not frames.sprint_results.empty:
            season_sprints = frames.sprint_results[
                frames.sprint_results["race_id"].isin(season_races["id"])
            ].merge(season_races[["id", "round"]], left_on="race_id", right_on="id", how="left")

        for _, race in season_races.sort_values("round").iterrows():
            race_id = race["id"]
            round_number = int(race["round"])
            race_rows = season_results[season_results["race_id"] == race_id]
            sprint_rows = season_sprints[season_sprints["race_id"] == race_id] if not season_sprints.empty else pd.DataFrame()

            for _, row in race_rows.iterrows():
                driver_id = row["driver_id"]
                points[driver_id] = points.get(driver_id, 0.0) + float(row["points"] or 0)
                if pd.notna(row["finish_position"]) and int(row["finish_position"]) == 1:
                    wins[driver_id] = wins.get(driver_id, 0) + 1

            if not sprint_rows.empty:
                for _, row in sprint_rows.iterrows():
                    driver_id = row["driver_id"]
                    points[driver_id] = points.get(driver_id, 0.0) + float(row["points"] or 0)

            ordered = sorted(
                points.keys(),
                key=lambda driver_id: (
                    -points.get(driver_id, 0.0),
                    -wins.get(driver_id, 0),
                    driver_id,
                ),
            )
            for position, driver_id in enumerate(ordered, start=1):
                rows.append(
                    {
                        "id": f"{race_id}|{driver_id}",
                        "season": int(season),
                        "round": round_number,
                        "race_id": race_id,
                        "driver_id": driver_id,
                        "constructor_id": constructor_lookup.get((int(season), driver_id)),
                        "standing_position": position,
                        "points": round(points.get(driver_id, 0.0), 1),
                        "wins": wins.get(driver_id, 0),
                        "source_label": "derived_results_rollup",
                    }
                )

    return pd.DataFrame(rows)


def build_constructor_standings(frames: CanonicalFrames) -> pd.DataFrame:
    completed_races = completed_race_frame(frames)
    season_constructor_ids = (
        frames.race_results.merge(frames.races[["id", "season"]], left_on="race_id", right_on="id", how="left")
        .groupby("season")["constructor_id"]
        .unique()
        .to_dict()
    )
    rows: list[dict[str, object]] = []

    for season, season_races in completed_races.groupby("season", sort=True):
        points = {constructor_id: 0.0 for constructor_id in season_constructor_ids.get(season, [])}
        wins = {constructor_id: 0 for constructor_id in season_constructor_ids.get(season, [])}

        season_results = frames.race_results[
            frames.race_results["race_id"].isin(season_races["id"])
        ].merge(season_races[["id", "round"]], left_on="race_id", right_on="id", how="left")
        season_sprints = pd.DataFrame()
        if not frames.sprint_results.empty:
            season_sprints = frames.sprint_results[
                frames.sprint_results["race_id"].isin(season_races["id"])
            ].merge(season_races[["id", "round"]], left_on="race_id", right_on="id", how="left")

        for _, race in season_races.sort_values("round").iterrows():
            race_id = race["id"]
            round_number = int(race["round"])
            race_rows = season_results[season_results["race_id"] == race_id]
            sprint_rows = season_sprints[season_sprints["race_id"] == race_id] if not season_sprints.empty else pd.DataFrame()

            for _, row in race_rows.iterrows():
                constructor_id = row["constructor_id"]
                points[constructor_id] = points.get(constructor_id, 0.0) + float(row["points"] or 0)
                if pd.notna(row["finish_position"]) and int(row["finish_position"]) == 1:
                    wins[constructor_id] = wins.get(constructor_id, 0) + 1

            if not sprint_rows.empty:
                for _, row in sprint_rows.iterrows():
                    constructor_id = row["constructor_id"]
                    points[constructor_id] = points.get(constructor_id, 0.0) + float(row["points"] or 0)

            ordered = sorted(
                points.keys(),
                key=lambda constructor_id: (
                    -points.get(constructor_id, 0.0),
                    -wins.get(constructor_id, 0),
                    constructor_id,
                ),
            )
            for position, constructor_id in enumerate(ordered, start=1):
                rows.append(
                    {
                        "id": f"{race_id}|{constructor_id}",
                        "season": int(season),
                        "round": round_number,
                        "race_id": race_id,
                        "constructor_id": constructor_id,
                        "standing_position": position,
                        "points": round(points.get(constructor_id, 0.0), 1),
                        "wins": wins.get(constructor_id, 0),
                        "source_label": "derived_results_rollup",
                    }
                )

    return pd.DataFrame(rows)


def build_race_week_context(frames: CanonicalFrames) -> pd.DataFrame:
    completed = completed_race_frame(frames)
    completed_ids = set(completed["id"].tolist())
    races = frames.races.sort_values(["season", "round"]).copy()
    now = datetime.now(tz=UTC)
    future_candidates = races[
        (~races["id"].isin(completed_ids)) & (races["scheduled_at"] >= now)
    ].sort_values(["scheduled_at", "season", "round"])
    next_race_id = future_candidates.iloc[0]["id"] if not future_candidates.empty else None

    latest_completed_row: pd.Series | None = None
    rows: list[dict[str, object]] = []

    for _, race in races.iterrows():
        race_id = race["id"]
        if race_id in completed_ids:
            status = "completed"
            latest_completed_row = race
        elif next_race_id == race_id:
            status = "upcoming"
        else:
            status = "scheduled"

        rows.append(
            {
                "id": race_id,
                "season": int(race["season"]),
                "round": int(race["round"]),
                "race_id": race_id,
                "race_name": race["race_name"],
                "circuit_id": race["circuit_id"],
                "scheduled_at": race["scheduled_at"].isoformat() if pd.notna(race["scheduled_at"]) else None,
                "status": status,
                "is_next_race": race_id == next_race_id,
                "latest_completed_race_id": latest_completed_row["id"] if latest_completed_row is not None else None,
                "latest_completed_season": int(latest_completed_row["season"]) if latest_completed_row is not None else None,
                "latest_completed_round": int(latest_completed_row["round"]) if latest_completed_row is not None else None,
                "latest_completed_race_name": latest_completed_row["race_name"] if latest_completed_row is not None else None,
                "source_label": "schedule_plus_results",
            }
        )

    return pd.DataFrame(rows)


def build_model_features(
    frames: CanonicalFrames,
    race_week_context: pd.DataFrame,
    driver_standings: pd.DataFrame,
    constructor_standings: pd.DataFrame,
) -> pd.DataFrame:
    results = frames.race_results.merge(
        frames.races[["id", "season", "round", "scheduled_at", "circuit_id"]],
        left_on="race_id",
        right_on="id",
        how="left",
    )
    qualifying = frames.qualifying_results.merge(
        frames.races[["id", "season", "round", "scheduled_at"]],
        left_on="race_id",
        right_on="id",
        how="left",
    )
    strategy = frames.strategy_profiles.merge(
        frames.races[["id", "season", "round"]],
        left_on="race_id",
        right_on="id",
        how="left",
    )

    latest_driver_snapshot = (
        driver_standings.sort_values(["season", "round"])
        .groupby(["race_id", "driver_id"])
        .tail(1)
    )
    latest_constructor_snapshot = (
        constructor_standings.sort_values(["season", "round"])
        .groupby(["race_id", "constructor_id"])
        .tail(1)
    )

    rows: list[dict[str, object]] = []

    for _, context_row in race_week_context.sort_values(["season", "round"]).iterrows():
        target_race_id = context_row["race_id"]
        latest_completed_race_id = context_row["latest_completed_race_id"]
        if pd.isna(latest_completed_race_id):
            continue

        target_race = frames.races.loc[frames.races["id"] == target_race_id].iloc[0]
        target_time = target_race["scheduled_at"]
        previous_results = results[results["scheduled_at"] < target_time].sort_values(["scheduled_at", "round"])
        previous_qualifying = qualifying[qualifying["scheduled_at"] < target_time].sort_values(["scheduled_at", "round"])
        previous_strategy = strategy[strategy["round"] < int(target_race["round"])].sort_values(["season", "round"])

        field_rows = frames.qualifying_results[frames.qualifying_results["race_id"] == target_race_id]
        if field_rows.empty:
            field_rows = frames.race_results[frames.race_results["race_id"] == latest_completed_race_id][
                ["driver_id", "constructor_id"]
            ].copy()
        if field_rows.empty:
            continue

        field_rows = field_rows[["driver_id", "constructor_id"]].drop_duplicates()
        latest_driver_standing_rows = latest_driver_snapshot[latest_driver_snapshot["race_id"] == latest_completed_race_id]
        latest_constructor_standing_rows = latest_constructor_snapshot[
            latest_constructor_snapshot["race_id"] == latest_completed_race_id
        ]

        for _, field in field_rows.iterrows():
            driver_id = field["driver_id"]
            constructor_id = field["constructor_id"]
            driver_history = previous_results[previous_results["driver_id"] == driver_id].tail(5)
            qualifying_history = previous_qualifying[previous_qualifying["driver_id"] == driver_id].tail(5)
            constructor_history = previous_results[previous_results["constructor_id"] == constructor_id].tail(6)
            latest_strategy = previous_strategy[previous_strategy["driver_id"] == driver_id].tail(1)

            teammate_delta_avg = teammate_points_delta(previous_results.tail(60), driver_id, constructor_id)
            dnf_rate = float(driver_history["finish_position"].isna().mean()) if not driver_history.empty else 0.0
            finish_consistency = float(driver_history["finish_position"].std(ddof=0)) if len(driver_history) > 1 else 0.0

            driver_standing_row = latest_driver_standing_rows[
                latest_driver_standing_rows["driver_id"] == driver_id
            ].head(1)
            constructor_standing_row = latest_constructor_standing_rows[
                latest_constructor_standing_rows["constructor_id"] == constructor_id
            ].head(1)

            rows.append(
                {
                    "id": f"{target_race_id}|{driver_id}",
                    "season": int(target_race["season"]),
                    "round": int(target_race["round"]),
                    "race_id": target_race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "latest_completed_race_id": latest_completed_race_id,
                    "recent_finish_avg_3": rolling_mean(driver_history["finish_position"], 3, default=12.0),
                    "recent_qualifying_avg_3": rolling_mean(qualifying_history["position"], 3, default=12.0),
                    "recent_points_avg_3": rolling_mean(driver_history["points"], 3, default=0.0),
                    "teammate_points_delta_avg_3": round(teammate_delta_avg, 3),
                    "finish_consistency_5": round(finish_consistency, 3),
                    "dnf_rate_5": round(dnf_rate, 3),
                    "constructor_points_avg_3": rolling_mean(constructor_history["points"], 6, default=0.0),
                    "constructor_finish_avg_3": rolling_mean(constructor_history["finish_position"], 6, default=10.0),
                    "overtake_score": round(float(latest_strategy["overtake_score"].iloc[0]) if not latest_strategy.empty else 50.0, 3),
                    "reliability_score": round(float(latest_strategy["reliability_score"].iloc[0]) if not latest_strategy.empty else 75.0, 3),
                    "driver_standing_position": int(driver_standing_row["standing_position"].iloc[0]) if not driver_standing_row.empty else None,
                    "constructor_standing_position": int(constructor_standing_row["standing_position"].iloc[0]) if not constructor_standing_row.empty else None,
                    "field_status": context_row["status"],
                    "source_label": "point_in_time_feature_builder",
                }
            )

    return pd.DataFrame(rows)


def build_prediction_snapshots(
    frames: CanonicalFrames,
    race_week_context: pd.DataFrame,
    model_features: pd.DataFrame,
) -> pd.DataFrame:
    prediction_context = race_week_context[race_week_context["status"] != "completed"].copy()
    if prediction_context.empty:
        return pd.DataFrame(
            columns=[
                "id",
                "season",
                "round",
                "race_id",
                "driver_id",
                "constructor_id",
                "generated_at",
                "model_version",
                "predicted_score",
                "projected_finish",
                "winner_probability",
                "podium_probability",
                "top10_probability",
                "rationale",
                "source_label",
            ]
        )

    generated_at = datetime.now(tz=UTC).isoformat()
    snapshot_rows: list[dict[str, object]] = []

    for _, race in prediction_context.sort_values(["season", "round"]).iterrows():
        race_id = race["race_id"]
        race_features = model_features[model_features["race_id"] == race_id].copy()
        if race_features.empty:
            continue

        race_features["predicted_score"] = race_features.apply(score_prediction_row, axis=1)
        race_features = race_features.sort_values("predicted_score", ascending=False).reset_index(drop=True)
        race_features["projected_finish"] = race_features.index + 1
        race_features["winner_probability"] = softmax_percent(race_features["predicted_score"], temperature=0.08)
        race_features["podium_probability"] = race_features.apply(
            lambda row: probability_band(int(row["projected_finish"]), float(row["predicted_score"]), top=3),
            axis=1,
        )
        race_features["top10_probability"] = race_features.apply(
            lambda row: probability_band(int(row["projected_finish"]), float(row["predicted_score"]), top=10),
            axis=1,
        )
        race_features["rationale"] = race_features.apply(prediction_rationale, axis=1)

        for _, row in race_features.iterrows():
            snapshot_rows.append(
                {
                    "id": f"{race_id}|{row['driver_id']}|v1",
                    "season": int(race["season"]),
                    "round": int(race["round"]),
                    "race_id": race_id,
                    "driver_id": row["driver_id"],
                    "constructor_id": row["constructor_id"],
                    "generated_at": generated_at,
                    "model_version": "pre_race_ranker_v1",
                    "predicted_score": round(float(row["predicted_score"]), 4),
                    "projected_finish": int(row["projected_finish"]),
                    "winner_probability": round(float(row["winner_probability"]), 3),
                    "podium_probability": round(float(row["podium_probability"]), 3),
                    "top10_probability": round(float(row["top10_probability"]), 3),
                    "rationale": row["rationale"],
                    "source_label": "feature_ranker_v1",
                }
            )

    return pd.DataFrame(snapshot_rows)


def build_fantasy_inputs(
    prediction_snapshots: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
) -> pd.DataFrame:
    if prediction_snapshots.empty:
        return pd.DataFrame(
            columns=[
                "id",
                "season",
                "round",
                "race_id",
                "entity_type",
                "entity_id",
                "constructor_id",
                "projected_score",
                "price_estimate",
                "value_score",
                "winner_probability",
                "podium_probability",
                "top10_probability",
                "volatility_proxy",
                "source_label",
            ]
        )

    driver_rows = prediction_snapshots.copy()
    driver_rows["entity_type"] = "driver"
    driver_rows["entity_id"] = driver_rows["driver_id"]
    driver_rows["price_estimate"] = (8 + driver_rows["predicted_score"] * 0.18).round(1)
    driver_rows["projected_score"] = (driver_rows["winner_probability"] * 0.6 + driver_rows["podium_probability"] * 0.28 + driver_rows["top10_probability"] * 0.12) * 100
    driver_rows["value_score"] = (driver_rows["projected_score"] / driver_rows["price_estimate"]).round(3)
    driver_rows["volatility_proxy"] = (100 - driver_rows["top10_probability"]).round(3)
    driver_rows["source_label"] = "prediction_snapshot_v1"

    constructor_rows = (
        prediction_snapshots.groupby(["season", "round", "race_id", "constructor_id"], as_index=False)
        .agg(
            projected_score=("predicted_score", "mean"),
            winner_probability=("winner_probability", "sum"),
            podium_probability=("podium_probability", "sum"),
            top10_probability=("top10_probability", "mean"),
        )
    )
    constructor_rows["entity_type"] = "constructor"
    constructor_rows["entity_id"] = constructor_rows["constructor_id"]
    constructor_rows["price_estimate"] = (10 + constructor_rows["projected_score"] * 0.22).round(1)
    constructor_rows["value_score"] = (constructor_rows["projected_score"] / constructor_rows["price_estimate"]).round(3)
    constructor_rows["volatility_proxy"] = (100 - constructor_rows["top10_probability"]).round(3)
    constructor_rows["source_label"] = "prediction_snapshot_v1"

    combined = pd.concat(
        [
            driver_rows[
                [
                    "season",
                    "round",
                    "race_id",
                    "entity_type",
                    "entity_id",
                    "constructor_id",
                    "projected_score",
                    "price_estimate",
                    "value_score",
                    "winner_probability",
                    "podium_probability",
                    "top10_probability",
                    "volatility_proxy",
                    "source_label",
                ]
            ],
            constructor_rows[
                [
                    "season",
                    "round",
                    "race_id",
                    "entity_type",
                    "entity_id",
                    "constructor_id",
                    "projected_score",
                    "price_estimate",
                    "value_score",
                    "winner_probability",
                    "podium_probability",
                    "top10_probability",
                    "volatility_proxy",
                    "source_label",
                ]
            ],
        ],
        ignore_index=True,
    )
    combined.insert(0, "id", combined.apply(lambda row: f"{row['race_id']}|{row['entity_type']}|{row['entity_id']}", axis=1))
    return combined.sort_values(["season", "round", "entity_type", "projected_score"], ascending=[True, True, True, False])


def completed_race_frame(frames: CanonicalFrames) -> pd.DataFrame:
    completed_ids = set(frames.race_results["race_id"].dropna().unique().tolist())
    return frames.races[frames.races["id"].isin(completed_ids)].sort_values(["season", "round"])


def teammate_points_delta(previous_results: pd.DataFrame, driver_id: str, constructor_id: str) -> float:
    if previous_results.empty:
        return 0.0
    relevant = previous_results[(previous_results["driver_id"] == driver_id) | (previous_results["constructor_id"] == constructor_id)]
    deltas: list[float] = []
    for race_id, group in relevant.groupby("race_id"):
        driver_rows = group[group["driver_id"] == driver_id]
        teammate_rows = group[(group["constructor_id"] == constructor_id) & (group["driver_id"] != driver_id)]
        if driver_rows.empty or teammate_rows.empty:
            continue
        deltas.append(float(driver_rows.iloc[0]["points"]) - float(teammate_rows["points"].mean()))
    if not deltas:
        return 0.0
    return float(np.mean(deltas[-3:]))


def rolling_mean(series: pd.Series, window: int, default: float) -> float:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return default
    return round(float(clean.tail(window).mean()), 4)


def score_prediction_row(row: pd.Series) -> float:
    finish_component = max(0.0, 18 - float(row["recent_finish_avg_3"])) * 2.3
    qualifying_component = max(0.0, 18 - float(row["recent_qualifying_avg_3"])) * 2.5
    points_component = float(row["recent_points_avg_3"]) * 1.65
    teammate_component = float(row["teammate_points_delta_avg_3"]) * 0.8
    consistency_component = max(0.0, 8 - float(row["finish_consistency_5"])) * 0.9
    reliability_component = float(row["reliability_score"]) * 0.11 - float(row["dnf_rate_5"]) * 12
    constructor_component = float(row["constructor_points_avg_3"]) * 0.4 + max(
        0.0, 18 - float(row["constructor_finish_avg_3"])
    ) * 0.7
    overtake_component = float(row["overtake_score"]) * 0.05
    standing_component = (
        max(0.0, 12 - float(row["driver_standing_position"]))
        if pd.notna(row["driver_standing_position"])
        else 0.0
    )
    return round(
        finish_component
        + qualifying_component
        + points_component
        + teammate_component
        + consistency_component
        + reliability_component
        + constructor_component
        + overtake_component
        + standing_component,
        6,
    )


def softmax_percent(scores: pd.Series, temperature: float) -> np.ndarray:
    array = scores.to_numpy(dtype=float)
    shifted = array - array.max()
    exp_values = np.exp(shifted * temperature)
    probabilities = exp_values / exp_values.sum()
    return probabilities * 100


def probability_band(projected_finish: int, predicted_score: float, top: int) -> float:
    if top == 3:
        base = max(6.0, 88.0 - projected_finish * 11.0)
        return min(96.0, max(4.0, base + predicted_score * 0.12))
    if top == 10:
        base = 98.0 if projected_finish <= 10 else max(8.0, 88.0 - projected_finish * 6.0)
        return min(99.0, max(5.0, base + predicted_score * 0.05))
    return 0.0


def prediction_rationale(row: pd.Series) -> str:
    reasons: list[str] = []
    if float(row["recent_qualifying_avg_3"]) <= 6:
        reasons.append("strong recent qualifying form")
    if float(row["recent_points_avg_3"]) >= 12:
        reasons.append("strong recent points return")
    if float(row["teammate_points_delta_avg_3"]) > 2:
        reasons.append("beating teammate trend")
    if float(row["reliability_score"]) >= 85:
        reasons.append("stable reliability profile")
    if float(row["constructor_points_avg_3"]) >= 18:
        reasons.append("constructor momentum")
    if not reasons:
        reasons.append("balanced baseline signals")
    return "; ".join(reasons[:3])


def main() -> None:
    settings = load_settings()
    frames = load_frames(settings.curated_dir)

    driver_standings = build_driver_standings(frames)
    constructor_standings = build_constructor_standings(frames)
    race_week_context = build_race_week_context(frames)
    model_features = build_model_features(frames, race_week_context, driver_standings, constructor_standings)
    prediction_snapshots = build_prediction_snapshots(frames, race_week_context, model_features)
    fantasy_inputs = build_fantasy_inputs(prediction_snapshots, frames.drivers, frames.constructors)

    write_csv(driver_standings, settings.curated_dir / "driver_standings.csv")
    write_csv(constructor_standings, settings.curated_dir / "constructor_standings.csv")
    write_csv(race_week_context, settings.curated_dir / "race_week_context.csv")
    write_csv(model_features, settings.curated_dir / "model_features.csv")
    write_csv(prediction_snapshots, settings.curated_dir / "prediction_snapshots.csv")
    write_csv(fantasy_inputs, settings.curated_dir / "fantasy_inputs.csv")

    summary = {
        "generated_at": datetime.now(tz=UTC).isoformat(),
        "driver_standings_rows": len(driver_standings),
        "constructor_standings_rows": len(constructor_standings),
        "race_week_context_rows": len(race_week_context),
        "model_features_rows": len(model_features),
        "prediction_snapshots_rows": len(prediction_snapshots),
        "fantasy_inputs_rows": len(fantasy_inputs),
        "model_version": "pre_race_ranker_v1",
    }
    (settings.curated_dir / "product_views_summary.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
