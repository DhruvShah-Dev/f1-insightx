from __future__ import annotations

import json
import re
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.era import regulation_era_for_season, season_similarity_weight
from f1_insightx_data.settings import PipelineSettings


SESSION_PREFERENCE = ("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")
SESSION_WEIGHTS: dict[str, float] = {
    "FP1": 0.45,
    "FP2": 1.0,
    "FP3": 0.65,
    "Q": 1.15,
    "SQ": 1.05,
    "S": 0.9,
    "R": 1.25,
}

WEATHER_COLUMNS = {
    "AirTemp": "air_temp_c",
    "TrackTemp": "track_temp_c",
    "Humidity": "humidity_pct",
    "Rainfall": "rainfall",
    "WindSpeed": "wind_speed_mps",
    "WindDirection": "wind_direction_deg",
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


def bool_series(value: Any) -> pd.Series:
    series = value if isinstance(value, pd.Series) else pd.Series(value)
    return series.astype("boolean").fillna(False).astype(bool)


def safe_int_value(value: Any) -> int | None:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return int(value)
    except (TypeError, ValueError, OverflowError):
        return None


def nullable_int_series(value: Any) -> pd.Series:
    series = value if isinstance(value, pd.Series) else pd.Series(value)
    return pd.to_numeric(series, errors="coerce").astype("Int64")


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


def weather_summary_from_weather(weather: pd.DataFrame) -> dict[str, Any]:
    summary: dict[str, Any] = {
        "air_temp_c": None,
        "track_temp_c": None,
        "humidity_pct": None,
        "rainfall": None,
        "wind_speed_mps": None,
        "wind_direction_deg": None,
    }
    if weather.empty:
        return summary

    renamed = weather.rename(columns=WEATHER_COLUMNS)
    for column in ("air_temp_c", "track_temp_c", "humidity_pct", "wind_speed_mps", "wind_direction_deg"):
        if column in renamed.columns:
            values = pd.to_numeric(renamed[column], errors="coerce")
            if values.notna().any():
                summary[column] = float(values.mean())
    if "rainfall" in renamed.columns:
        summary["rainfall"] = bool_series(renamed["rainfall"]).any()
    return summary


def attach_weather_to_laps(laps: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    if laps.empty or weather.empty:
        return laps

    result = laps.copy()
    weather_frame = weather.rename(columns=WEATHER_COLUMNS).copy()
    available_weather = [column for column in WEATHER_COLUMNS.values() if column in weather_frame.columns]
    if not available_weather or "Time" not in weather_frame.columns:
        return result

    weather_frame["_weather_seconds"] = pd.to_timedelta(weather_frame["Time"], errors="coerce").dt.total_seconds()
    if weather_frame["_weather_seconds"].isna().all():
        parsed_time = pd.to_datetime(weather_frame["Time"], errors="coerce", utc=True)
        if parsed_time.notna().any():
            weather_frame["_weather_seconds"] = (parsed_time - parsed_time.min()).dt.total_seconds()
    weather_frame = weather_frame.dropna(subset=["_weather_seconds"]).sort_values("_weather_seconds")
    if weather_frame.empty:
        return result

    lap_seconds = pd.Series(pd.NA, index=result.index, dtype="Float64")
    if "lap_start_time" in result.columns:
        lap_start = pd.to_datetime(result["lap_start_time"], errors="coerce", utc=True)
        if lap_start.notna().any():
            weather_origin = float(weather_frame["_weather_seconds"].min())
            lap_seconds = (lap_start - lap_start.dropna().min()).dt.total_seconds() + weather_origin

    if lap_seconds.isna().all() and "lap_number" in result.columns:
        lap_number = pd.to_numeric(result["lap_number"], errors="coerce")
        if lap_number.notna().any() and lap_number.nunique(dropna=True) > 1:
            lap_min = float(lap_number.min())
            lap_max = float(lap_number.max())
            weather_min = float(weather_frame["_weather_seconds"].min())
            weather_max = float(weather_frame["_weather_seconds"].max())
            lap_seconds = (lap_number - lap_min) / (lap_max - lap_min) * (weather_max - weather_min) + weather_min

    if lap_seconds.isna().all():
        return result

    join_left = pd.DataFrame({"_row_id": result.index, "_weather_seconds": lap_seconds}).dropna()
    joined = pd.merge_asof(
        join_left.sort_values("_weather_seconds"),
        weather_frame[["_weather_seconds", *available_weather]].sort_values("_weather_seconds"),
        on="_weather_seconds",
        direction="nearest",
    ).set_index("_row_id")

    for column in available_weather:
        if column not in result.columns:
            result[column] = pd.NA
        if column == "rainfall":
            fill_values = joined[column].reindex(result.index).astype("boolean")
            current = result[column].astype("boolean")
            result[column] = current.combine_first(fill_values)
            result[column] = bool_series(result[column])
            continue
        fill_values = pd.to_numeric(joined[column].reindex(result.index), errors="coerce")
        result[column] = pd.to_numeric(result[column], errors="coerce")
        result[column] = result[column].where(result[column].notna(), fill_values)

    return result


def normalize_lap_frame(
    laps: pd.DataFrame,
    *,
    season: int,
    round_number: int,
    event_name: str,
    session_code: str,
    weather: pd.DataFrame | None = None,
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
    normalized["fresh_tyre"] = bool_series(normalized["fresh_tyre"])
    normalized["is_personal_best"] = bool_series(normalized["is_personal_best"])
    normalized["is_accurate"] = bool_series(normalized["is_accurate"])
    normalized["deleted"] = bool_series(normalized["deleted"])
    if weather is not None and not weather.empty:
        normalized = attach_weather_to_laps(normalized, weather)
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
                "humidity_pct",
                "rainfall_flag",
                "wind_speed_mps",
                "wind_direction_deg",
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
                "humidity_pct": float(driver_rows["humidity_pct"].dropna().mean()) if driver_rows["humidity_pct"].notna().any() else None,
                "rainfall_flag": bool(bool_series(driver_rows["rainfall"]).any()),
                "wind_speed_mps": float(driver_rows["wind_speed_mps"].dropna().mean()) if driver_rows["wind_speed_mps"].notna().any() else None,
                "wind_direction_deg": float(driver_rows["wind_direction_deg"].dropna().mean()) if driver_rows["wind_direction_deg"].notna().any() else None,
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
