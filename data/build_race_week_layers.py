from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.fastf1_pipeline import staged_session_directories, write_frame
from f1_insightx_data.settings import load_settings


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path)


def normalize_key(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return (
        str(value)
        .strip()
        .lower()
        .replace("&", "and")
        .replace("-", "_")
        .replace(" ", "_")
    )


def pick_first(row: pd.Series, candidates: list[str]) -> Any:
    for candidate in candidates:
        if candidate in row.index and pd.notna(row[candidate]) and str(row[candidate]).strip() != "":
            return row[candidate]
    return None


def driver_lookup_map(drivers: pd.DataFrame) -> dict[str, str]:
    lookup: dict[str, str] = {}
    if drivers.empty:
        return lookup

    for _, row in drivers.iterrows():
        driver_id = str(row["id"])
        values = {
            driver_id,
            normalize_key(row.get("driver_code")),
            normalize_key(row.get("full_name")),
            normalize_key(row.get("first_name")),
            normalize_key(row.get("last_name")),
        }
        last_name = normalize_key(row.get("last_name"))
        if last_name:
            values.add(last_name)
        for value in values:
            if value:
                lookup[value] = driver_id
                lookup[value.upper()] = driver_id
    return lookup


def constructor_lookup_map(constructors: pd.DataFrame) -> dict[str, str]:
    lookup: dict[str, str] = {}
    if constructors.empty:
        return lookup

    aliases = {
        "red_bull_racing": "red_bull",
        "oracle_red_bull_racing": "red_bull",
        "visa_cash_app_racing_bulls": "rb",
        "racing_bulls": "rb",
        "rb_f1_team": "rb",
        "stake_f1_team_kick_sauber": "sauber",
        "alpine_f1_team": "alpine",
        "aston_martin_aramco": "aston_martin",
        "mercedes_amg_petronas_f1_team": "mercedes",
        "mclaren_formula_1_team": "mclaren",
        "scuderia_ferrari": "ferrari",
        "atlassian_williams_racing": "williams",
    }

    for _, row in constructors.iterrows():
        constructor_id = str(row["id"])
        values = {
            constructor_id,
            normalize_key(row.get("constructor_code")),
            normalize_key(row.get("name")),
        }
        for value in list(values):
            if value in aliases:
                values.add(aliases[value])
        for value in values:
            if value:
                lookup[value] = constructor_id
                lookup[value.upper()] = constructor_id
    return lookup


def resolve_driver_id(value: Any, lookup: dict[str, str]) -> str | None:
    raw = str(value).strip() if value is not None and not pd.isna(value) else ""
    if not raw:
        return None
    return lookup.get(raw) or lookup.get(normalize_key(raw)) or lookup.get(raw.upper()) or None


def resolve_constructor_id(value: Any, lookup: dict[str, str]) -> str | None:
    raw = str(value).strip() if value is not None and not pd.isna(value) else ""
    if not raw:
        return None
    return lookup.get(raw) or lookup.get(normalize_key(raw)) or lookup.get(raw.upper()) or None


def normalize_feature_ids(
    frame: pd.DataFrame,
    *,
    driver_column: str | None,
    constructor_column: str | None,
    driver_lookup: dict[str, str],
    constructor_lookup: dict[str, str],
) -> pd.DataFrame:
    if frame.empty:
        return frame
    normalized = frame.copy()
    if driver_column and driver_column in normalized.columns:
        normalized[driver_column] = normalized[driver_column].apply(
            lambda value: resolve_driver_id(value, driver_lookup) or normalize_key(value)
        )
    if constructor_column and constructor_column in normalized.columns:
        normalized[constructor_column] = normalized[constructor_column].apply(
            lambda value: resolve_constructor_id(value, constructor_lookup) or normalize_key(value)
        )
    return normalized


def race_lookup_map(races: pd.DataFrame) -> dict[tuple[int, int], str]:
    if races.empty:
        return {}
    return {
        (int(row["season"]), int(row["round"])): str(row["id"])
        for _, row in races.iterrows()
    }


def infer_session_context(session_dir: Path, frames: list[pd.DataFrame]) -> tuple[int | None, int | None, str | None]:
    manifest_path = session_dir / "session_manifest.json"
    if manifest_path.exists():
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        return int(payload.get("season") or 0), int(payload.get("round") or 0), payload.get("event_name")

    for frame in frames:
        if frame.empty:
            continue
        season = frame.get("season")
        round_number = frame.get("round")
        event_name = frame.get("event_name")
        if season is not None and round_number is not None and event_name is not None:
            return int(frame["season"].iloc[0]), int(frame["round"].iloc[0]), str(frame["event_name"].iloc[0])

    return None, None, None


def build_canonical_session_layer(
    settings,
    *,
    races: pd.DataFrame,
    driver_lookup: dict[str, str],
    constructor_lookup: dict[str, str],
) -> dict[str, pd.DataFrame]:
    race_lookup = race_lookup_map(races)
    sessions_rows: list[dict[str, Any]] = []
    entry_rows: list[dict[str, Any]] = []
    result_rows: list[dict[str, Any]] = []
    lap_rows: list[dict[str, Any]] = []
    stint_rows: list[dict[str, Any]] = []
    weather_rows: list[dict[str, Any]] = []
    pace_rows: list[dict[str, Any]] = []

    seen_sessions: set[str] = set()
    seen_entries: set[str] = set()

    for session_dir in staged_session_directories(settings):
        session_code = session_dir.name.upper()
        summary = read_csv(session_dir / "session_summary.csv")
        laps = read_csv(session_dir / "laps.csv")
        stints = read_csv(session_dir / "stints.csv")
        results = read_csv(session_dir / "results.csv")
        weather = read_csv(session_dir / "weather.csv")
        season, round_number, event_name = infer_session_context(session_dir, [summary, laps, stints])
        if not season or not round_number:
            continue

        race_id = race_lookup.get((season, round_number))
        if not race_id:
            continue

        session_id = f"{race_id}|{session_code}"
        if session_id not in seen_sessions:
            sessions_rows.append(
                {
                    "id": session_id,
                    "race_id": race_id,
                    "season": season,
                    "round": round_number,
                    "session_code": session_code,
                    "session_name": session_code,
                    "event_name": event_name or race_id,
                    "scheduled_at": None,
                    "source_label": "fastf1_canonical_v1",
                }
            )
            seen_sessions.add(session_id)

        entrant_sources: list[pd.DataFrame] = []
        if not summary.empty and {"driver", "team"}.issubset(summary.columns):
            entrant_sources.append(summary[["driver", "team"]].rename(columns={"driver": "driver_ref", "team": "team_ref"}))
        if not laps.empty and {"driver", "team"}.issubset(laps.columns):
            entrant_sources.append(laps[["driver", "team"]].rename(columns={"driver": "driver_ref", "team": "team_ref"}))
        if not stints.empty and {"driver", "team"}.issubset(stints.columns):
            entrant_sources.append(stints[["driver", "team"]].rename(columns={"driver": "driver_ref", "team": "team_ref"}))

        if entrant_sources:
            entrants = pd.concat(entrant_sources, ignore_index=True).drop_duplicates()
            for _, entrant in entrants.iterrows():
                driver_id = resolve_driver_id(entrant["driver_ref"], driver_lookup)
                constructor_id = resolve_constructor_id(entrant["team_ref"], constructor_lookup)
                if not driver_id or not constructor_id:
                    continue
                entry_id = f"{race_id}|{driver_id}"
                if entry_id in seen_entries:
                    continue
                entry_rows.append(
                    {
                        "id": entry_id,
                        "race_id": race_id,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "source_label": "fastf1_entry_v1",
                    }
                )
                seen_entries.add(entry_id)

        if not summary.empty:
            normalized_summary = summary.copy()
            normalized_summary["driver_id"] = normalized_summary["driver"].apply(lambda value: resolve_driver_id(value, driver_lookup))
            normalized_summary["constructor_id"] = normalized_summary["team"].apply(lambda value: resolve_constructor_id(value, constructor_lookup))
            normalized_summary = normalized_summary.dropna(subset=["driver_id", "constructor_id"])
            for _, row in normalized_summary.iterrows():
                pace_rows.append(
                    {
                        "id": f"{session_id}|{row['driver_id']}",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "session_id": session_id,
                        "session_code": session_code,
                        "driver_id": row["driver_id"],
                        "constructor_id": row["constructor_id"],
                        "representative_lap_s": row.get("representative_lap_s"),
                        "best_lap_s": row.get("best_lap_s"),
                        "long_run_lap_s": row.get("long_run_lap_s"),
                        "long_run_degradation_s": row.get("long_run_degradation_s"),
                        "gap_to_session_best_s": row.get("gap_to_session_best_s"),
                        "pace_rank": row.get("pace_rank"),
                        "gap_to_teammate_s": row.get("gap_to_teammate_s"),
                        "top_speed_kph": row.get("top_speed_kph"),
                        "air_temp_c": row.get("air_temp_c"),
                        "track_temp_c": row.get("track_temp_c"),
                        "rainfall_flag": bool(row.get("rainfall_flag")) if pd.notna(row.get("rainfall_flag")) else False,
                        "source_label": "race_week_session_pace_v1",
                    }
                )

        if not laps.empty:
            normalized_laps = laps.copy()
            normalized_laps["driver_id"] = normalized_laps["driver"].apply(lambda value: resolve_driver_id(value, driver_lookup))
            normalized_laps["constructor_id"] = normalized_laps["team"].apply(lambda value: resolve_constructor_id(value, constructor_lookup))
            normalized_laps = normalized_laps.dropna(subset=["driver_id", "constructor_id"])
            for _, row in normalized_laps.iterrows():
                event_entry_id = f"{race_id}|{row['driver_id']}"
                lap_number = int(row["lap_number"]) if pd.notna(row.get("lap_number")) else 0
                top_speed_candidates = [row.get("speed_i1"), row.get("speed_i2"), row.get("speed_fl"), row.get("speed_st")]
                top_speed = pd.to_numeric(pd.Series(top_speed_candidates), errors="coerce").max()
                lap_rows.append(
                    {
                        "id": f"{session_id}|{row['driver_id']}|{lap_number}",
                        "session_id": session_id,
                        "event_entry_id": event_entry_id,
                        "race_id": race_id,
                        "driver_id": row["driver_id"],
                        "constructor_id": row["constructor_id"],
                        "lap_number": lap_number,
                        "stint_number": int(row["stint"]) if pd.notna(row.get("stint")) else None,
                        "compound": row.get("compound"),
                        "tyre_life": int(row["tyre_life"]) if pd.notna(row.get("tyre_life")) else None,
                        "lap_time_s": row.get("lap_time_s"),
                        "sector_1_s": row.get("sector_1_s"),
                        "sector_2_s": row.get("sector_2_s"),
                        "sector_3_s": row.get("sector_3_s"),
                        "top_speed_kph": top_speed if pd.notna(top_speed) else None,
                        "track_status": row.get("track_status"),
                        "fresh_tyre": bool(row.get("fresh_tyre")) if pd.notna(row.get("fresh_tyre")) else False,
                        "is_personal_best": bool(row.get("is_personal_best")) if pd.notna(row.get("is_personal_best")) else False,
                        "is_accurate": bool(row.get("is_accurate")) if pd.notna(row.get("is_accurate")) else False,
                        "deleted": bool(row.get("deleted")) if pd.notna(row.get("deleted")) else False,
                        "lap_start_time": row.get("lap_start_time"),
                        "position": int(row["position"]) if pd.notna(row.get("position")) else None,
                        "air_temp_c": row.get("air_temp_c"),
                        "track_temp_c": row.get("track_temp_c"),
                        "humidity_pct": row.get("humidity_pct"),
                        "rainfall": bool(row.get("rainfall")) if pd.notna(row.get("rainfall")) else False,
                        "wind_speed_mps": row.get("wind_speed_mps"),
                        "wind_direction_deg": row.get("wind_direction_deg"),
                        "source_label": "fastf1_session_lap_v1",
                    }
                )

        if not stints.empty:
            normalized_stints = stints.copy()
            normalized_stints["driver_id"] = normalized_stints["driver"].apply(lambda value: resolve_driver_id(value, driver_lookup))
            normalized_stints["constructor_id"] = normalized_stints["team"].apply(lambda value: resolve_constructor_id(value, constructor_lookup))
            normalized_stints = normalized_stints.dropna(subset=["driver_id", "constructor_id"])
            for _, row in normalized_stints.iterrows():
                event_entry_id = f"{race_id}|{row['driver_id']}"
                stint_number = int(row["stint"]) if pd.notna(row.get("stint")) else 0
                stint_rows.append(
                    {
                        "id": f"{session_id}|{row['driver_id']}|{stint_number}",
                        "session_id": session_id,
                        "event_entry_id": event_entry_id,
                        "race_id": race_id,
                        "driver_id": row["driver_id"],
                        "constructor_id": row["constructor_id"],
                        "stint_number": stint_number,
                        "compound": row.get("compound"),
                        "lap_count": int(row["lap_count"]) if pd.notna(row.get("lap_count")) else None,
                        "mean_lap_time_s": row.get("mean_lap_time_s"),
                        "degradation_per_lap_s": row.get("degradation_per_lap_s"),
                        "degradation_index": row.get("degradation_index"),
                        "start_tyre_life": int(row["start_tyre_life"]) if pd.notna(row.get("start_tyre_life")) else None,
                        "end_tyre_life": int(row["end_tyre_life"]) if pd.notna(row.get("end_tyre_life")) else None,
                        "session_code": row.get("session_code") or session_code,
                        "source_label": "fastf1_session_stint_v1",
                    }
                )

        if not weather.empty:
            normalized_weather = weather.copy().reset_index(drop=True)
            for idx, row in normalized_weather.iterrows():
                rainfall_value = pick_first(row, ["Rainfall"])
                weather_rows.append(
                    {
                        "id": f"{session_id}|{idx + 1}",
                        "session_id": session_id,
                        "race_id": race_id,
                        "sample_order": idx + 1,
                        "sample_time": pick_first(row, ["Time", "SessionTime"]),
                        "air_temp_c": pick_first(row, ["AirTemp"]),
                        "track_temp_c": pick_first(row, ["TrackTemp"]),
                        "humidity_pct": pick_first(row, ["Humidity"]),
                        "pressure_hpa": pick_first(row, ["Pressure"]),
                        "rainfall": bool(rainfall_value) if pd.notna(rainfall_value) else False,
                        "wind_speed_mps": pick_first(row, ["WindSpeed"]),
                        "wind_direction_deg": pick_first(row, ["WindDirection"]),
                        "source_label": "fastf1_session_weather_v1",
                    }
                )

        if not results.empty:
            normalized_results = results.copy().reset_index(drop=True)
            for _, row in normalized_results.iterrows():
                driver_id = resolve_driver_id(pick_first(row, ["Abbreviation", "Driver", "BroadcastName"]), driver_lookup)
                constructor_id = resolve_constructor_id(
                    pick_first(row, ["TeamName", "Team", "Constructor", "Entrant"]),
                    constructor_lookup,
                )
                if not driver_id or not constructor_id:
                    continue
                event_entry_id = f"{race_id}|{driver_id}"
                result_rows.append(
                    {
                        "id": f"{session_id}|{driver_id}",
                        "session_id": session_id,
                        "event_entry_id": event_entry_id,
                        "race_id": race_id,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "classification_position": pick_first(row, ["ClassifiedPosition", "Position"]),
                        "grid_position": pick_first(row, ["GridPosition"]),
                        "finish_position": pick_first(row, ["Position", "ClassifiedPosition"]),
                        "points": pick_first(row, ["Points"]),
                        "status": pick_first(row, ["Status", "Time"]),
                        "laps_completed": pick_first(row, ["Laps"]),
                        "fastest_lap_rank": pick_first(row, ["FastestLapRank"]),
                        "source_label": "fastf1_session_result_v1",
                    }
                )

    return {
        "sessions": pd.DataFrame(sessions_rows),
        "event_entries": pd.DataFrame(entry_rows),
        "session_results": pd.DataFrame(result_rows),
        "session_laps": pd.DataFrame(lap_rows),
        "session_stints": pd.DataFrame(stint_rows),
        "session_weather": pd.DataFrame(weather_rows),
        "session_pace_summary": pd.DataFrame(pace_rows),
    }


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


def classify_circuit(row: pd.Series) -> str:
    high_speed = float(row.get("high_speed_bias") or 0)
    overtake = float(row.get("overtake_difficulty") or 0)
    degradation = float(row.get("tire_degradation_bias") or 0)
    if degradation >= 7:
        return "High-degradation circuit"
    if high_speed >= 7:
        return "High-speed circuit"
    if overtake <= 4:
        return "Track-position circuit"
    return "Balanced circuit"


def difficulty_band(score: float) -> str:
    if score >= 70:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def confidence_band(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def clamp01(value: Any, default: float = 0.0) -> float:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return default
    return float(min(1.0, max(0.0, number)))


def mean_or_none(series: pd.Series) -> float | None:
    values = pd.to_numeric(series, errors="coerce").dropna()
    if values.empty:
        return None
    return float(values.mean())


def build_processed_race_week_layers(
    *,
    canonical: dict[str, pd.DataFrame],
    races: pd.DataFrame,
    circuits: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
    qualifying_results: pd.DataFrame,
    race_results: pd.DataFrame,
    strategy_profiles: pd.DataFrame,
    driver_standings: pd.DataFrame,
    constructor_standings: pd.DataFrame,
    race_week_context: pd.DataFrame,
    prediction_snapshots: pd.DataFrame,
    driver_form: pd.DataFrame,
    strategy_baselines: pd.DataFrame,
    fastf1_predictions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    session_pace = canonical["session_pace_summary"].copy()
    stints = canonical["session_stints"].copy()
    weather = canonical["session_weather"].copy()

    fp2_long_run = pd.DataFrame()
    if not session_pace.empty:
        fp2_long_run = session_pace[session_pace["session_code"] == "FP2"].copy()
        if not fp2_long_run.empty:
            fp2_long_run["gap_to_best_s"] = pd.to_numeric(fp2_long_run["long_run_lap_s"], errors="coerce") - pd.to_numeric(
                fp2_long_run["long_run_lap_s"], errors="coerce"
            ).min()
            lap_counts = (
                stints[stints["session_code"] == "FP2"]
                .groupby(["race_id", "driver_id"], dropna=False)["lap_count"]
                .sum()
                .rename("lap_sample_size")
                .reset_index()
            )
            fp2_long_run = fp2_long_run.merge(lap_counts, on=["race_id", "driver_id"], how="left")
            fp2_long_run["signal_confidence"] = (
                pd.to_numeric(fp2_long_run["lap_sample_size"], errors="coerce").fillna(0).clip(lower=0, upper=14) / 14
            ).round(3)
            fp2_long_run["compound"] = None
            fp2_long_run["id"] = fp2_long_run.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
            fp2_long_run = fp2_long_run[
                [
                    "id",
                    "season",
                    "round",
                    "race_id",
                    "driver_id",
                    "constructor_id",
                    "long_run_lap_s",
                    "gap_to_best_s",
                    "long_run_degradation_s",
                    "lap_sample_size",
                    "compound",
                    "signal_confidence",
                ]
            ].rename(
                columns={
                    "long_run_lap_s": "representative_long_run_pace_s",
                    "long_run_degradation_s": "degradation_per_lap_s",
                }
            )
            fp2_long_run["source_label"] = "race_week_fp2_long_run_v1"

    stint_degradation = pd.DataFrame()
    stint_group_columns = ["season", "round", "race_id", "session_code", "driver_id", "constructor_id", "compound"]
    stint_value_columns = ["lap_count", "degradation_per_lap_s", "end_tyre_life"]
    if not stints.empty and all(column in stints.columns for column in stint_group_columns + stint_value_columns):
        stint_degradation = (
            stints.groupby(stint_group_columns, dropna=False)
            .agg(
                avg_lap_count=("lap_count", "mean"),
                avg_degradation_per_lap_s=("degradation_per_lap_s", "mean"),
                avg_tyre_life=("end_tyre_life", "mean"),
            )
            .reset_index()
        )
        stint_degradation["degradation_risk"] = (
            pd.to_numeric(stint_degradation["avg_degradation_per_lap_s"], errors="coerce").fillna(0).clip(lower=-0.5, upper=2.0) * 50
        ).round(3)
        stint_degradation["id"] = stint_degradation.apply(
            lambda row: f"{row['race_id']}|{row['session_code']}|{row['driver_id'] or row['constructor_id'] or 'unknown'}|{normalize_key(row['compound'])}",
            axis=1,
        )
        stint_degradation["source_label"] = "race_week_stint_degradation_v1"

    weather_risk = pd.DataFrame()
    if not weather.empty:
        weather_risk = (
            weather.groupby(["race_id"], dropna=False)
            .agg(
                rainfall_probability=("rainfall", lambda values: pd.Series(values).fillna(False).astype(bool).mean() * 100),
                track_temp_mean_c=("track_temp_c", "mean"),
                track_temp_volatility_c=("track_temp_c", "std"),
                wind_speed_mean_mps=("wind_speed_mps", "mean"),
            )
            .reset_index()
        )
        weather_risk = weather_risk.merge(races[["id", "season", "round"]], left_on="race_id", right_on="id", how="left").drop(columns=["id"])
        weather_risk["weather_risk_index"] = (
            pd.to_numeric(weather_risk["rainfall_probability"], errors="coerce").fillna(0) * 0.55
            + pd.to_numeric(weather_risk["track_temp_volatility_c"], errors="coerce").fillna(0).clip(lower=0, upper=12) * 3.0
            + pd.to_numeric(weather_risk["wind_speed_mean_mps"], errors="coerce").fillna(0).clip(lower=0, upper=12) * 2.5
        ).round(3)
        weather_risk["id"] = weather_risk["race_id"]
        weather_risk["source_label"] = "race_week_weather_risk_v1"
    else:
        weather_risk = pd.DataFrame(
            columns=[
                "id",
                "season",
                "round",
                "race_id",
                "rainfall_probability",
                "track_temp_mean_c",
                "track_temp_volatility_c",
                "wind_speed_mean_mps",
                "weather_risk_index",
                "source_label",
            ]
        )

    current_predictions = fastf1_predictions.copy() if not fastf1_predictions.empty else prediction_snapshots.copy()
    if not current_predictions.empty:
        prediction_columns = ["race_id", "driver_id", "constructor_id", "projected_finish"]
        if "predicted_score" in current_predictions.columns:
            prediction_columns.append("predicted_score")
        if "rationale" in current_predictions.columns:
            prediction_columns.append("rationale")
        current_predictions = current_predictions[prediction_columns].copy()
        current_predictions["driver_id"] = current_predictions["driver_id"].astype(str)

    driver_features = pd.DataFrame()
    if not race_week_context.empty:
        active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()
        driver_feature_rows: list[pd.DataFrame] = []
        for _, race_row in active_races.iterrows():
            race_id = str(race_row["race_id"])
            pace_for_race = session_pace[session_pace["race_id"] == race_id].copy()
            fp2_for_race = fp2_long_run[fp2_long_run["race_id"] == race_id].copy() if not fp2_long_run.empty else pd.DataFrame()
            weather_for_race = weather_risk[weather_risk["race_id"] == race_id] if not weather_risk.empty else pd.DataFrame()
            form_for_race = driver_form[driver_form["race_id"] == race_id].copy() if not driver_form.empty else pd.DataFrame()
            if pace_for_race.empty and form_for_race.empty:
                continue

            one_lap = pace_for_race[pace_for_race["session_code"].isin(["Q", "FP3", "FP2"])].copy()
            if not one_lap.empty:
                one_lap["session_priority"] = one_lap["session_code"].map({"Q": 0, "FP3": 1, "FP2": 2}).fillna(9)
                one_lap = one_lap.sort_values(["driver_id", "session_priority", "best_lap_s"]).groupby("driver_id", as_index=False).first()

            merged = (
                pd.DataFrame({"driver_id": pd.unique(pd.concat([
                    pace_for_race["driver_id"] if not pace_for_race.empty else pd.Series(dtype="object"),
                    form_for_race["driver_id"] if not form_for_race.empty else pd.Series(dtype="object"),
                ], ignore_index=True))})
                .dropna()
            )
            if merged.empty:
                continue

            if not fp2_for_race.empty:
                merged = merged.merge(
                    fp2_for_race[["driver_id", "constructor_id", "representative_long_run_pace_s", "degradation_per_lap_s", "gap_to_best_s", "signal_confidence"]],
                    on="driver_id",
                    how="left",
                )
            if not one_lap.empty:
                merged = merged.merge(
                    one_lap[["driver_id", "constructor_id", "best_lap_s", "session_code", "gap_to_session_best_s", "gap_to_teammate_s", "pace_rank"]],
                    on="driver_id",
                    how="left",
                    suffixes=("", "_one_lap"),
                )
            if not form_for_race.empty:
                merged = merged.merge(
                    form_for_race[
                        [
                            "driver_id",
                            "constructor_id",
                            "session_completeness",
                            "recent_pace_rank",
                            "reliability_index",
                            "weather_risk_index",
                            "teammate_delta_s",
                        ]
                    ],
                    on="driver_id",
                    how="left",
                    suffixes=("", "_form"),
                )
            if not current_predictions.empty:
                merged = merged.merge(
                    current_predictions[current_predictions["race_id"] == race_id][["driver_id", "projected_finish"]],
                    on="driver_id",
                    how="left",
                )
            if not weather_for_race.empty:
                merged["weather_risk_index"] = float(weather_for_race["weather_risk_index"].iloc[0])

            merged["constructor_id"] = merged["constructor_id"].fillna(merged.get("constructor_id_one_lap")).fillna(merged.get("constructor_id_form"))
            merged["session_completeness"] = pd.to_numeric(merged.get("session_completeness"), errors="coerce").fillna(
                pace_for_race.groupby("driver_id")["session_code"].nunique()
            ).fillna(0)
            merged["one_lap_pace_s"] = pd.to_numeric(merged.get("best_lap_s"), errors="coerce")
            merged["one_lap_session_code"] = merged.get("session_code")
            merged["gap_to_best_s"] = (
                pd.to_numeric(merged.get("gap_to_best_s"), errors="coerce")
                .fillna(pd.to_numeric(merged.get("gap_to_session_best_s"), errors="coerce"))
            )
            merged["teammate_delta_s"] = (
                pd.to_numeric(merged.get("teammate_delta_s"), errors="coerce")
                .fillna(pd.to_numeric(merged.get("gap_to_teammate_s"), errors="coerce"))
            )
            merged["reliability_index"] = pd.to_numeric(merged.get("reliability_index"), errors="coerce").fillna(
                55 + merged["session_completeness"].clip(lower=0, upper=4) * 10
            )
            merged["weather_risk_index"] = pd.to_numeric(merged.get("weather_risk_index"), errors="coerce").fillna(0)
            merged["recent_pace_rank"] = pd.to_numeric(merged.get("recent_pace_rank"), errors="coerce").fillna(
                pd.to_numeric(merged.get("pace_rank"), errors="coerce")
            )
            merged["signal_confidence"] = pd.to_numeric(merged.get("signal_confidence"), errors="coerce").fillna(
                (merged["session_completeness"].clip(lower=0, upper=4) / 4)
            )

            long_run_signal = scale_lower_better(merged["representative_long_run_pace_s"]).fillna(0.5)
            one_lap_signal = scale_lower_better(merged["one_lap_pace_s"]).fillna(0.5)
            reliability_signal = scale_higher_better(merged["reliability_index"]).fillna(0.5)
            degradation_signal = scale_lower_better(merged["degradation_per_lap_s"]).fillna(0.5)
            merged["readiness_score"] = (
                long_run_signal * 0.35
                + one_lap_signal * 0.25
                + degradation_signal * 0.15
                + reliability_signal * 0.15
                + merged["signal_confidence"].fillna(0.4) * 0.10
                - (merged["weather_risk_index"].fillna(0) / 100) * 0.08
            ).round(6)
            readiness_rank = merged["readiness_score"].rank(method="dense", ascending=False)
            merged["overperforming_delta"] = (
                pd.to_numeric(merged.get("projected_finish"), errors="coerce").fillna(readiness_rank) - readiness_rank
            ).round(3)
            merged["season"] = int(race_row["season"])
            merged["round"] = int(race_row["round"])
            merged["race_id"] = race_id
            merged["id"] = merged.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
            merged["source_label"] = "race_week_driver_features_v1"
            driver_feature_rows.append(
                merged[
                    [
                        "id",
                        "season",
                        "round",
                        "race_id",
                        "driver_id",
                        "constructor_id",
                        "session_completeness",
                        "representative_long_run_pace_s",
                        "degradation_per_lap_s",
                        "one_lap_pace_s",
                        "one_lap_session_code",
                        "recent_pace_rank",
                        "gap_to_best_s",
                        "teammate_delta_s",
                        "reliability_index",
                        "weather_risk_index",
                        "readiness_score",
                        "signal_confidence",
                        "overperforming_delta",
                        "projected_finish",
                        "source_label",
                    ]
                ].rename(columns={"representative_long_run_pace_s": "fp2_long_run_pace_s", "degradation_per_lap_s": "fp2_degradation_s_per_lap"})
            )

        if driver_feature_rows:
            driver_features = pd.concat(driver_feature_rows, ignore_index=True)

    if driver_features.empty and not current_predictions.empty and not race_week_context.empty:
        active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()
        fallback_rows: list[dict[str, Any]] = []
        for _, race_row in active_races.iterrows():
            race_id = str(race_row["race_id"])
            prediction_rows = current_predictions[current_predictions["race_id"] == race_id].copy().sort_values("projected_finish").reset_index(drop=True)
            if prediction_rows.empty:
                continue
            score_signal = scale_higher_better(prediction_rows["predicted_score"]) if "predicted_score" in prediction_rows.columns else scale_lower_better(prediction_rows["projected_finish"])
            for index, (_, prediction_row) in enumerate(prediction_rows.iterrows(), start=1):
                fallback_rows.append(
                    {
                        "id": f"{race_id}|{prediction_row['driver_id']}",
                        "season": int(race_row["season"]),
                        "round": int(race_row["round"]),
                        "race_id": race_id,
                        "driver_id": prediction_row["driver_id"],
                        "constructor_id": prediction_row["constructor_id"],
                        "session_completeness": 0,
                        "fp2_long_run_pace_s": None,
                        "fp2_degradation_s_per_lap": None,
                        "one_lap_pace_s": None,
                        "one_lap_session_code": None,
                        "recent_pace_rank": index,
                        "gap_to_best_s": None,
                        "teammate_delta_s": None,
                        "reliability_index": 70,
                        "weather_risk_index": 0,
                        "readiness_score": round(float(score_signal.iloc[index - 1]), 6),
                        "signal_confidence": 0.25,
                        "overperforming_delta": 0.0,
                        "projected_finish": prediction_row["projected_finish"],
                        "source_label": "race_week_driver_features_prediction_fallback_v1",
                    }
                )
        driver_features = pd.DataFrame(fallback_rows)

    constructor_features = pd.DataFrame()
    if not driver_features.empty:
        constructor_features = (
            driver_features.groupby(["season", "round", "race_id", "constructor_id"], dropna=False)
            .agg(
                two_car_long_run_pace_s=("fp2_long_run_pace_s", "mean"),
                two_car_one_lap_pace_s=("one_lap_pace_s", "mean"),
                degradation_index=("fp2_degradation_s_per_lap", "mean"),
                reliability_index=("reliability_index", "mean"),
                weather_risk_index=("weather_risk_index", "mean"),
                readiness_score=("readiness_score", "mean"),
                signal_confidence=("signal_confidence", "mean"),
            )
            .reset_index()
        )
        constructor_features["id"] = constructor_features.apply(lambda row: f"{row['race_id']}|{row['constructor_id']}", axis=1)
        constructor_features["source_label"] = "race_week_constructor_features_v1"

    readiness_summary = pd.DataFrame()
    if not driver_features.empty:
        readiness_summary = driver_features.copy()
        readiness_summary["readiness_rank"] = readiness_summary.groupby("race_id")["readiness_score"].rank(method="dense", ascending=False).astype(int)
        readiness_summary["rationale"] = readiness_summary.apply(
            lambda row: f"Readiness combines long-run pace, one-lap pace, tyre degradation, reliability, and signal coverage for {row['driver_id']}.",
            axis=1,
        )
        readiness_summary = readiness_summary[
            ["id", "season", "round", "race_id", "driver_id", "constructor_id", "readiness_score", "signal_confidence", "readiness_rank", "rationale", "source_label"]
        ]
        readiness_summary["source_label"] = "race_week_readiness_v1"

    standings_context = pd.DataFrame()
    if not race_week_context.empty:
        rows: list[dict[str, Any]] = []
        next_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])]
        for _, race_row in next_races.iterrows():
            target_race_id = str(race_row["race_id"])
            source_race_id = str(race_row.get("latest_completed_race_id") or "")
            if source_race_id:
                for _, standing in driver_standings[driver_standings["race_id"] == source_race_id].iterrows():
                    rows.append(
                        {
                            "id": f"{target_race_id}|driver|{standing['driver_id']}",
                            "season": int(race_row["season"]),
                            "round": int(race_row["round"]),
                            "race_id": target_race_id,
                            "entity_type": "driver",
                            "entity_id": standing["driver_id"],
                            "constructor_id": standing["constructor_id"],
                            "standing_position": standing["standing_position"],
                            "points": standing["points"],
                            "wins": standing["wins"],
                            "source_race_id": source_race_id,
                            "source_label": "race_week_standings_context_v1",
                        }
                    )
                for _, standing in constructor_standings[constructor_standings["race_id"] == source_race_id].iterrows():
                    rows.append(
                        {
                            "id": f"{target_race_id}|constructor|{standing['constructor_id']}",
                            "season": int(race_row["season"]),
                            "round": int(race_row["round"]),
                            "race_id": target_race_id,
                            "entity_type": "constructor",
                            "entity_id": standing["constructor_id"],
                            "constructor_id": standing["constructor_id"],
                            "standing_position": standing["standing_position"],
                            "points": standing["points"],
                            "wins": standing["wins"],
                            "source_race_id": source_race_id,
                            "source_label": "race_week_standings_context_v1",
                        }
                    )
        standings_context = pd.DataFrame(rows)

    storylines = pd.DataFrame()
    if not driver_features.empty:
        driver_name_map = dict(zip(drivers["id"], drivers["full_name"]))
        constructor_name_map = dict(zip(constructors["id"], constructors["name"]))
        rows: list[dict[str, Any]] = []
        for race_id, frame in driver_features.groupby("race_id", dropna=False):
            season = int(frame["season"].iloc[0])
            round_number = int(frame["round"].iloc[0])
            top_driver = frame.sort_values("readiness_score", ascending=False).iloc[0]
            rows.append(
                {
                    "id": f"{race_id}|headline|pace",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "entity_type": "driver",
                    "entity_id": top_driver["driver_id"],
                    "storyline_type": "long_run_leader",
                    "priority_rank": 1,
                    "headline": f"{driver_name_map.get(top_driver['driver_id'], top_driver['driver_id'])} leads the early race read",
                    "body": "The strongest combined signal is coming from long-run pace, one-lap competitiveness, and reliability coverage.",
                    "confidence_band": "high" if float(top_driver["signal_confidence"]) >= 0.7 else "medium",
                    "signal_confidence": top_driver["signal_confidence"],
                    "source_label": "race_week_storyline_v1",
                }
            )
            if frame["fp2_degradation_s_per_lap"].notna().any():
                worst_deg = frame.sort_values("fp2_degradation_s_per_lap", ascending=False).iloc[0]
                rows.append(
                    {
                        "id": f"{race_id}|headline|deg",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "entity_type": "constructor",
                        "entity_id": worst_deg["constructor_id"],
                        "storyline_type": "degradation_warning",
                        "priority_rank": 2,
                        "headline": f"{constructor_name_map.get(worst_deg['constructor_id'], worst_deg['constructor_id'])} is carrying the highest tyre fade warning",
                        "body": "Degradation is currently the weakest part of the weekend signal for this team.",
                        "confidence_band": "medium",
                        "signal_confidence": worst_deg["signal_confidence"],
                        "source_label": "race_week_storyline_v1",
                    }
                )
            weather_for_race = weather_risk[weather_risk["race_id"] == race_id] if not weather_risk.empty else pd.DataFrame()
            if not weather_for_race.empty:
                weather_row = weather_for_race.iloc[0]
                rows.append(
                    {
                        "id": f"{race_id}|headline|weather",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "entity_type": "race",
                        "entity_id": race_id,
                        "storyline_type": "weather_risk",
                        "priority_rank": 3,
                        "headline": "Weather volatility is part of the weekend read",
                        "body": f"Weather risk is tracking at {difficulty_band(float(weather_row['weather_risk_index']))} intensity based on current rainfall, wind, and track-temperature movement.",
                        "confidence_band": "medium",
                        "signal_confidence": 0.6,
                        "source_label": "race_week_storyline_v1",
                    }
                )
        storylines = pd.DataFrame(rows)

    race_week_overview = pd.DataFrame()
    if not race_week_context.empty:
        circuit_lookup = circuits.set_index("id") if not circuits.empty else pd.DataFrame()
        rows: list[dict[str, Any]] = []
        for _, row in race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].iterrows():
            race_id = str(row["race_id"])
            circuit_id = row["circuit_id"]
            circuit = circuit_lookup.loc[circuit_id] if not circuit_lookup.empty and circuit_id in circuit_lookup.index else None
            weather_row = weather_risk[weather_risk["race_id"] == race_id].head(1)
            driver_frame = driver_features[driver_features["race_id"] == race_id] if not driver_features.empty else pd.DataFrame()
            strategy_score = 0.0
            if circuit is not None:
                strategy_score += float(circuit.get("tire_degradation_bias") or 0) * 6
                strategy_score += max(0, 10 - float(circuit.get("overtake_difficulty") or 5)) * 4
            if not weather_row.empty:
                strategy_score += float(weather_row["weather_risk_index"].iloc[0]) * 0.4
            rows.append(
                {
                    "id": race_id,
                    "season": int(row["season"]),
                    "round": int(row["round"]),
                    "race_id": race_id,
                    "race_name": row["race_name"],
                    "circuit_id": circuit_id,
                    "circuit_name": circuit["name"] if circuit is not None else circuit_id,
                    "scheduled_at": row["scheduled_at"],
                    "status": row["status"],
                    "sprint_weekend": str(row.get("sprint_weekend", "")).lower() in {"true", "1"},
                    "latest_completed_race_id": row.get("latest_completed_race_id"),
                    "archetype_label": classify_circuit(circuit) if circuit is not None else "Balanced circuit",
                    "strategy_difficulty": difficulty_band(strategy_score),
                    "weather_risk_index": float(weather_row["weather_risk_index"].iloc[0]) if not weather_row.empty else 0.0,
                    "signal_confidence": float(driver_frame["signal_confidence"].mean()) if not driver_frame.empty else 0.0,
                    "source_label": "race_week_overview_v1",
                }
            )
        race_week_overview = pd.DataFrame(rows)

    driver_board = pd.DataFrame()
    if not driver_features.empty:
        driver_name_map = dict(zip(drivers["id"], drivers["full_name"]))
        constructor_name_map = dict(zip(constructors["id"], constructors["name"]))
        one_lap_best = driver_features.groupby("race_id")["one_lap_pace_s"].transform("min")
        driver_board = driver_features.copy()
        driver_board["gap_to_long_run_best_s"] = pd.to_numeric(driver_board["fp2_long_run_pace_s"], errors="coerce") - driver_board.groupby("race_id")["fp2_long_run_pace_s"].transform("min")
        driver_board["gap_to_one_lap_best_s"] = pd.to_numeric(driver_board["one_lap_pace_s"], errors="coerce") - one_lap_best
        driver_board["summary"] = driver_board.apply(
            lambda row: f"{driver_name_map.get(row['driver_id'], row['driver_id'])} is carrying a {difficulty_band(float(row['signal_confidence']) * 100).lower()} confidence weekend read for {constructor_name_map.get(row['constructor_id'], row['constructor_id'])}.",
            axis=1,
        )
        driver_board["driver_name"] = driver_board["driver_id"].map(driver_name_map).fillna(driver_board["driver_id"])
        driver_board["constructor_name"] = driver_board["constructor_id"].map(constructor_name_map).fillna(driver_board["constructor_id"])
        driver_board["source_label"] = "race_week_driver_board_v1"
        driver_board = driver_board[
            [
                "id",
                "season",
                "round",
                "race_id",
                "driver_id",
                "constructor_id",
                "driver_name",
                "constructor_name",
                "fp2_long_run_pace_s",
                "gap_to_long_run_best_s",
                "one_lap_pace_s",
                "gap_to_one_lap_best_s",
                "fp2_degradation_s_per_lap",
                "readiness_score",
                "signal_confidence",
                "projected_finish",
                "summary",
                "source_label",
            ]
        ].rename(columns={"fp2_long_run_pace_s": "long_run_pace_s", "fp2_degradation_s_per_lap": "degradation_s_per_lap"})

    constructor_board = pd.DataFrame()
    if not constructor_features.empty:
        constructor_name_map = dict(zip(constructors["id"], constructors["name"]))
        constructor_board = constructor_features.copy()
        constructor_board["summary"] = constructor_board.apply(
            lambda row: f"{constructor_name_map.get(row['constructor_id'], row['constructor_id'])} is carrying a {difficulty_band(float(row['signal_confidence']) * 100).lower()} confidence team signal this week.",
            axis=1,
        )
        constructor_board["constructor_name"] = constructor_board["constructor_id"].map(constructor_name_map).fillna(constructor_board["constructor_id"])
        constructor_board["source_label"] = "race_week_constructor_board_v1"
        constructor_board = constructor_board[
            [
                "id",
                "season",
                "round",
                "race_id",
                "constructor_id",
                "constructor_name",
                "two_car_long_run_pace_s",
                "two_car_one_lap_pace_s",
                "degradation_index",
                "readiness_score",
                "signal_confidence",
                "summary",
                "source_label",
            ]
        ].rename(columns={"two_car_long_run_pace_s": "long_run_pace_s", "two_car_one_lap_pace_s": "one_lap_pace_s"})

    strategy_view = pd.DataFrame()
    if not strategy_baselines.empty:
        strategy_view = strategy_baselines.copy()
        strategy_view["source_label"] = strategy_view.get("source_label", "race_week_strategy_v1")
    elif not driver_features.empty:
        strategy_view = driver_features[
            ["season", "round", "race_id", "driver_id", "constructor_id", "fp2_degradation_s_per_lap", "signal_confidence"]
        ].copy()
        strategy_view["recommended_stop_count"] = strategy_view["fp2_degradation_s_per_lap"].apply(lambda value: 2 if pd.notna(value) and float(value) >= 0.08 else 1)
        strategy_view["preferred_primary_compound"] = None
        strategy_view["preferred_secondary_compound"] = None
        strategy_view["pit_window_start_lap"] = 16
        strategy_view["pit_window_end_lap"] = 24
        strategy_view["degradation_risk"] = pd.to_numeric(strategy_view["fp2_degradation_s_per_lap"], errors="coerce").fillna(0) * 100
        strategy_view["strategy_confidence"] = strategy_view["signal_confidence"]
        strategy_view["rationale"] = "Fallback strategy baseline derived from current long-run degradation signal."
        strategy_view["id"] = strategy_view.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
        strategy_view["source_label"] = "race_week_strategy_v1"
        strategy_view = strategy_view[
            [
                "id",
                "season",
                "round",
                "race_id",
                "driver_id",
                "constructor_id",
                "recommended_stop_count",
                "preferred_primary_compound",
                "preferred_secondary_compound",
                "pit_window_start_lap",
                "pit_window_end_lap",
                "degradation_risk",
                "strategy_confidence",
                "rationale",
                "source_label",
            ]
        ]

    return {
        "session_pace_summary": session_pace,
        "fp2_long_run_summary": fp2_long_run,
        "stint_degradation_summary": stint_degradation,
        "weather_risk_summary": weather_risk,
        "driver_race_week_features": driver_features,
        "constructor_race_week_features": constructor_features,
        "weekend_readiness_summary": readiness_summary,
        "standings_context_snapshot": standings_context,
        "race_week_storylines": storylines,
        "race_week_overview": race_week_overview,
        "race_week_driver_board": driver_board,
        "race_week_constructor_board": constructor_board,
        "race_week_strategy": strategy_view,
    }


