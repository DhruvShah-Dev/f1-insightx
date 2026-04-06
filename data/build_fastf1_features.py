from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from f1_insightx_data.fastf1_pipeline import combined_historical_weight, staged_session_directories, write_frame
from f1_insightx_data.settings import load_settings


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path)


def load_staged_fastf1_frames(settings) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    session_summaries: list[pd.DataFrame] = []
    stint_frames: list[pd.DataFrame] = []
    result_frames: list[pd.DataFrame] = []

    for session_dir in staged_session_directories(settings):
        summary = read_csv(session_dir / "session_summary.csv")
        if not summary.empty:
            session_summaries.append(summary)

        stints = read_csv(session_dir / "stints.csv")
        if not stints.empty:
            stint_frames.append(stints)

        results = read_csv(session_dir / "results.csv")
        if not results.empty:
            results["session_code"] = session_dir.name.upper()
            result_frames.append(results)

    return (
        pd.concat(session_summaries, ignore_index=True) if session_summaries else pd.DataFrame(),
        pd.concat(stint_frames, ignore_index=True) if stint_frames else pd.DataFrame(),
        pd.concat(result_frames, ignore_index=True) if result_frames else pd.DataFrame(),
    )


def build_driver_form_snapshots(session_summary: pd.DataFrame) -> pd.DataFrame:
    if session_summary.empty:
        return pd.DataFrame()

    rows: list[dict[str, object]] = []
    grouped = session_summary.groupby(["season", "round", "event_name", "driver", "team"], dropna=False)

    for (season, round_number, event_name, driver, team), driver_rows in grouped:
        fp1 = driver_rows[driver_rows["session_code"] == "FP1"]
        fp2 = driver_rows[driver_rows["session_code"] == "FP2"]
        fp3 = driver_rows[driver_rows["session_code"] == "FP3"]
        quali = driver_rows[driver_rows["session_code"] == "Q"]

        history = session_summary[
            (session_summary["driver"] == driver)
            & (
                (session_summary["season"] < season)
                | ((session_summary["season"] == season) & (session_summary["round"] < round_number))
            )
        ]

        weighted_gap = 0.0
        weighted_pace_rank = 0.0
        total_weight = 0.0
        for _, prior in history.iterrows():
            weight = combined_historical_weight(
                int(prior["season"]),
                int(prior["round"]),
                int(season),
                int(round_number),
                str(prior["session_code"]),
            )
            weighted_gap += float(prior.get("gap_to_session_best_s", 0.0) or 0.0) * weight
            weighted_pace_rank += float(prior.get("pace_rank", 0.0) or 0.0) * weight
            total_weight += weight

        rows.append(
            {
                "id": f"{int(season)}-{int(round_number):02d}|{driver}",
                "season": int(season),
                "round": int(round_number),
                "race_id": f"{int(season)}-{int(round_number):02d}",
                "driver_id": driver,
                "constructor_id": team,
                "regulation_era": driver_rows["regulation_era"].iloc[0],
                "season_weight": 1.0,
                "session_completeness": int(driver_rows["session_code"].nunique()),
                "recent_pace_rank": round(weighted_pace_rank / total_weight, 4) if total_weight else None,
                "recent_gap_to_best_s": round(weighted_gap / total_weight, 4) if total_weight else None,
                "fp1_setup_gap_s": float(fp1["gap_to_session_best_s"].mean()) if not fp1.empty else None,
                "fp2_long_run_pace_s": float(fp2["long_run_lap_s"].mean()) if not fp2.empty else None,
                "fp2_degradation_s_per_lap": float(fp2["long_run_degradation_s"].mean()) if not fp2.empty else None,
                "fp3_short_run_pace_s": float(fp3["representative_lap_s"].mean()) if not fp3.empty else None,
                "qualifying_pace_s": float(quali["best_lap_s"].mean()) if not quali.empty else None,
                "teammate_delta_s": float(driver_rows["gap_to_teammate_s"].mean()),
                "top_speed_kph": float(driver_rows["top_speed_kph"].max()),
                "reliability_index": round(100 - (driver_rows["session_code"].nunique() < 2) * 20, 2),
                "weather_risk_index": round(driver_rows["rainfall_flag"].astype(int).mean() * 100, 2),
                "source_label": "fastf1_session_feature_v1",
            }
        )

    return pd.DataFrame(rows)


