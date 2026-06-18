from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pandas as pd

from f1_insightx_data.io import read_csv_or_empty, write_csv
from f1_insightx_data.settings import load_settings


def scale_lower_better(series: pd.Series, default: float = 0.5) -> pd.Series:
    clean = pd.to_numeric(series, errors="coerce")
    if clean.notna().sum() <= 1:
        return pd.Series(default, index=series.index)
    return 1 - (clean - clean.min()) / max(clean.max() - clean.min(), 1e-6)


def scale_higher_better(series: pd.Series, default: float = 0.5) -> pd.Series:
    clean = pd.to_numeric(series, errors="coerce")
    if clean.notna().sum() <= 1:
        return pd.Series(default, index=series.index)
    return (clean - clean.min()) / max(clean.max() - clean.min(), 1e-6)


def softmax_percent(values: pd.Series, temperature: float = 6.0) -> np.ndarray:
    array = values.to_numpy(dtype=float)
    centered = array - array.max()
    exp_values = np.exp(centered * temperature)
    probabilities = exp_values / exp_values.sum()
    return probabilities * 100


def build_prediction_rationale(row: pd.Series) -> str:
    reasons: list[str] = []
    if pd.notna(row.get("fp2_long_run_pace_s")):
        reasons.append("FP2 long-run pace is in the prediction mix")
    if pd.notna(row.get("qualifying_pace_s")):
        reasons.append("qualifying pace anchors single-lap competitiveness")
    if pd.notna(row.get("teammate_delta_s")) and float(row["teammate_delta_s"]) < 0:
        reasons.append("teammate delta is positive")
    if pd.notna(row.get("driver_reliability_index")) and float(row["driver_reliability_index"]) >= 80:
        reasons.append("reliability signal is stable")
    if not reasons:
        reasons.append("session coverage is limited, so confidence is restrained")
    return "; ".join(reasons[:3])


def build_prediction_snapshots(features: pd.DataFrame) -> pd.DataFrame:
    if features.empty:
        return pd.DataFrame()

    generated_at = datetime.now(tz=UTC).isoformat()
    rows: list[dict[str, object]] = []

    for (season, round_number, race_id), frame in features.groupby(["season", "round", "race_id"], dropna=False):
        scored = frame.copy()
        scored["fp2_signal"] = scale_lower_better(scored["fp2_long_run_pace_s"]).fillna(0.5)
        scored["quali_signal"] = scale_lower_better(scored["qualifying_pace_s"]).fillna(0.5)
        scored["fp3_signal"] = scale_lower_better(scored["fp3_short_run_pace_s"]).fillna(0.5)
        scored["teammate_signal"] = scale_lower_better(scored["teammate_delta_s"]).fillna(0.5)
        scored["reliability_signal"] = scale_higher_better(scored["driver_reliability_index"]).fillna(0.5)
        scored["constructor_signal"] = scale_higher_better(
            100 - pd.to_numeric(scored["constructor_reliability_index"], errors="coerce").fillna(50)
        ).fillna(0.5)
        scored["weather_penalty"] = pd.to_numeric(scored["weather_risk_index"], errors="coerce").fillna(0) / 100
        scored["session_penalty"] = (3 - pd.to_numeric(scored["session_completeness"], errors="coerce").fillna(0)).clip(lower=0) * 0.03

        scored["predicted_score"] = (
            scored["fp2_signal"] * 0.32
            + scored["quali_signal"] * 0.24
            + scored["fp3_signal"] * 0.12
            + scored["teammate_signal"] * 0.1
            + scored["reliability_signal"] * 0.14
            + scored["constructor_signal"] * 0.08
            - scored["weather_penalty"] * 0.06
            - scored["session_penalty"]
        )

        scored = scored.sort_values("predicted_score", ascending=False).reset_index(drop=True)
        scored["projected_finish"] = scored.index + 1
        scored["winner_probability"] = softmax_percent(scored["predicted_score"], temperature=7.5)
        scored["podium_probability"] = np.maximum(4, 88 - scored["projected_finish"] * 12 + scored["predicted_score"] * 8)
        scored["top10_probability"] = np.maximum(8, 98 - np.maximum(0, scored["projected_finish"] - 10) * 6)
        scored["confidence_score"] = np.clip(
            0.55
            + scored["reliability_signal"] * 0.2
            + scored["session_completeness"].fillna(0) * 0.05
            - scored["weather_penalty"] * 0.15,
            0.15,
            0.95,
        )

        for _, row in scored.iterrows():
            rows.append(
                {
                    "id": f"{race_id}|{row['driver_id']}|fastf1_v1",
                    "season": int(season),
                    "round": int(round_number),
                    "race_id": race_id,
                    "driver_id": row["driver_id"],
                    "constructor_id": row["constructor_id"],
                    "generated_at": generated_at,
                    "model_version": "fastf1_race_week_baseline_v1",
                    "predicted_score": round(float(row["predicted_score"]), 6),
                    "projected_finish": int(row["projected_finish"]),
                    "winner_probability": round(float(row["winner_probability"]), 3),
                    "podium_probability": round(float(min(99, row["podium_probability"])), 3),
                    "top10_probability": round(float(min(99, row["top10_probability"])), 3),
                    "confidence_score": round(float(row["confidence_score"]), 3),
                    "rationale": build_prediction_rationale(row),
                    "source_label": "fastf1_prediction_baseline_v1",
                }
            )

    return pd.DataFrame(rows)


