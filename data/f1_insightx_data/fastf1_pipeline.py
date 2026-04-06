from __future__ import annotations

import json
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.era import regulation_era_for_season, season_similarity_weight
from f1_insightx_data.settings import PipelineSettings


SESSION_PREFERENCE = ("FP1", "FP2", "FP3", "Q", "S", "R")
SESSION_WEIGHTS: dict[str, float] = {
    "FP1": 0.45,
    "FP2": 1.0,
    "FP3": 0.65,
    "Q": 1.15,
    "S": 0.9,
    "R": 1.25,
}


def enable_fastf1_cache(settings: PipelineSettings) -> None:
    import fastf1

    settings.fastf1_cache_dir.mkdir(parents=True, exist_ok=True)
    fastf1.Cache.enable_cache(str(settings.fastf1_cache_dir))


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def write_frame(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def lap_time_seconds(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    if hasattr(value, "total_seconds"):
        return float(value.total_seconds())

    try:
        timedelta_value = pd.to_timedelta(value)
    except (ValueError, TypeError):
        return None

    if pd.isna(timedelta_value):
        return None

    return float(timedelta_value.total_seconds())


def normalize_lap_frame(
    laps: pd.DataFrame,
    *,
    season: int,
    round_number: int,
    event_name: str,
    session_code: str,
) -> pd.DataFrame:
    if laps.empty:
        return pd.DataFrame(
            columns=[
                "season",
                "round",
                "event_name",
                "session_code",
                "driver",
                "team",
                "lap_number",
                "stint",
                "compound",
                "tyre_life",
                "lap_time_s",
                "sector_1_s",
                "sector_2_s",
                "sector_3_s",
                "speed_i1",
                "speed_i2",
                "speed_fl",
                "speed_st",
                "track_status",
                "fresh_tyre",
                "is_personal_best",
                "is_accurate",
                "deleted",
                "lap_start_time",
                "position",
                "air_temp_c",
                "track_temp_c",
                "humidity_pct",
                "rainfall",
                "wind_speed_mps",
                "wind_direction_deg",
            ]
        )

    frame = laps.copy()

    numeric_columns = [
        "LapNumber",
        "Stint",
        "TyreLife",
        "SpeedI1",
        "SpeedI2",
        "SpeedFL",
        "SpeedST",
        "Position",
        "AirTemp",
        "TrackTemp",
        "Humidity",
        "WindSpeed",
        "WindDirection",
    ]
    for column in numeric_columns:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    data = {
        "season": season,
        "round": round_number,
        "event_name": event_name,
        "session_code": session_code,
        "driver": frame.get("Driver"),
        "team": frame.get("Team"),
        "lap_number": frame.get("LapNumber"),
        "stint": frame.get("Stint"),
        "compound": frame.get("Compound"),
        "tyre_life": frame.get("TyreLife"),
        "lap_time_s": frame.get("LapTime", pd.Series(dtype="object")).apply(lap_time_seconds),
        "sector_1_s": frame.get("Sector1Time", pd.Series(dtype="object")).apply(lap_time_seconds),
        "sector_2_s": frame.get("Sector2Time", pd.Series(dtype="object")).apply(lap_time_seconds),
        "sector_3_s": frame.get("Sector3Time", pd.Series(dtype="object")).apply(lap_time_seconds),
        "speed_i1": frame.get("SpeedI1"),
        "speed_i2": frame.get("SpeedI2"),
        "speed_fl": frame.get("SpeedFL"),
        "speed_st": frame.get("SpeedST"),
        "track_status": frame.get("TrackStatus"),
        "fresh_tyre": frame.get("FreshTyre"),
        "is_personal_best": frame.get("IsPersonalBest"),
        "is_accurate": frame.get("IsAccurate"),
        "deleted": frame.get("Deleted"),
        "lap_start_time": frame.get("LapStartDate"),
        "position": frame.get("Position"),
        "air_temp_c": frame.get("AirTemp"),
        "track_temp_c": frame.get("TrackTemp"),
        "humidity_pct": frame.get("Humidity"),
        "rainfall": frame.get("Rainfall"),
        "wind_speed_mps": frame.get("WindSpeed"),
        "wind_direction_deg": frame.get("WindDirection"),
    }

    normalized = pd.DataFrame(data)
    normalized["driver"] = normalized["driver"].fillna("").astype(str)
    normalized["team"] = normalized["team"].fillna("").astype(str)
    normalized["compound"] = normalized["compound"].fillna("").astype(str)
    normalized["track_status"] = normalized["track_status"].fillna("").astype(str)
    normalized["fresh_tyre"] = normalized["fresh_tyre"].fillna(False).astype(bool)
    normalized["is_personal_best"] = normalized["is_personal_best"].fillna(False).astype(bool)
    normalized["is_accurate"] = normalized["is_accurate"].fillna(False).astype(bool)
    normalized["deleted"] = normalized["deleted"].fillna(False).astype(bool)
    return normalized


def build_stint_frame(laps: pd.DataFrame) -> pd.DataFrame:
    if laps.empty:
        return pd.DataFrame(
            columns=[
                "season",
                "round",
                "event_name",
                "session_code",
                "driver",
                "team",
                "stint",
                "compound",
                "lap_count",
                "mean_lap_time_s",
                "degradation_per_lap_s",
                "degradation_index",
                "start_tyre_life",
                "end_tyre_life",
            ]
        )

    valid = laps.dropna(subset=["driver", "team", "stint", "lap_time_s"]).copy()
    valid = valid[valid["lap_time_s"] > 0]
    if valid.empty:
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []
    grouped = valid.sort_values(["driver", "stint", "lap_number"]).groupby(
        ["season", "round", "event_name", "session_code", "driver", "team", "stint", "compound"],
        dropna=False,
    )

    for keys, stint_rows in grouped:
        stint_rows = stint_rows.sort_values("lap_number")
        tyre_life = stint_rows["tyre_life"].dropna()
        degradation = 0.0
        if len(stint_rows) >= 3 and tyre_life.nunique() > 1:
            degradation = float(
                pd.Series(stint_rows["lap_time_s"]).corr(pd.Series(stint_rows["tyre_life"]), method="spearman")
            )

        rows.append(
            {
                "season": keys[0],
                "round": keys[1],
                "event_name": keys[2],
                "session_code": keys[3],
                "driver": keys[4],
                "team": keys[5],
                "stint": keys[6],
                "compound": keys[7],
                "lap_count": int(len(stint_rows)),
                "mean_lap_time_s": float(stint_rows["lap_time_s"].mean()),
                "degradation_per_lap_s": float(
                    stint_rows["lap_time_s"].diff().dropna().clip(lower=-10, upper=10).mean()
                )
                if len(stint_rows) >= 2
                else 0.0,
                "degradation_index": degradation,
                "start_tyre_life": int(tyre_life.min()) if not tyre_life.empty else None,
                "end_tyre_life": int(tyre_life.max()) if not tyre_life.empty else None,
            }
        )

    return pd.DataFrame(rows)


def session_summary_from_laps(laps: pd.DataFrame) -> pd.DataFrame:
    if laps.empty:
        return pd.DataFrame(
            columns=[
                "season",
                "round",
                "event_name",
                "session_code",
                "driver",
                "team",
                "regulation_era",
                "session_weight",
                "lap_count",
                "representative_lap_s",
                "best_lap_s",
                "long_run_lap_s",
                "long_run_degradation_s",
                "top_speed_kph",
                "air_temp_c",
                "track_temp_c",
                "rainfall_flag",
            ]
        )

    valid = laps.dropna(subset=["driver", "team"]).copy()
    valid = valid[valid["lap_time_s"].notna() & (valid["lap_time_s"] > 0)]
    rows: list[dict[str, Any]] = []

    for keys, driver_rows in valid.groupby(["season", "round", "event_name", "session_code", "driver", "team"]):
        season, round_number, event_name, session_code, driver, team = keys
        clean_laps = driver_rows.sort_values("lap_time_s")
        representative_pool = clean_laps.head(max(3, min(6, len(clean_laps))))
        long_run_pool = driver_rows[(driver_rows["tyre_life"] >= 5) & driver_rows["lap_time_s"].notna()]

        rows.append(
            {
                "season": season,
                "round": round_number,
                "event_name": event_name,
                "session_code": session_code,
                "driver": driver,
                "team": team,
                "regulation_era": regulation_era_for_season(int(season)).key,
                "session_weight": SESSION_WEIGHTS.get(str(session_code), 0.5),
                "lap_count": int(len(driver_rows)),
                "representative_lap_s": float(representative_pool["lap_time_s"].mean()) if not representative_pool.empty else None,
                "best_lap_s": float(clean_laps["lap_time_s"].min()) if not clean_laps.empty else None,
                "long_run_lap_s": float(long_run_pool["lap_time_s"].mean()) if not long_run_pool.empty else None,
                "long_run_degradation_s": float(long_run_pool["lap_time_s"].diff().dropna().mean()) if len(long_run_pool) >= 2 else None,
                "top_speed_kph": float(driver_rows[["speed_i1", "speed_i2", "speed_fl", "speed_st"]].max().max()),
                "air_temp_c": float(driver_rows["air_temp_c"].dropna().mean()) if driver_rows["air_temp_c"].notna().any() else None,
                "track_temp_c": float(driver_rows["track_temp_c"].dropna().mean()) if driver_rows["track_temp_c"].notna().any() else None,
                "rainfall_flag": bool(driver_rows["rainfall"].fillna(False).astype(bool).any()),
            }
        )

    summary = pd.DataFrame(rows)
    if summary.empty:
        return summary

    summary["gap_to_session_best_s"] = summary.groupby(
        ["season", "round", "event_name", "session_code"]
    )["representative_lap_s"].transform(lambda series: series - series.min())
    summary["pace_rank"] = summary.groupby(
        ["season", "round", "event_name", "session_code"]
    )["representative_lap_s"].rank(method="dense")

    summary["gap_to_teammate_s"] = 0.0
    for _, team_rows in summary.groupby(["season", "round", "event_name", "session_code", "team"]):
        if len(team_rows) < 2:
            continue
        team_mean = float(team_rows["representative_lap_s"].mean())
        summary.loc[team_rows.index, "gap_to_teammate_s"] = team_rows["representative_lap_s"] - team_mean

    return summary


def build_session_metadata_row(event: Any, session_code: str, session_name: str) -> dict[str, Any]:
    event_date = event.get("EventDate") if "EventDate" in event.index else event.get("Session1Date")
    season = int(pd.Timestamp(event_date).year) if event_date is not None else 0
    return {
        "season": season,
        "round": int(event["RoundNumber"]),
        "event_name": str(event["EventName"]),
        "event_format": str(event.get("EventFormat", "")),
        "session_code": session_code,
        "session_name": session_name,
    }


def staged_session_directories(settings: PipelineSettings) -> Iterable[Path]:
    if not settings.staged_fastf1_dir.exists():
        return []

    return sorted(path for path in settings.staged_fastf1_dir.glob("*/*/*") if path.is_dir())


def combined_historical_weight(
    source_season: int,
    source_round: int,
    target_season: int,
    target_round: int,
    session_code: str,
) -> float:
    season_weight = season_similarity_weight(source_season, target_season)
    race_gap = max(0, (target_season - source_season) * 24 + (target_round - source_round))
    recency_weight = 0.93**race_gap
    session_weight = SESSION_WEIGHTS.get(session_code, 0.5)
    return round(season_weight * recency_weight * session_weight, 5)