def build_constructor_form_snapshots(driver_form: pd.DataFrame) -> pd.DataFrame:
    if driver_form.empty:
        return pd.DataFrame()

    rows: list[dict[str, object]] = []
    for (season, round_number, constructor_id), team_rows in driver_form.groupby(
        ["season", "round", "constructor_id"], dropna=False
    ):
        rows.append(
            {
                "id": f"{int(season)}-{int(round_number):02d}|{constructor_id}",
                "season": int(season),
                "round": int(round_number),
                "race_id": f"{int(season)}-{int(round_number):02d}",
                "constructor_id": constructor_id,
                "regulation_era": team_rows["regulation_era"].iloc[0],
                "two_car_long_run_pace_s": float(team_rows["fp2_long_run_pace_s"].mean()) if team_rows["fp2_long_run_pace_s"].notna().any() else None,
                "two_car_quali_pace_s": float(team_rows["qualifying_pace_s"].mean()) if team_rows["qualifying_pace_s"].notna().any() else None,
                "recent_pace_rank": float(team_rows["recent_pace_rank"].mean()) if team_rows["recent_pace_rank"].notna().any() else None,
                "reliability_index": float(team_rows["reliability_index"].mean()),
                "weather_risk_index": float(team_rows["weather_risk_index"].mean()),
                "source_label": "fastf1_constructor_form_v1",
            }
        )

    return pd.DataFrame(rows)


def build_stint_model_inputs(stints: pd.DataFrame) -> pd.DataFrame:
    if stints.empty:
        return pd.DataFrame()

    filtered = stints[stints["session_code"].isin(["FP1", "FP2", "FP3", "R", "S"])].copy()
    filtered["practice_importance"] = filtered["session_code"].map({"FP1": 0.5, "FP2": 1.0, "FP3": 0.65, "S": 0.8, "R": 1.1}).fillna(0.5)
    filtered["degradation_risk"] = (filtered["degradation_per_lap_s"].fillna(0).clip(lower=-1, upper=3) * 30).round(3)
    filtered["tyre_life_index"] = filtered["lap_count"].fillna(0) + filtered["end_tyre_life"].fillna(0)
    return filtered.rename(columns={"driver": "driver_id", "team": "constructor_id"})


def build_prediction_model_inputs(driver_form: pd.DataFrame, constructor_form: pd.DataFrame) -> pd.DataFrame:
    if driver_form.empty:
        return pd.DataFrame()

    constructor_lookup = constructor_form.set_index(["season", "round", "constructor_id"])
    rows: list[dict[str, object]] = []
    for _, row in driver_form.iterrows():
        constructor_key = (int(row["season"]), int(row["round"]), row["constructor_id"])
        constructor_row = constructor_lookup.loc[constructor_key] if constructor_key in constructor_lookup.index else None
        rows.append(
            {
                "id": row["id"],
                "season": int(row["season"]),
                "round": int(row["round"]),
                "race_id": row["race_id"],
                "driver_id": row["driver_id"],
                "constructor_id": row["constructor_id"],
                "regulation_era": row["regulation_era"],
                "session_completeness": row["session_completeness"],
                "recent_pace_rank": row["recent_pace_rank"],
                "recent_gap_to_best_s": row["recent_gap_to_best_s"],
                "fp1_setup_gap_s": row["fp1_setup_gap_s"],
                "fp2_long_run_pace_s": row["fp2_long_run_pace_s"],
                "fp2_degradation_s_per_lap": row["fp2_degradation_s_per_lap"],
                "fp3_short_run_pace_s": row["fp3_short_run_pace_s"],
                "qualifying_pace_s": row["qualifying_pace_s"],
                "teammate_delta_s": row["teammate_delta_s"],
                "constructor_long_run_pace_s": constructor_row["two_car_long_run_pace_s"] if constructor_row is not None else None,
                "constructor_quali_pace_s": constructor_row["two_car_quali_pace_s"] if constructor_row is not None else None,
                "constructor_reliability_index": constructor_row["reliability_index"] if constructor_row is not None else None,
                "weather_risk_index": row["weather_risk_index"],
                "driver_reliability_index": row["reliability_index"],
                "source_label": "fastf1_prediction_features_v1",
            }
        )

    return pd.DataFrame(rows)


def main() -> None:
    settings = load_settings()
    session_summary, stints, _results = load_staged_fastf1_frames(settings)

    driver_form = build_driver_form_snapshots(session_summary)
    constructor_form = build_constructor_form_snapshots(driver_form)
    stint_model_inputs = build_stint_model_inputs(stints)
    prediction_model_inputs = build_prediction_model_inputs(driver_form, constructor_form)

    settings.features_dir.mkdir(parents=True, exist_ok=True)
    settings.model_inputs_dir.mkdir(parents=True, exist_ok=True)

    write_frame(driver_form, settings.features_dir / "driver_form_snapshots.csv")
    write_frame(constructor_form, settings.features_dir / "constructor_form_snapshots.csv")
    write_frame(stint_model_inputs, settings.model_inputs_dir / "stint_model_inputs.csv")
    write_frame(prediction_model_inputs, settings.model_inputs_dir / "prediction_model_inputs.csv")

    summary = {
        "driver_form_rows": int(len(driver_form)),
        "constructor_form_rows": int(len(constructor_form)),
        "stint_model_input_rows": int(len(stint_model_inputs)),
        "prediction_model_input_rows": int(len(prediction_model_inputs)),
        "feature_version": "fastf1_feature_stack_v1",
    }
    (settings.features_dir / "fastf1_feature_summary.json").write_text(
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
