from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from data_pipeline.fastf1.config.settings import SESSION_IMPORTANCE, FastF1PipelineConfig
from data_pipeline.fastf1.ingest.schedule import SESSION_NAME_TO_CODE
from data_pipeline.fastf1.utils.logging import get_logger


SUPPORTED_SESSION_TYPES = {"FP1", "FP2", "FP3", "Q", "SQ", "S", "R"}


@dataclass
class LoadedSession:
    year: int
    round_number: int
    race_name: str
    session_type: str
    session_name: str
    session_importance: str
    metadata: dict[str, Any]
    laps: pd.DataFrame
    results: pd.DataFrame
    weather: pd.DataFrame
    telemetry: pd.DataFrame | None
    position_data: pd.DataFrame | None
    best_laps: pd.DataFrame
    stints: pd.DataFrame


def enable_fastf1_cache(config: FastF1PipelineConfig) -> None:
    import fastf1

    fastf1.Cache.enable_cache(str(config.cache_dir))


def normalize_session_type(session_type: str) -> str:
    normalized = session_type.strip()
    if normalized in SESSION_NAME_TO_CODE:
        normalized = SESSION_NAME_TO_CODE[normalized]
    else:
        normalized = normalized.upper()
    if normalized not in SUPPORTED_SESSION_TYPES:
        raise ValueError(f"Unsupported session type: {session_type}")
    return normalized


def get_event_schedule(year: int) -> pd.DataFrame:
    import fastf1

    return fastf1.get_event_schedule(year, include_testing=False)


def extract_laps(laps: pd.DataFrame) -> pd.DataFrame:
    if laps.empty:
        return pd.DataFrame(
            columns=[
                "Driver",
                "DriverNumber",
                "Team",
                "LapNumber",
                "Stint",
                "LapTime",
                "Sector1Time",
                "Sector2Time",
                "Sector3Time",
                "Compound",
                "TyreLife",
                "FreshTyre",
                "Position",
                "TrackStatus",
                "IsAccurate",
                "Deleted",
                "DeletedReason",
                "FastF1Generated",
                "PitInTime",
                "PitOutTime",
            ]
        )

    columns = [
        "Driver",
        "DriverNumber",
        "Team",
        "LapNumber",
        "Stint",
        "LapTime",
        "Sector1Time",
        "Sector2Time",
        "Sector3Time",
        "Compound",
        "TyreLife",
        "FreshTyre",
        "Position",
        "TrackStatus",
        "IsAccurate",
        "Deleted",
        "DeletedReason",
        "FastF1Generated",
        "PitInTime",
        "PitOutTime",
    ]
    available = [column for column in columns if column in laps.columns]
    extracted = laps.loc[:, available].copy()

    for column in ("LapTime", "Sector1Time", "Sector2Time", "Sector3Time", "PitInTime", "PitOutTime"):
        if column in extracted.columns:
            extracted[column] = extracted[column].astype(str)

    return extracted