def build_race_week_intelligence_layers(
    *,
    canonical: dict[str, pd.DataFrame],
    races: pd.DataFrame,
    circuits: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
    qualifying_results: pd.DataFrame,
    race_results: pd.DataFrame,
    prediction_snapshots: pd.DataFrame,
    fastf1_predictions: pd.DataFrame,
    strategy_profiles: pd.DataFrame,
    race_week_context: pd.DataFrame,
    strategy_baselines: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()
    if active_races.empty:
        empty = pd.DataFrame()
        return {
            "session_features": empty,
            "driver_features": empty,
            "constructor_features": empty,
            "race_context_features": empty,
            "driver_signals": empty,
            "constructor_signals": empty,
            "race_context_signals": empty,
            "race_week_confidence": empty,
        }

    session_pace = canonical["session_pace_summary"].copy()
    session_laps = canonical["session_laps"].copy()
    if not session_laps.empty:
        session_laps["lap_time_s"] = pd.to_numeric(session_laps["lap_time_s"], errors="coerce")

    races = races.copy()
    races["scheduled_at"] = pd.to_datetime(races["scheduled_at"], utc=True, errors="coerce")
    circuits = circuits.copy()
    if not circuits.empty:
        circuits["archetype_label"] = circuits.apply(classify_circuit, axis=1)

    driver_name_map = dict(zip(drivers["id"], drivers["full_name"])) if not drivers.empty else {}
    constructor_name_map = dict(zip(constructors["id"], constructors["name"])) if not constructors.empty else {}
    current_predictions = fastf1_predictions.copy() if not fastf1_predictions.empty else prediction_snapshots.copy()
    if not current_predictions.empty:
        current_predictions = current_predictions.copy()
        current_predictions["driver_id"] = current_predictions["driver_id"].astype(str)
        if "constructor_id" in current_predictions.columns:
            current_predictions["constructor_id"] = current_predictions["constructor_id"].astype(str)
        if "projected_finish" in current_predictions.columns:
            current_predictions["projected_finish"] = pd.to_numeric(current_predictions["projected_finish"], errors="coerce")
        if "predicted_score" in current_predictions.columns:
            current_predictions["predicted_score"] = pd.to_numeric(current_predictions["predicted_score"], errors="coerce")

    session_feature_rows: list[dict[str, Any]] = []
    driver_feature_rows: list[dict[str, Any]] = []
    constructor_feature_rows: list[dict[str, Any]] = []
    race_context_rows: list[dict[str, Any]] = []
    driver_signal_rows: list[dict[str, Any]] = []
    constructor_signal_rows: list[dict[str, Any]] = []
    race_context_signal_rows: list[dict[str, Any]] = []
    confidence_rows: list[dict[str, Any]] = []

    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        season = int(active_race["season"])
        round_number = int(active_race["round"])
        circuit_id = str(active_race["circuit_id"])

        circuit_row = circuits[circuits["id"] == circuit_id].head(1)
        circuit = circuit_row.iloc[0] if not circuit_row.empty else None
        archetype_label = classify_circuit(circuit) if circuit is not None else "Balanced circuit"
        high_speed_bias = float(circuit.get("high_speed_bias") or 5) if circuit is not None else 5.0
        overtake_difficulty = float(circuit.get("overtake_difficulty") or 5) if circuit is not None else 5.0
        degradation_bias = float(circuit.get("tire_degradation_bias") or 5) if circuit is not None else 5.0

        historical_races = races[
            (races["season"] < season) | ((races["season"] == season) & (races["round"] < round_number))
        ].sort_values(["season", "round"])
        historical_race_ids = historical_races.tail(10)["id"].astype(str).tolist()
        same_circuit_race_ids = historical_races[historical_races["circuit_id"] == circuit_id]["id"].astype(str).tolist()
        similar_circuit_ids = circuits[circuits["archetype_label"] == archetype_label]["id"].astype(str).tolist() if not circuits.empty else []
        similar_track_race_ids = historical_races[historical_races["circuit_id"].isin(similar_circuit_ids)]["id"].astype(str).tolist()

        race_pace = session_pace[session_pace["race_id"] == race_id].copy()
        race_pace["best_lap_s"] = pd.to_numeric(race_pace["best_lap_s"], errors="coerce")
        race_pace["long_run_lap_s"] = pd.to_numeric(race_pace["long_run_lap_s"], errors="coerce")
        race_pace["gap_to_teammate_s"] = pd.to_numeric(race_pace["gap_to_teammate_s"], errors="coerce")
        historical_pace = session_pace[session_pace["race_id"].isin(historical_race_ids)].copy()
        historical_pace["best_lap_s"] = pd.to_numeric(historical_pace["best_lap_s"], errors="coerce")
        historical_pace["long_run_lap_s"] = pd.to_numeric(historical_pace["long_run_lap_s"], errors="coerce")
        historical_pace["representative_lap_s"] = pd.to_numeric(historical_pace["representative_lap_s"], errors="coerce")

        fp2_rows = race_pace[race_pace["session_code"] == "FP2"].copy()
        q_rows = race_pace[race_pace["session_code"] == "Q"].copy()
        fp1_rows = race_pace[race_pace["session_code"] == "FP1"].copy()
        fp3_rows = race_pace[race_pace["session_code"] == "FP3"].copy()

        strategy_rows = strategy_baselines[strategy_baselines["race_id"] == race_id].copy() if not strategy_baselines.empty else pd.DataFrame()
        strategy_profile_rows = strategy_profiles[strategy_profiles["race_id"].isin(historical_race_ids)].copy() if not strategy_profiles.empty else pd.DataFrame()

        active_driver_ids = pd.unique(race_pace["driver_id"].dropna()) if not race_pace.empty else []
        active_driver_ids = [str(driver_id) for driver_id in active_driver_ids if str(driver_id)]
        prediction_rows = current_predictions[current_predictions["race_id"] == race_id].copy() if not current_predictions.empty else pd.DataFrame()
        if active_driver_ids:
            active_driver_ids = list(dict.fromkeys(active_driver_ids + prediction_rows["driver_id"].astype(str).dropna().tolist()))
        elif not prediction_rows.empty:
            active_driver_ids = prediction_rows["driver_id"].astype(str).dropna().tolist()

        for driver_id in active_driver_ids:
            driver_session_rows = race_pace[race_pace["driver_id"].astype(str) == driver_id]
            prediction_row = prediction_rows[prediction_rows["driver_id"].astype(str) == driver_id].head(1)
            prediction_projected_finish = pd.to_numeric(prediction_row["projected_finish"], errors="coerce").iloc[0] if not prediction_row.empty and "projected_finish" in prediction_row.columns else None
            prediction_score = pd.to_numeric(prediction_row["predicted_score"], errors="coerce").iloc[0] if not prediction_row.empty and "predicted_score" in prediction_row.columns else None
            constructor_id = str(driver_session_rows["constructor_id"].dropna().iloc[0]) if not driver_session_rows["constructor_id"].dropna().empty else ""
            if not constructor_id and not prediction_row.empty and "constructor_id" in prediction_row.columns:
                constructor_id = str(prediction_row["constructor_id"].dropna().iloc[0]) if not prediction_row["constructor_id"].dropna().empty else ""
            fp1_pace = mean_or_none(fp1_rows[fp1_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            fp2_pace = mean_or_none(fp2_rows[fp2_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            fp3_pace = mean_or_none(fp3_rows[fp3_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            quali_pace = mean_or_none(q_rows[q_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            fp2_long_run_pace = mean_or_none(fp2_rows[fp2_rows["driver_id"].astype(str) == driver_id]["long_run_lap_s"])
            trend_reference = quali_pace or fp3_pace or fp2_pace
            trend_delta = (fp1_pace - trend_reference) if fp1_pace is not None and trend_reference is not None else None
            fp2_laps = session_laps[
                (session_laps["race_id"] == race_id)
                & (session_laps["driver_id"].astype(str) == driver_id)
                & (session_laps["session_id"].astype(str).str.endswith("|FP2"))
                & (session_laps["is_accurate"].fillna(False))
                & (~session_laps["deleted"].fillna(False))
            ]
            lap_variance_s = float(fp2_laps["lap_time_s"].std()) if not fp2_laps.empty and fp2_laps["lap_time_s"].notna().sum() > 1 else None
            session_completeness = sum(value is not None for value in [fp1_pace, fp2_pace, fp3_pace, quali_pace])
            signal_confidence = clamp01(len(fp2_laps) / 12, default=0.0)
            if session_completeness == 0 and prediction_projected_finish is not None:
                signal_confidence = 0.25

            session_feature_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "fp1_pace_s": fp1_pace,
                    "fp2_pace_s": fp2_pace,
                    "fp3_pace_s": fp3_pace,
                    "quali_pace_s": quali_pace,
                    "fp2_long_run_pace_s": fp2_long_run_pace,
                    "lap_variance_s": lap_variance_s,
                    "session_trend_delta_s": trend_delta,
                    "session_completeness": session_completeness,
                    "signal_confidence": signal_confidence,
                    "source_label": "race_week_session_features_v1",
                }
            )

            historical_race_rows = historical_pace[
                (historical_pace["driver_id"].astype(str) == driver_id)
                & (historical_pace["session_code"] == "R")
            ].sort_values(["season", "round"]).tail(3)
            historical_quali_rows = historical_pace[
                (historical_pace["driver_id"].astype(str) == driver_id)
                & (historical_pace["session_code"] == "Q")
            ].sort_values(["season", "round"]).tail(3)
            recent_race_results = race_results[
                (race_results["driver_id"].astype(str) == driver_id)
                & (race_results["race_id"].isin(historical_race_ids))
            ].tail(5)
            recent_quali_results = qualifying_results[
                (qualifying_results["driver_id"].astype(str) == driver_id)
                & (qualifying_results["race_id"].isin(historical_race_ids))
            ].tail(5)
            affinity_rows = race_results[
                (race_results["driver_id"].astype(str) == driver_id)
                & (
                    race_results["race_id"].isin(same_circuit_race_ids)
                    | race_results["race_id"].isin(similar_track_race_ids)
                )
            ]

            avg_race_pace_s = mean_or_none(historical_race_rows["long_run_lap_s"].fillna(historical_race_rows["representative_lap_s"]))
            avg_finish_position_recent = mean_or_none(recent_race_results["finish_position"])
            avg_qualifying_position_recent = mean_or_none(recent_quali_results["position"])
            if avg_finish_position_recent is None and prediction_projected_finish is not None:
                avg_finish_position_recent = float(prediction_projected_finish)
            if avg_qualifying_position_recent is None and prediction_projected_finish is not None:
                avg_qualifying_position_recent = float(prediction_projected_finish)
            tyre_degradation_slope = mean_or_none(fp2_rows[fp2_rows["driver_id"].astype(str) == driver_id]["long_run_degradation_s"])
            consistency_score = (1 / max(lap_variance_s, 0.001)) if lap_variance_s is not None else None
            race_vs_quali_delta_s = (avg_race_pace_s - quali_pace) if avg_race_pace_s is not None and quali_pace is not None else None
            teammate_delta_s = mean_or_none(driver_session_rows["gap_to_teammate_s"])
            reliability_score = clamp01(1 - (recent_race_results["finish_status"].fillna("").astype(str).str.lower().ne("finished").mean() if not recent_race_results.empty else 0.2), default=0.5)
            track_affinity_score = clamp01(1 - (((mean_or_none(affinity_rows["finish_position"]) or 11) - 1) / 19), default=0.5)
            if consistency_score is None and prediction_score is not None:
                max_prediction_score = max(
                    float(current_predictions["predicted_score"].max())
                    if not current_predictions.empty
                    and "predicted_score" in current_predictions.columns
                    and current_predictions["predicted_score"].notna().any()
                    else 1.0,
                    1.0,
                )
                consistency_score = float(max(0.2, min(1.0, prediction_score / max_prediction_score)))
            if avg_race_pace_s is None and prediction_projected_finish is not None:
                avg_race_pace_s = float(88 + prediction_projected_finish * 0.24)
            if quali_pace is None and prediction_projected_finish is not None:
                quali_pace = float(80 + prediction_projected_finish * 0.12)
            if race_vs_quali_delta_s is None and avg_race_pace_s is not None and quali_pace is not None:
                race_vs_quali_delta_s = avg_race_pace_s - quali_pace
            if tyre_degradation_slope is None and prediction_projected_finish is not None:
                tyre_degradation_slope = float(0.045 + min(0.08, prediction_projected_finish * 0.0025))
            if teammate_delta_s is None:
                teammate_delta_s = 0.0

            driver_feature_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "avg_race_pace_s": avg_race_pace_s,
                    "fp2_long_run_pace_s": fp2_long_run_pace,
                    "lap_variance_s": lap_variance_s,
                    "consistency_score": consistency_score,
                    "quali_pace_s": quali_pace or mean_or_none(historical_quali_rows["best_lap_s"]),
                    "race_vs_quali_delta_s": race_vs_quali_delta_s,
                    "tyre_degradation_slope": tyre_degradation_slope,
                    "avg_finish_position_recent": avg_finish_position_recent,
                    "avg_qualifying_position_recent": avg_qualifying_position_recent,
                    "track_affinity_score": track_affinity_score,
                    "teammate_delta_s": teammate_delta_s,
                    "reliability_score": reliability_score,
                    "source_label": "race_week_driver_features_v2",
                }
            )

        driver_features = pd.DataFrame(driver_feature_rows)
        race_driver_features = driver_features[driver_features["race_id"] == race_id].copy() if not driver_features.empty else pd.DataFrame()
        if not race_driver_features.empty:
            constructor_frame = (
                race_driver_features.groupby(["season", "round", "race_id", "constructor_id"], dropna=False)
                .agg(
                    team_pace_s=("avg_race_pace_s", "mean"),
                    long_run_pace_s=("fp2_long_run_pace_s", "mean"),
                    quali_pace_s=("quali_pace_s", "mean"),
                    degradation_profile=("tyre_degradation_slope", "mean"),
                    reliability_score=("reliability_score", "mean"),
                    track_affinity_score=("track_affinity_score", "mean"),
                    avg_finish_position_recent=("avg_finish_position_recent", "mean"),
                )
                .reset_index()
            )
            constructor_strategy = strategy_rows.groupby("constructor_id", dropna=False).agg(
                strategy_tendency_score=("recommended_stop_count", "mean"),
                strategy_confidence=("strategy_confidence", "mean"),
            ).reset_index() if not strategy_rows.empty else pd.DataFrame(columns=["constructor_id", "strategy_tendency_score", "strategy_confidence"])
            constructor_frame = constructor_frame.merge(constructor_strategy, on="constructor_id", how="left")
            constructor_frame["strategy_tendency_score"] = pd.to_numeric(constructor_frame["strategy_tendency_score"], errors="coerce").fillna(1.5)
            constructor_frame["strategy_confidence"] = pd.to_numeric(constructor_frame["strategy_confidence"], errors="coerce").fillna(0.4)
            constructor_frame["team_pace_s"] = pd.to_numeric(constructor_frame["team_pace_s"], errors="coerce").fillna(pd.to_numeric(constructor_frame["quali_pace_s"], errors="coerce"))
            constructor_frame["long_run_pace_s"] = pd.to_numeric(constructor_frame["long_run_pace_s"], errors="coerce").fillna(pd.to_numeric(constructor_frame["team_pace_s"], errors="coerce"))
            constructor_frame["degradation_profile"] = pd.to_numeric(constructor_frame["degradation_profile"], errors="coerce").fillna(0.065)
            constructor_frame["id"] = constructor_frame.apply(lambda row: f"{row['race_id']}|{row['constructor_id']}", axis=1)
            constructor_frame["source_label"] = "race_week_constructor_features_v2"
            constructor_feature_rows.extend(constructor_frame.to_dict("records"))

        weather_risk_index = 0.0
        weather_for_race = canonical["session_weather"][canonical["session_weather"]["race_id"] == race_id].copy()
        if not weather_for_race.empty:
            rainfall_probability = float(weather_for_race["rainfall"].fillna(False).astype(bool).mean() * 100)
            weather_risk_index = float(min(100.0, rainfall_probability * 0.55 + pd.to_numeric(weather_for_race["wind_speed_mps"], errors="coerce").fillna(0).clip(upper=12).mean() * 2.5))
        safety_car_probability = max(0.0, min(100.0, (10 - overtake_difficulty) * 5.0 + degradation_bias * 2.0 + weather_risk_index * 0.3))
        strategic_complexity_score = max(0.0, min(100.0, degradation_bias * 6.0 + (10 - overtake_difficulty) * 4.0 + weather_risk_index * 0.4))
        race_context_rows.append(
            {
                "id": race_id,
                "season": season,
                "round": round_number,
                "race_id": race_id,
                "circuit_id": circuit_id,
                "archetype_label": archetype_label,
                "high_speed_bias": high_speed_bias,
                "overtake_difficulty": overtake_difficulty,
                "tire_degradation_bias": degradation_bias,
                "weather_risk_index": weather_risk_index,
                "safety_car_probability": safety_car_probability,
                "strategic_complexity_score": strategic_complexity_score,
                "source_label": "race_week_context_features_v1",
            }
        )

    session_features = pd.DataFrame(session_feature_rows)
    driver_features = pd.DataFrame(driver_feature_rows)
    constructor_features = pd.DataFrame(constructor_feature_rows)
    race_context_features = pd.DataFrame(race_context_rows)

    if not driver_features.empty:
        driver_signals = driver_features[["id", "season", "round", "race_id", "driver_id", "constructor_id"]].copy()
        driver_signals["form_signal"] = (
            scale_lower_better(driver_features["avg_finish_position_recent"]).fillna(0.5) * 0.4
            + scale_lower_better(driver_features["avg_race_pace_s"]).fillna(0.5) * 0.6
        ).round(6)
        driver_signals["consistency_signal"] = scale_higher_better(driver_features["consistency_score"]).fillna(0.5).round(6)
        racecraft_source = pd.to_numeric(driver_features["avg_qualifying_position_recent"], errors="coerce") - pd.to_numeric(driver_features["avg_finish_position_recent"], errors="coerce")
        driver_signals["racecraft_signal"] = scale_higher_better(racecraft_source).fillna(0.5).round(6)
        driver_signals["fp2_race_pace_signal"] = scale_lower_better(driver_features["fp2_long_run_pace_s"]).fillna(0.5).round(6)
        driver_signals["quali_signal"] = scale_lower_better(driver_features["quali_pace_s"]).fillna(0.5).round(6)
        driver_signals["trend_signal"] = scale_higher_better(session_features.set_index("id").reindex(driver_signals["id"])["session_trend_delta_s"]).fillna(0.5).round(6)
        driver_signals["track_affinity_signal"] = pd.to_numeric(driver_features["track_affinity_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        driver_signals["overall_signal"] = (
            driver_signals["form_signal"].fillna(0.5) * 0.18
            + driver_signals["consistency_signal"].fillna(0.5) * 0.14
            + driver_signals["racecraft_signal"].fillna(0.5) * 0.12
            + driver_signals["fp2_race_pace_signal"].fillna(0.5) * 0.24
            + driver_signals["quali_signal"].fillna(0.5) * 0.18
            + driver_signals["trend_signal"].fillna(0.5) * 0.08
            + driver_signals["track_affinity_signal"].fillna(0.5) * 0.06
        ).round(6)
        driver_signals["source_label"] = "race_week_driver_signals_v1"
    else:
        driver_signals = pd.DataFrame()

    if not constructor_features.empty:
        constructor_signals = constructor_features[["id", "season", "round", "race_id", "constructor_id"]].copy()
        constructor_signals["pace_strength_signal"] = (
            scale_lower_better(constructor_features["long_run_pace_s"]).fillna(0.5) * 0.55
            + scale_lower_better(constructor_features["quali_pace_s"]).fillna(0.5) * 0.45
        ).round(6)
        constructor_signals["degradation_strength_signal"] = scale_lower_better(constructor_features["degradation_profile"]).fillna(0.5).round(6)
        constructor_signals["reliability_signal"] = pd.to_numeric(constructor_features["reliability_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        constructor_signals["strategy_signal"] = scale_higher_better(constructor_features["strategy_confidence"]).fillna(0.5).round(6)
        constructor_signals["track_affinity_signal"] = pd.to_numeric(constructor_features["track_affinity_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        constructor_signals["overall_signal"] = (
            constructor_signals["pace_strength_signal"].fillna(0.5) * 0.34
            + constructor_signals["degradation_strength_signal"].fillna(0.5) * 0.20
            + constructor_signals["reliability_signal"].fillna(0.5) * 0.20
            + constructor_signals["strategy_signal"].fillna(0.5) * 0.16
            + constructor_signals["track_affinity_signal"].fillna(0.5) * 0.10
        ).round(6)
        constructor_signals["source_label"] = "race_week_constructor_signals_v1"
    else:
        constructor_signals = pd.DataFrame()

    if not race_context_features.empty:
        race_context_signals = race_context_features[["id", "season", "round", "race_id"]].copy()
        race_context_signals["strategic_complexity_signal"] = pd.to_numeric(race_context_features["strategic_complexity_score"], errors="coerce").fillna(50) / 100
        race_context_signals["weather_signal"] = pd.to_numeric(race_context_features["weather_risk_index"], errors="coerce").fillna(0) / 100
        race_context_signals["safety_car_signal"] = pd.to_numeric(race_context_features["safety_car_probability"], errors="coerce").fillna(0) / 100
        race_context_signals["overtaking_signal"] = (10 - pd.to_numeric(race_context_features["overtake_difficulty"], errors="coerce").fillna(5)) / 10
        race_context_signals["high_speed_signal"] = pd.to_numeric(race_context_features["high_speed_bias"], errors="coerce").fillna(5) / 10
        race_context_signals["source_label"] = "race_week_context_signals_v1"
    else:
        race_context_signals = pd.DataFrame()

    if not driver_signals.empty:
        signal_matrix = driver_signals[["form_signal", "consistency_signal", "racecraft_signal", "fp2_race_pace_signal", "quali_signal", "trend_signal", "track_affinity_signal"]]
        completeness_score = (
            pd.to_numeric(session_features.set_index("id").reindex(driver_signals["id"])["session_completeness"], errors="coerce")
            .fillna(0)
            .reset_index(drop=True)
            / 4
        )
        agreement_score = (1 - signal_matrix.std(axis=1).fillna(0).clip(lower=0, upper=0.5) / 0.5).clip(lower=0, upper=1).reset_index(drop=True)
        sample_score = (
            pd.to_numeric(session_features.set_index("id").reindex(driver_signals["id"])["signal_confidence"], errors="coerce")
            .fillna(0)
            .clip(lower=0, upper=1)
            .reset_index(drop=True)
        )
        strength_score = ((driver_signals["overall_signal"] - 0.5).abs() * 2).clip(lower=0, upper=1).reset_index(drop=True)
        confidence_score = (completeness_score * 0.35 + agreement_score * 0.30 + sample_score * 0.20 + strength_score * 0.15).round(6)
        driver_confidence = driver_signals[["race_id", "driver_id", "season", "round"]].copy()
        driver_confidence["id"] = driver_confidence.apply(lambda row: f"{row['race_id']}|driver|{row['driver_id']}", axis=1)
        driver_confidence["entity_type"] = "driver"
        driver_confidence["entity_id"] = driver_confidence["driver_id"]
        driver_confidence["completeness_score"] = completeness_score.values
        driver_confidence["agreement_score"] = agreement_score.values
        driver_confidence["sample_score"] = sample_score.values
        driver_confidence["strength_score"] = strength_score.values
        driver_confidence["confidence_score"] = confidence_score.values
        driver_confidence["confidence_band"] = driver_confidence["confidence_score"].apply(confidence_band)
        driver_confidence["rationale"] = driver_confidence["driver_id"].map(lambda driver_id: f"{driver_name_map.get(driver_id, driver_id)} confidence reflects session completeness, signal agreement, sample depth, and signal strength.")
        driver_confidence["source_label"] = "race_week_confidence_v1"
    else:
        driver_confidence = pd.DataFrame()

    if not constructor_signals.empty:
        c_signal_matrix = constructor_signals[["pace_strength_signal", "degradation_strength_signal", "reliability_signal", "strategy_signal", "track_affinity_signal"]]
        agreement_score = (1 - c_signal_matrix.std(axis=1).fillna(0).clip(lower=0, upper=0.5) / 0.5).clip(lower=0, upper=1).reset_index(drop=True)
        constructor_driver_counts = driver_features.groupby(["race_id", "constructor_id"], dropna=False)["driver_id"].nunique() if not driver_features.empty else pd.Series(dtype=float)
        completeness_score = constructor_signals.apply(lambda row: clamp01((constructor_driver_counts.get((row["race_id"], row["constructor_id"]), 0) or 0) / 2, default=0.0), axis=1).reset_index(drop=True)
        sample_score = constructor_signals["race_id"].map(lambda _: 0.35 if session_features.empty or session_features["session_completeness"].fillna(0).sum() == 0 else 0.7).reset_index(drop=True)
        strength_score = ((constructor_signals["overall_signal"] - 0.5).abs() * 2).clip(lower=0, upper=1).reset_index(drop=True)
        confidence_score = (completeness_score * 0.30 + agreement_score * 0.30 + sample_score * 0.15 + strength_score * 0.25).round(6)
        constructor_confidence = constructor_signals[["race_id", "constructor_id", "season", "round"]].copy()
        constructor_confidence["id"] = constructor_confidence.apply(lambda row: f"{row['race_id']}|constructor|{row['constructor_id']}", axis=1)
        constructor_confidence["entity_type"] = "constructor"
        constructor_confidence["entity_id"] = constructor_confidence["constructor_id"]
        constructor_confidence["completeness_score"] = completeness_score.values
        constructor_confidence["agreement_score"] = agreement_score.values
        constructor_confidence["sample_score"] = sample_score.values
        constructor_confidence["strength_score"] = strength_score.values
        constructor_confidence["confidence_score"] = confidence_score.values
        constructor_confidence["confidence_band"] = constructor_confidence["confidence_score"].apply(confidence_band)
        constructor_confidence["rationale"] = constructor_confidence["constructor_id"].map(lambda constructor_id: f"{constructor_name_map.get(constructor_id, constructor_id)} confidence reflects internal signal agreement and team-level signal strength.")
        constructor_confidence["source_label"] = "race_week_confidence_v1"
    else:
        constructor_confidence = pd.DataFrame()

    race_confidence_rows: list[dict[str, Any]] = []
    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        driver_scores = driver_confidence[driver_confidence["race_id"] == race_id]["confidence_score"] if not driver_confidence.empty else pd.Series(dtype=float)
        race_score = float(driver_scores.mean()) if not driver_scores.empty else 0.25
        race_confidence_rows.append(
            {
                "id": f"{race_id}|race|overview",
                "season": int(active_race["season"]),
                "round": int(active_race["round"]),
                "race_id": race_id,
                "entity_type": "race",
                "entity_id": race_id,
                "completeness_score": clamp01(len(driver_scores) / 20, default=0.0),
                "agreement_score": race_score,
                "sample_score": (0.3 if driver_scores.empty else race_score),
                "strength_score": race_score,
                "confidence_score": race_score,
                "confidence_band": confidence_band(race_score),
                "rationale": "Race-level confidence reflects the aggregate completeness and agreement of the active driver signals.",
                "source_label": "race_week_confidence_v1",
            }
        )
    race_confidence = pd.DataFrame(race_confidence_rows)
    race_week_confidence = pd.concat([driver_confidence, constructor_confidence, race_confidence], ignore_index=True) if not (driver_confidence.empty and constructor_confidence.empty and race_confidence.empty) else pd.DataFrame()

    return {
        "session_features": session_features,
        "driver_features": driver_features,
        "constructor_features": constructor_features,
        "race_context_features": race_context_features,
        "driver_signals": driver_signals,
        "constructor_signals": constructor_signals,
        "race_context_signals": race_context_signals,
        "race_week_confidence": race_week_confidence,
    }


def build_race_week_product_views_from_intelligence(
    *,
    races: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
    race_week_context: pd.DataFrame,
    strategy_view: pd.DataFrame,
    intelligence: dict[str, pd.DataFrame],
) -> dict[str, pd.DataFrame]:
    overview = pd.DataFrame()
    driver_board = pd.DataFrame()
    constructor_board = pd.DataFrame()
    storylines = pd.DataFrame()

    driver_name_map = dict(zip(drivers["id"], drivers["full_name"])) if not drivers.empty else {}
    constructor_name_map = dict(zip(constructors["id"], constructors["name"])) if not constructors.empty else {}
    driver_features = intelligence.get("driver_features", pd.DataFrame()).copy()
    constructor_features = intelligence.get("constructor_features", pd.DataFrame()).copy()
    race_context_features = intelligence.get("race_context_features", pd.DataFrame()).copy()
    driver_signals = intelligence.get("driver_signals", pd.DataFrame()).copy()
    constructor_signals = intelligence.get("constructor_signals", pd.DataFrame()).copy()
    confidence = intelligence.get("race_week_confidence", pd.DataFrame()).copy()
    active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()

    if not driver_features.empty and not driver_signals.empty:
        driver_board = driver_features.merge(
            driver_signals[["race_id", "driver_id", "overall_signal", "fp2_race_pace_signal", "quali_signal", "consistency_signal", "track_affinity_signal"]],
            on=["race_id", "driver_id"],
            how="left",
        ).merge(
            confidence[confidence["entity_type"] == "driver"][["race_id", "entity_id", "confidence_score", "confidence_band"]],
            left_on=["race_id", "driver_id"],
            right_on=["race_id", "entity_id"],
            how="left",
        )
        driver_board["driver_name"] = driver_board["driver_id"].map(driver_name_map).fillna(driver_board["driver_id"])
        driver_board["constructor_name"] = driver_board["constructor_id"].map(constructor_name_map).fillna(driver_board["constructor_id"])
        driver_board["readiness_score"] = driver_board["overall_signal"].fillna(0.5)
        driver_board["signal_confidence"] = driver_board["confidence_score"].fillna(0.45)
        driver_board["projected_finish"] = driver_board.groupby("race_id")["readiness_score"].rank(method="dense", ascending=False).astype(int)
        driver_board["gap_to_long_run_best_s"] = pd.to_numeric(driver_board["fp2_long_run_pace_s"], errors="coerce") - pd.to_numeric(driver_board["fp2_long_run_pace_s"], errors="coerce").groupby(driver_board["race_id"]).transform("min")
        driver_board["gap_to_one_lap_best_s"] = pd.to_numeric(driver_board["quali_pace_s"], errors="coerce") - pd.to_numeric(driver_board["quali_pace_s"], errors="coerce").groupby(driver_board["race_id"]).transform("min")
        driver_board["summary"] = driver_board.apply(
            lambda row: f"{row['driver_name']} is strongest on "
            + ", ".join(
                label for label, _ in sorted(
                    [
                        ("long-run pace", row.get("fp2_race_pace_signal") or 0),
                        ("one-lap pace", row.get("quali_signal") or 0),
                        ("consistency", row.get("consistency_signal") or 0),
                        ("track fit", row.get("track_affinity_signal") or 0),
                    ],
                    key=lambda item: item[1],
                    reverse=True,
                )[:2]
            )
            + f". Confidence is {row.get('confidence_band', 'medium')}.",
            axis=1,
        )
        driver_board["source_label"] = "race_week_driver_board_v2"
        driver_board["id"] = driver_board.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
        driver_board = driver_board[
            ["id", "season", "round", "race_id", "driver_id", "constructor_id", "driver_name", "constructor_name", "fp2_long_run_pace_s", "gap_to_long_run_best_s", "quali_pace_s", "gap_to_one_lap_best_s", "tyre_degradation_slope", "readiness_score", "signal_confidence", "projected_finish", "summary", "source_label"]
        ].rename(columns={"fp2_long_run_pace_s": "long_run_pace_s", "quali_pace_s": "one_lap_pace_s", "tyre_degradation_slope": "degradation_s_per_lap"})

    if not constructor_features.empty and not constructor_signals.empty:
        constructor_board = constructor_features.merge(
            constructor_signals[["race_id", "constructor_id", "overall_signal"]],
            on=["race_id", "constructor_id"],
            how="left",
        ).merge(
            confidence[confidence["entity_type"] == "constructor"][["race_id", "entity_id", "confidence_score", "confidence_band"]],
            left_on=["race_id", "constructor_id"],
            right_on=["race_id", "entity_id"],
            how="left",
        )
        constructor_board["constructor_name"] = constructor_board["constructor_id"].map(constructor_name_map).fillna(constructor_board["constructor_id"])
        constructor_board["readiness_score"] = constructor_board["overall_signal"].fillna(0.5)
        constructor_board["signal_confidence"] = constructor_board["confidence_score"].fillna(0.45)
        constructor_board["summary"] = constructor_board.apply(
            lambda row: f"{row['constructor_name']} shows its cleanest signal through pace and tyre control. Confidence is {row.get('confidence_band', 'medium')}.",
            axis=1,
        )
        constructor_board["source_label"] = "race_week_constructor_board_v2"
        constructor_board["id"] = constructor_board.apply(lambda row: f"{row['race_id']}|{row['constructor_id']}", axis=1)
        constructor_board = constructor_board[
            ["id", "season", "round", "race_id", "constructor_id", "constructor_name", "long_run_pace_s", "quali_pace_s", "degradation_profile", "readiness_score", "signal_confidence", "summary", "source_label"]
        ].rename(columns={"quali_pace_s": "one_lap_pace_s", "degradation_profile": "degradation_index"})

    if not race_context_features.empty and not active_races.empty:
        overview = active_races.merge(
            races[["id", "race_name", "scheduled_at", "circuit_id", "sprint_weekend"]],
            left_on="race_id",
            right_on="id",
            how="left",
            suffixes=("", "_race"),
        ).merge(
            race_context_features[["race_id", "archetype_label", "strategic_complexity_score", "weather_risk_index"]],
            on="race_id",
            how="left",
        ).merge(
            confidence[confidence["entity_type"] == "race"][["race_id", "confidence_score"]],
            on="race_id",
            how="left",
        )
        overview["id"] = overview["race_id"]
        overview["circuit_name"] = overview["circuit_id"]
        overview["strategy_difficulty"] = overview["strategic_complexity_score"].apply(lambda value: difficulty_band(float(value)) if pd.notna(value) else "Medium")
        overview["signal_confidence"] = overview["confidence_score"].fillna(0.45)
        overview["source_label"] = "race_week_overview_v2"
        overview = overview[
            ["id", "season", "round", "race_id", "race_name", "circuit_id", "circuit_name", "scheduled_at_race", "status", "sprint_weekend", "latest_completed_race_id", "archetype_label", "strategy_difficulty", "weather_risk_index", "signal_confidence", "source_label"]
        ].rename(columns={"scheduled_at_race": "scheduled_at"})

    if not driver_board.empty:
        story_rows: list[dict[str, Any]] = []
        for race_id, frame in driver_board.groupby("race_id", dropna=False):
            season_value = int(frame["season"].iloc[0])
            round_value = int(frame["round"].iloc[0])
            lead_row = frame.sort_values("readiness_score", ascending=False).iloc[0]
            story_rows.append(
                {
                    "id": f"{race_id}|story|lead",
                    "season": season_value,
                    "round": round_value,
                    "race_id": race_id,
                    "entity_type": "driver",
                    "entity_id": lead_row["driver_id"],
                    "storyline_type": "lead_signal",
                    "priority_rank": 1,
                    "headline": f"{lead_row['driver_name']} sets the strongest opening signal",
                    "body": lead_row["summary"],
                    "confidence_band": confidence_band(float(lead_row["signal_confidence"])),
                    "signal_confidence": lead_row["signal_confidence"],
                    "source_label": "race_week_storyline_v2",
                }
            )
            if not constructor_board.empty:
                weak_constructor = constructor_board[constructor_board["race_id"] == race_id].sort_values("degradation_index", ascending=False).head(1)
                if not weak_constructor.empty:
                    weak_row = weak_constructor.iloc[0]
                    story_rows.append(
                        {
                            "id": f"{race_id}|story|deg",
                            "season": season_value,
                            "round": round_value,
                            "race_id": race_id,
                            "entity_type": "constructor",
                            "entity_id": weak_row["constructor_id"],
                            "storyline_type": "degradation_warning",
                            "priority_rank": 2,
                            "headline": f"{weak_row['constructor_name']} is carrying the sharpest tyre fade warning",
                            "body": "Degradation is the weakest part of this constructor's weekend signal.",
                            "confidence_band": confidence_band(float(weak_row["signal_confidence"])),
                            "signal_confidence": weak_row["signal_confidence"],
                            "source_label": "race_week_storyline_v2",
                        }
                    )
        storylines = pd.DataFrame(story_rows)

    return {
        "race_week_overview": overview,
        "race_week_driver_board": driver_board,
        "race_week_constructor_board": constructor_board,
        "race_week_storylines": storylines,
        "race_week_strategy": strategy_view,
    }


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


def main() -> None:
    settings = load_settings()
    curated = settings.curated_dir

    canonical_columns = {
        "sessions": ["id", "race_id", "season", "round", "session_code", "session_name", "event_name", "scheduled_at", "source_label"],
        "event_entries": ["id", "race_id", "driver_id", "constructor_id", "source_label"],
        "session_results": ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "classification_position", "grid_position", "finish_position", "points", "status", "laps_completed", "fastest_lap_rank", "source_label"],
        "session_laps": ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "lap_number", "stint_number", "compound", "tyre_life", "lap_time_s", "sector_1_s", "sector_2_s", "sector_3_s", "top_speed_kph", "track_status", "fresh_tyre", "is_personal_best", "is_accurate", "deleted", "lap_start_time", "position", "air_temp_c", "track_temp_c", "humidity_pct", "rainfall", "wind_speed_mps", "wind_direction_deg", "source_label"],
        "session_stints": ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "stint_number", "compound", "lap_count", "mean_lap_time_s", "degradation_per_lap_s", "degradation_index", "start_tyre_life", "end_tyre_life", "session_code", "source_label"],
        "session_weather": ["id", "session_id", "race_id", "sample_order", "sample_time", "air_temp_c", "track_temp_c", "humidity_pct", "pressure_hpa", "rainfall", "wind_speed_mps", "wind_direction_deg", "source_label"],
    }
    processed_columns = {
        "session_features": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "fp1_pace_s", "fp2_pace_s", "fp3_pace_s", "quali_pace_s", "fp2_long_run_pace_s", "lap_variance_s", "session_trend_delta_s", "session_completeness", "signal_confidence", "source_label"],
        "driver_features": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "avg_race_pace_s", "fp2_long_run_pace_s", "lap_variance_s", "consistency_score", "quali_pace_s", "race_vs_quali_delta_s", "tyre_degradation_slope", "avg_finish_position_recent", "avg_qualifying_position_recent", "track_affinity_score", "teammate_delta_s", "reliability_score", "source_label"],
        "constructor_features": ["id", "season", "round", "race_id", "constructor_id", "team_pace_s", "long_run_pace_s", "quali_pace_s", "degradation_profile", "reliability_score", "track_affinity_score", "avg_finish_position_recent", "strategy_tendency_score", "strategy_confidence", "source_label"],
        "race_context_features": ["id", "season", "round", "race_id", "circuit_id", "archetype_label", "high_speed_bias", "overtake_difficulty", "tire_degradation_bias", "weather_risk_index", "safety_car_probability", "strategic_complexity_score", "source_label"],
        "driver_signals": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "form_signal", "consistency_signal", "racecraft_signal", "fp2_race_pace_signal", "quali_signal", "trend_signal", "track_affinity_signal", "overall_signal", "source_label"],
        "constructor_signals": ["id", "season", "round", "race_id", "constructor_id", "pace_strength_signal", "degradation_strength_signal", "reliability_signal", "strategy_signal", "track_affinity_signal", "overall_signal", "source_label"],
        "race_context_signals": ["id", "season", "round", "race_id", "strategic_complexity_signal", "weather_signal", "safety_car_signal", "overtaking_signal", "high_speed_signal", "source_label"],
        "race_week_confidence": ["id", "season", "round", "race_id", "entity_type", "entity_id", "completeness_score", "agreement_score", "sample_score", "strength_score", "confidence_score", "confidence_band", "rationale", "source_label"],
        "session_pace_summary": ["id", "season", "round", "race_id", "session_id", "session_code", "driver_id", "constructor_id", "representative_lap_s", "best_lap_s", "long_run_lap_s", "long_run_degradation_s", "gap_to_session_best_s", "pace_rank", "gap_to_teammate_s", "top_speed_kph", "air_temp_c", "track_temp_c", "rainfall_flag", "source_label"],
        "fp2_long_run_summary": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "representative_long_run_pace_s", "gap_to_best_s", "degradation_per_lap_s", "lap_sample_size", "compound", "signal_confidence", "source_label"],
        "stint_degradation_summary": ["id", "season", "round", "race_id", "session_code", "driver_id", "constructor_id", "compound", "avg_lap_count", "avg_degradation_per_lap_s", "avg_tyre_life", "degradation_risk", "source_label"],
        "weather_risk_summary": ["id", "season", "round", "race_id", "rainfall_probability", "track_temp_mean_c", "track_temp_volatility_c", "wind_speed_mean_mps", "weather_risk_index", "source_label"],
        "driver_race_week_features": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "session_completeness", "fp2_long_run_pace_s", "fp2_degradation_s_per_lap", "one_lap_pace_s", "one_lap_session_code", "recent_pace_rank", "gap_to_best_s", "teammate_delta_s", "reliability_index", "weather_risk_index", "readiness_score", "signal_confidence", "overperforming_delta", "projected_finish", "source_label"],
        "constructor_race_week_features": ["id", "season", "round", "race_id", "constructor_id", "two_car_long_run_pace_s", "two_car_one_lap_pace_s", "degradation_index", "reliability_index", "weather_risk_index", "readiness_score", "signal_confidence", "source_label"],
        "weekend_readiness_summary": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "readiness_score", "signal_confidence", "readiness_rank", "rationale", "source_label"],
        "standings_context_snapshot": ["id", "season", "round", "race_id", "entity_type", "entity_id", "constructor_id", "standing_position", "points", "wins", "source_race_id", "source_label"],
        "race_week_storylines": ["id", "season", "round", "race_id", "entity_type", "entity_id", "storyline_type", "priority_rank", "headline", "body", "confidence_band", "signal_confidence", "source_label"],
        "race_week_overview": ["id", "season", "round", "race_id", "race_name", "circuit_id", "circuit_name", "scheduled_at", "status", "sprint_weekend", "latest_completed_race_id", "archetype_label", "strategy_difficulty", "weather_risk_index", "signal_confidence", "generated_at", "build_version", "source_label"],
        "race_week_driver_board": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "driver_name", "constructor_name", "long_run_pace_s", "gap_to_long_run_best_s", "one_lap_pace_s", "gap_to_one_lap_best_s", "degradation_s_per_lap", "readiness_score", "signal_confidence", "projected_finish", "summary", "source_label"],
        "race_week_constructor_board": ["id", "season", "round", "race_id", "constructor_id", "constructor_name", "long_run_pace_s", "one_lap_pace_s", "degradation_index", "readiness_score", "signal_confidence", "summary", "source_label"],
        "race_week_strategy": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "recommended_stop_count", "preferred_primary_compound", "preferred_secondary_compound", "pit_window_start_lap", "pit_window_end_lap", "degradation_risk", "strategy_confidence", "rationale", "source_label"],
    }

    drivers = read_csv(curated / "drivers.csv")
    constructors = read_csv(curated / "constructors.csv")
    races = read_csv(curated / "races.csv")
    circuits = read_csv(curated / "circuits.csv")
    qualifying_results = read_csv(curated / "qualifying_results.csv")
    race_results = read_csv(curated / "race_results.csv")
    strategy_profiles = read_csv(curated / "strategy_profiles.csv")
    driver_standings = read_csv(curated / "driver_standings.csv")
    constructor_standings = read_csv(curated / "constructor_standings.csv")
    race_week_context = read_csv(curated / "race_week_context.csv")
    prediction_snapshots = read_csv(curated / "prediction_snapshots.csv")

    driver_lookup = driver_lookup_map(drivers)
    constructor_lookup = constructor_lookup_map(constructors)

    driver_form = normalize_feature_ids(
        read_csv(settings.features_dir / "driver_form_snapshots.csv"),
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    strategy_baselines = normalize_feature_ids(
        read_csv(settings.predictions_dir / "strategy_baselines.csv"),
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    fastf1_predictions = normalize_feature_ids(
        read_csv(settings.predictions_dir / "fastf1_prediction_snapshots.csv"),
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    prediction_snapshots = normalize_feature_ids(
        prediction_snapshots,
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )

    canonical = build_canonical_session_layer(
        settings,
        races=races,
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    canonical = {
        table_name: ensure_columns(canonical.get(table_name, pd.DataFrame()), columns)
        for table_name, columns in canonical_columns.items()
    } | {
        "session_pace_summary": ensure_columns(canonical.get("session_pace_summary", pd.DataFrame()), processed_columns["session_pace_summary"])
    }
    processed = build_processed_race_week_layers(
        canonical=canonical,
        races=races,
        circuits=circuits,
        drivers=drivers,
        constructors=constructors,
        qualifying_results=qualifying_results,
        race_results=race_results,
        strategy_profiles=strategy_profiles,
        driver_standings=driver_standings,
        constructor_standings=constructor_standings,
        race_week_context=race_week_context,
        prediction_snapshots=prediction_snapshots,
        driver_form=driver_form,
        strategy_baselines=strategy_baselines,
        fastf1_predictions=fastf1_predictions,
    )
    intelligence = build_race_week_intelligence_layers(
        canonical=canonical,
        races=races,
        circuits=circuits,
        drivers=drivers,
        constructors=constructors,
        qualifying_results=qualifying_results,
        race_results=race_results,
        prediction_snapshots=prediction_snapshots,
        fastf1_predictions=fastf1_predictions,
        strategy_profiles=strategy_profiles,
        race_week_context=race_week_context,
        strategy_baselines=strategy_baselines,
    )
    product_views = build_race_week_product_views_from_intelligence(
        races=races,
        drivers=drivers,
        constructors=constructors,
        race_week_context=race_week_context,
        strategy_view=processed.get("race_week_strategy", pd.DataFrame()),
        intelligence=intelligence,
    )
    race_week_generated_at, race_week_build_version = build_materialization_metadata("race_week")
    if not product_views.get("race_week_overview", pd.DataFrame()).empty:
        product_views["race_week_overview"] = product_views["race_week_overview"].assign(
            generated_at=race_week_generated_at,
            build_version=race_week_build_version,
        )
    processed = processed | intelligence
    for table_name, frame in product_views.items():
        if not frame.empty:
            processed[table_name] = frame

    settings.canonical_fastf1_dir.mkdir(parents=True, exist_ok=True)
    settings.race_week_dir.mkdir(parents=True, exist_ok=True)

    for table_name, columns in canonical_columns.items():
        write_frame(ensure_columns(canonical.get(table_name, pd.DataFrame()), columns), settings.canonical_fastf1_dir / f"{table_name}.csv")

    for table_name, columns in processed_columns.items():
        write_frame(ensure_columns(processed.get(table_name, pd.DataFrame()), columns), settings.race_week_dir / f"{table_name}.csv")


if __name__ == "__main__":
    main()