def build_strategy_baselines(stints: pd.DataFrame, prediction_features: pd.DataFrame) -> pd.DataFrame:
    if stints.empty:
        return pd.DataFrame()

    fp2 = stints[stints["session_code"] == "FP2"].copy()
    if fp2.empty:
        fp2 = stints.copy()

    rows: list[dict[str, object]] = []
    feature_lookup = prediction_features.set_index(["season", "round", "driver_id"]) if not prediction_features.empty else None

    for (season, round_number, driver_id), driver_rows in fp2.groupby(["season", "round", "driver_id"], dropna=False):
        fastest_stint = driver_rows.sort_values("mean_lap_time_s").head(1)
        if fastest_stint.empty:
            continue

        best = fastest_stint.iloc[0]
        degradation = float(best.get("degradation_per_lap_s") or 0.0)
        lap_count = int(best.get("lap_count") or 0)
        preferred_secondary = (
            driver_rows.sort_values(["lap_count", "mean_lap_time_s"], ascending=[False, True]).iloc[0]["compound"]
            if len(driver_rows) > 1
            else best["compound"]
        )
        recommended_stop_count = 1 if degradation < 0.04 and lap_count >= 10 else 2
        pit_window_center = max(10, min(48, int(22 + degradation * 40 + (12 - lap_count) * 0.4)))
        confidence = 0.82 if best["session_code"] == "FP2" else 0.58

        rationale = (
            f"{best['session_code']} {best['compound']} stint showed {lap_count} laps with "
            f"{degradation:.3f}s/lap degradation, supporting a {recommended_stop_count}-stop baseline."
        )

        constructor_id = best["constructor_id"]
        if feature_lookup is not None and (int(season), int(round_number), driver_id) in feature_lookup.index:
            constructor_id = feature_lookup.loc[(int(season), int(round_number), driver_id)]["constructor_id"]

        rows.append(
            {
                "id": f"{int(season)}-{int(round_number):02d}|{driver_id}",
                "season": int(season),
                "round": int(round_number),
                "race_id": f"{int(season)}-{int(round_number):02d}",
                "driver_id": driver_id,
                "constructor_id": constructor_id,
                "recommended_stop_count": recommended_stop_count,
                "preferred_primary_compound": best["compound"],
                "preferred_secondary_compound": preferred_secondary,
                "pit_window_start_lap": max(1, pit_window_center - 4),
                "pit_window_end_lap": pit_window_center + 4,
                "tyre_life_index": round(float(best.get("tyre_life_index") or 0.0), 3),
                "degradation_risk": round(float(best.get("degradation_risk") or 0.0), 3),
                "strategy_confidence": round(confidence, 3),
                "rationale": rationale,
                "source_label": "fastf1_strategy_baseline_v1",
            }
        )

    return pd.DataFrame(rows)


def main() -> None:
    settings = load_settings()
    prediction_features = read_csv_or_empty(settings.model_inputs_dir / "prediction_model_inputs.csv")
    stint_inputs = read_csv_or_empty(settings.model_inputs_dir / "stint_model_inputs.csv")

    prediction_snapshots = build_prediction_snapshots(prediction_features)
    strategy_baselines = build_strategy_baselines(stint_inputs, prediction_features)

    write_csv(prediction_snapshots, settings.predictions_dir / "fastf1_prediction_snapshots.csv")
    write_csv(strategy_baselines, settings.predictions_dir / "strategy_baselines.csv")


if __name__ == "__main__":
    main()