def extract_results(results: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(results, pd.DataFrame) or results.empty:
        return pd.DataFrame()

    extracted = results.reset_index().copy()
    preferred_columns = [
        "Position",
        "ClassifiedPosition",
        "DriverNumber",
        "BroadcastName",
        "Abbreviation",
        "FullName",
        "TeamName",
        "TeamColor",
        "GridPosition",
        "Q1",
        "Q2",
        "Q3",
        "Time",
        "Status",
        "Points",
    ]
    available = [column for column in preferred_columns if column in extracted.columns]
    return extracted.loc[:, available]


def extract_weather(weather: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(weather, pd.DataFrame) or weather.empty:
        return pd.DataFrame(
            columns=[
                "Time",
                "AirTemp",
                "TrackTemp",
                "Humidity",
                "Pressure",
                "Rainfall",
                "WindDirection",
                "WindSpeed",
            ]
        )

    preferred_columns = [
        "Time",
        "AirTemp",
        "TrackTemp",
        "Humidity",
        "Pressure",
        "Rainfall",
        "WindDirection",
        "WindSpeed",
    ]
    available = [column for column in preferred_columns if column in weather.columns]
    extracted = weather.loc[:, available].copy()
    if "Time" in extracted.columns:
        extracted["Time"] = extracted["Time"].astype(str)
    return extracted


def extract_best_laps(laps: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(laps, pd.DataFrame) or laps.empty:
        return pd.DataFrame(columns=["Driver", "LapNumber", "LapTime", "Compound", "TyreLife", "Team"])

    fastest_rows = []
    for driver in sorted(set(laps["Driver"].dropna().astype(str))):
        try:
            fastest = laps.pick_drivers(driver).pick_fastest()
        except Exception:
            continue
        if fastest is None:
            continue
        fastest_rows.append(fastest)

    if not fastest_rows:
        return pd.DataFrame(columns=["Driver", "LapNumber", "LapTime", "Compound", "TyreLife", "Team"])

    extracted = pd.DataFrame(fastest_rows).reset_index(drop=True)
    preferred_columns = ["Driver", "LapNumber", "LapTime", "Compound", "TyreLife", "Team"]
    available = [column for column in preferred_columns if column in extracted.columns]
    if "LapTime" in extracted.columns:
        extracted["LapTime"] = extracted["LapTime"].astype(str)
    return extracted.loc[:, available]


def extract_stints(laps: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(laps, pd.DataFrame) or laps.empty:
        return pd.DataFrame(
            columns=[
                "Driver",
                "Team",
                "Stint",
                "Compound",
                "LapCount",
                "FirstLapNumber",
                "LastLapNumber",
                "AverageLapTimeSeconds",
            ]
        )

    extracted = laps.copy()
    if "LapTime" in extracted.columns:
        extracted["LapTimeSeconds"] = extracted["LapTime"].dt.total_seconds()

    group_columns = [column for column in ("Driver", "Team", "Stint", "Compound") if column in extracted.columns]
    summary = (
        extracted.groupby(group_columns, dropna=False)
        .agg(
            LapCount=("LapNumber", "count"),
            FirstLapNumber=("LapNumber", "min"),
            LastLapNumber=("LapNumber", "max"),
            AverageLapTimeSeconds=("LapTimeSeconds", "mean"),
        )
        .reset_index()
    )
    if "AverageLapTimeSeconds" in summary.columns:
        summary["AverageLapTimeSeconds"] = summary["AverageLapTimeSeconds"].round(3)
    return summary


def extract_telemetry(session: Any) -> pd.DataFrame:
    telemetry_frames: list[pd.DataFrame] = []
    laps = getattr(session, "laps", pd.DataFrame())
    if not isinstance(laps, pd.DataFrame) or laps.empty or "Driver" not in laps.columns:
        return pd.DataFrame()

    for driver_code in sorted(set(laps["Driver"].dropna().astype(str))):
        try:
            fastest_lap = session.laps.pick_drivers(driver_code).pick_fastest()
            telemetry = fastest_lap.get_car_data().add_distance()
            frame = telemetry.reset_index(drop=True).copy()
            frame.insert(0, "Driver", driver_code)
            if "Time" in frame.columns:
                frame["Time"] = frame["Time"].astype(str)
            telemetry_frames.append(frame)
        except Exception:
            continue

    if not telemetry_frames:
        return pd.DataFrame()

    return pd.concat(telemetry_frames, ignore_index=True)


def extract_position_data(session: Any) -> pd.DataFrame:
    position_frames: list[pd.DataFrame] = []
    laps = getattr(session, "laps", pd.DataFrame())
    if not isinstance(laps, pd.DataFrame) or laps.empty or "Driver" not in laps.columns:
        return pd.DataFrame()

    for driver_code in sorted(set(laps["Driver"].dropna().astype(str))):
        try:
            fastest_lap = session.laps.pick_drivers(driver_code).pick_fastest()
            position = fastest_lap.get_pos_data()
            frame = position.reset_index(drop=True).copy()
            frame.insert(0, "Driver", driver_code)
            if "Time" in frame.columns:
                frame["Time"] = frame["Time"].astype(str)
            position_frames.append(frame)
        except Exception:
            continue

    if not position_frames:
        return pd.DataFrame()

    return pd.concat(position_frames, ignore_index=True)


def load_session(
    year: int,
    race_name: str | int,
    session_type: str,
    *,
    config: FastF1PipelineConfig,
    include_telemetry: bool = False,
) -> LoadedSession:
    import fastf1

    logger = get_logger()
    normalized_session = normalize_session_type(session_type)
    enable_fastf1_cache(config)

    logger.info(f"Loading {year} {race_name} {session_type}")
    session = fastf1.get_session(year, race_name, session_type)
    session.load(laps=True, weather=True, messages=False, telemetry=include_telemetry)

    event = session.event
    raw_laps = getattr(session, "laps", pd.DataFrame())
    telemetry = extract_telemetry(session) if include_telemetry else None
    position_data = extract_position_data(session) if include_telemetry else None

    metadata = {
        "year": year,
        "round_number": int(event.get("RoundNumber", 0) or 0),
        "race_name": str(event.get("EventName", race_name)),
        "session_type": normalized_session,
        "session_name": str(getattr(session, "name", normalized_session)),
        "session_importance": SESSION_IMPORTANCE[normalized_session],
        "event_date": str(event.get("EventDate", "")),
        "event_format": str(event.get("EventFormat", "")),
        "country": str(event.get("Country", "")),
        "location": str(event.get("Location", "")),
        "official_event_name": str(event.get("OfficialEventName", "")),
        "circuit_key": str(event.get("CircuitKey", "")),
        "circuit_short_name": str(event.get("CircuitShortName", "")),
    }

    return LoadedSession(
        year=year,
        round_number=metadata["round_number"],
        race_name=metadata["race_name"],
        session_type=normalized_session,
        session_name=metadata["session_name"],
        session_importance=SESSION_IMPORTANCE[normalized_session],
        metadata=metadata,
        laps=extract_laps(raw_laps),
        results=extract_results(getattr(session, "results", pd.DataFrame())),
        weather=extract_weather(getattr(session, "weather_data", pd.DataFrame())),
        telemetry=telemetry,
        position_data=position_data,
        best_laps=extract_best_laps(raw_laps),
        stints=extract_stints(raw_laps),
    )
