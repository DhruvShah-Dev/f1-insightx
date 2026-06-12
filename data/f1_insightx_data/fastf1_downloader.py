from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.fastf1_pipeline import (
    build_session_metadata_row,
    build_stint_frame,
    enable_fastf1_cache,
    normalize_lap_frame,
    safe_int_value,
    session_summary_from_laps,
    slugify,
    write_frame,
    write_json,
)
from f1_insightx_data.settings import PipelineSettings


SUPPORTED_SESSION_CODES = ("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")
SESSION_DURATION_MINUTES = {
    "FP1": 60,
    "FP2": 60,
    "FP3": 60,
    "Q": 75,
    "SQ": 60,
    "S": 60,
    "R": 150,
}
SESSION_NAME_TO_CODE = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SQ",
    "Sprint": "S",
    "Race": "R",
    "SS": "SQ",
}
RAW_REQUIRED_FILES = (
    "session_manifest.json",
    "results.csv",
    "laps.csv",
    "weather.csv",
    "best_laps.csv",
    "stints.csv",
)
STAGED_REQUIRED_FILES = (
    "session_manifest.json",
    "laps.csv",
    "stints.csv",
    "session_summary.csv",
    "results.csv",
    "weather.csv",
    "best_laps.csv",
)


@dataclass(frozen=True)
class SessionTarget:
    season: int
    round_number: int
    event_name: str
    event_slug: str
    session_code: str
    session_name: str
    event_format: str
    event_date: str
    country: str
    location: str
    official_event_name: str
    is_completed: bool

    @property
    def session_id(self) -> str:
        return f"{self.season}|{self.round_number:02d}|{self.event_slug}|{self.session_code}"


@dataclass(frozen=True)
class DownloadOptions:
    start_season: int
    end_season: int
    season: int | None
    round_number: int | None
    sessions: tuple[str, ...]
    include_telemetry: bool
    only_missing: bool
    retry_failed: bool
    max_retries: int
    sleep_seconds: float
    completion_buffer_minutes: int
    dry_run: bool
    force: bool


class FastF1DownloadError(RuntimeError):
    pass


class FastF1RateLimitStop(RuntimeError):
    pass


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def is_rate_limit_error(error: BaseException) -> bool:
    return error.__class__.__name__ == "RateLimitExceededError"


def normalize_requested_sessions(values: list[str] | tuple[str, ...] | None) -> tuple[str, ...]:
    if not values:
        return SUPPORTED_SESSION_CODES

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_value in values:
        for token in str(raw_value).split(","):
            value = token.strip()
            if not value:
                continue
            session_code = SESSION_NAME_TO_CODE.get(value, value.upper())
            if session_code not in SUPPORTED_SESSION_CODES:
                raise ValueError(f"Unsupported session code: {value}")
            if session_code in seen:
                continue
            seen.add(session_code)
            normalized.append(session_code)

    return tuple(normalized) if normalized else SUPPORTED_SESSION_CODES


def ensure_parquet_support() -> None:
    try:
        import pyarrow  # noqa: F401
    except ModuleNotFoundError as error:
        raise FastF1DownloadError(
            "Telemetry download requires pyarrow because telemetry and position data are stored as parquet."
        ) from error


def raw_event_dir(settings: PipelineSettings, target: SessionTarget) -> Path:
    return settings.raw_fastf1_dir / str(target.season) / f"{target.round_number:02d}_{target.event_slug}"


def raw_session_dir(settings: PipelineSettings, target: SessionTarget) -> Path:
    return raw_event_dir(settings, target) / target.session_code


def staged_event_dir(settings: PipelineSettings, target: SessionTarget) -> Path:
    return settings.staged_fastf1_dir / str(target.season) / f"{target.round_number:02d}_{target.event_slug}"


def staged_session_dir(settings: PipelineSettings, target: SessionTarget) -> Path:
    return staged_event_dir(settings, target) / target.session_code.lower()


def checksum_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_parquet(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(path, index=False)


def write_manifest(path: Path, payload: dict[str, Any]) -> None:
    write_json(path, payload)


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def manifest_exists_and_complete(
    manifest: dict[str, Any] | None,
    *,
    include_telemetry: bool,
    raw_dir: Path,
    staged_dir: Path,
) -> bool:
    if not manifest:
        return False
    if manifest.get("status") != "complete":
        return False
    raw_files = manifest.get("raw_files", {})
    staged_files = manifest.get("staged_files", {})
    if not all((raw_dir / name).exists() for name in RAW_REQUIRED_FILES):
        return False
    if not all((staged_dir / name).exists() for name in STAGED_REQUIRED_FILES):
        return False
    if not raw_files or not staged_files:
        return False
    if include_telemetry and not bool(manifest.get("telemetry_requested")):
        return False
    if include_telemetry and bool(manifest.get("telemetry_available")) and not (raw_dir / "telemetry.parquet").exists():
        return False
    if include_telemetry and bool(manifest.get("position_available")) and not (raw_dir / "position.parquet").exists():
        return False
    return True


def load_manifest(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def session_retry_allowed(manifest: dict[str, Any] | None, max_retries: int) -> bool:
    if not manifest:
        return True
    return int(manifest.get("download_attempts") or 0) < max_retries


def manifest_event_series(target: SessionTarget) -> pd.Series:
    return pd.Series(
        {
            "RoundNumber": target.round_number,
            "EventName": target.event_name,
            "EventDate": target.event_date,
            "EventFormat": target.event_format,
            "Country": target.country,
            "Location": target.location,
            "OfficialEventName": target.official_event_name,
        }
    )


def should_process_session(
    target: SessionTarget,
    *,
    settings: PipelineSettings,
    options: DownloadOptions,
) -> tuple[bool, str]:
    raw_dir = raw_session_dir(settings, target)
    staged_dir = staged_session_dir(settings, target)
    manifest = load_manifest(raw_dir / "session_manifest.json")

    if options.force:
        return True, "forced"

    if manifest_exists_and_complete(
        manifest,
        include_telemetry=options.include_telemetry,
        raw_dir=raw_dir,
        staged_dir=staged_dir,
    ):
        return False, "already_complete"

    if manifest and manifest.get("status") in {"failed", "unavailable"}:
        if options.retry_failed and session_retry_allowed(manifest, options.max_retries):
            return True, "retry_failed"
        return False, "failed_requires_retry_flag"

    if manifest and manifest.get("status") == "running":
        return True, "resume_incomplete"

    if manifest and manifest.get("status") == "partial":
        return True, "repair_partial"

    if manifest and options.include_telemetry and not bool(manifest.get("telemetry_requested")):
        return True, "backfill_telemetry"

    if options.only_missing:
        return manifest is None or manifest.get("status") in {"partial", "running"}, "only_missing"

    return True, "missing_or_incomplete"


def event_completed(event: pd.Series, *, cutoff_utc: datetime) -> bool:
    session_datetimes: list[datetime] = []
    for index in range(1, 6):
        for suffix in ("DateUtc", "Date"):
            key = f"Session{index}{suffix}"
            if key not in event.index:
                continue
            parsed = pd.to_datetime(event.get(key), utc=True, errors="coerce")
            if pd.isna(parsed):
                continue
            session_datetimes.append(parsed.to_pydatetime())
            break

    if not session_datetimes:
        fallback = pd.to_datetime(event.get("EventDate"), utc=True, errors="coerce")
        if pd.isna(fallback):
            return False
        session_datetimes.append(fallback.to_pydatetime())

    return max(session_datetimes) <= cutoff_utc


def parse_session_datetime(event: pd.Series, session_index: int) -> datetime | None:
    for suffix in ("DateUtc", "Date"):
        key = f"Session{session_index}{suffix}"
        if key not in event.index:
            continue
        parsed = pd.to_datetime(event.get(key), utc=True, errors="coerce")
        if pd.isna(parsed):
            continue
        return parsed.to_pydatetime()
    return None


def session_completed(
    event: pd.Series,
    *,
    session_index: int,
    session_code: str,
    cutoff_utc: datetime,
    completion_buffer_minutes: int,
) -> bool:
    session_start = parse_session_datetime(event, session_index)
    if session_start is None:
        return event_completed(event, cutoff_utc=cutoff_utc)

    duration = SESSION_DURATION_MINUTES.get(session_code, 60)
    session_ready_at = session_start + timedelta(minutes=duration + max(0, completion_buffer_minutes))
    return session_ready_at <= cutoff_utc


def list_session_targets(
    schedule: pd.DataFrame,
    *,
    season: int,
    requested_sessions: tuple[str, ...],
    cutoff_utc: datetime,
    target_round_number: int | None = None,
    completion_buffer_minutes: int = 30,
) -> list[SessionTarget]:
    targets: list[SessionTarget] = []
    requested = set(requested_sessions)
    for _, event in schedule.iterrows():
        event_round_number = int(event.get("RoundNumber", 0) or 0)
        if event_round_number <= 0:
            continue
        if target_round_number is not None and target_round_number != event_round_number:
            continue

        event_name = str(event.get("EventName", "")).strip()
        if not event_name:
            continue

        available_sessions: list[tuple[str, str]] = []
        for session_index in range(1, 6):
            raw_session_name = event.get(f"Session{session_index}")
            if not isinstance(raw_session_name, str) or not raw_session_name.strip():
                continue
            session_name = raw_session_name.strip()
            session_code = SESSION_NAME_TO_CODE.get(session_name)
            if not session_code or session_code not in requested:
                continue
            if not session_completed(
                event,
                session_index=session_index,
                session_code=session_code,
                cutoff_utc=cutoff_utc,
                completion_buffer_minutes=completion_buffer_minutes,
            ):
                continue
            if any(existing_code == session_code for existing_code, _ in available_sessions):
                continue
            available_sessions.append((session_code, session_name))

        event_slug = slugify(event_name)
        for session_code, session_name in available_sessions:
            targets.append(
                SessionTarget(
                    season=season,
                    round_number=event_round_number,
                    event_name=event_name,
                    event_slug=event_slug,
                    session_code=session_code,
                    session_name=session_name,
                    event_format=str(event.get("EventFormat", "")).strip(),
                    event_date=str(event.get("EventDate", "")).strip(),
                    country=str(event.get("Country", "")).strip(),
                    location=str(event.get("Location", "")).strip(),
                    official_event_name=str(event.get("OfficialEventName", "")).strip(),
                    is_completed=True,
                )
            )

    return targets


def extract_results(results: pd.DataFrame) -> pd.DataFrame:
    if not isinstance(results, pd.DataFrame) or results.empty:
        return pd.DataFrame(
            columns=[
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
        )

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
    columns = ["Time", "AirTemp", "TrackTemp", "Humidity", "Pressure", "Rainfall", "WindDirection", "WindSpeed"]
    if not isinstance(weather, pd.DataFrame) or weather.empty:
        return pd.DataFrame(columns=columns)

    available = [column for column in columns if column in weather.columns]
    extracted = weather.loc[:, available].copy()
    if "Time" in extracted.columns:
        extracted["Time"] = extracted["Time"].astype(str)
    return extracted


def extract_best_laps(laps: pd.DataFrame) -> pd.DataFrame:
    columns = ["Driver", "LapNumber", "LapTime", "Compound", "TyreLife", "Team"]
    if not isinstance(laps, pd.DataFrame) or laps.empty:
        return pd.DataFrame(columns=columns)

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
        return pd.DataFrame(columns=columns)

    extracted = pd.DataFrame(fastest_rows).reset_index(drop=True)
    available = [column for column in columns if column in extracted.columns]
    if "LapTime" in extracted.columns:
        extracted["LapTime"] = extracted["LapTime"].astype(str)
    return extracted.loc[:, available]


def extract_raw_stints(laps: pd.DataFrame) -> pd.DataFrame:
    columns = ["Driver", "Team", "Stint", "Compound", "LapCount", "FirstLapNumber", "LastLapNumber", "AverageLapTimeSeconds"]
    if not isinstance(laps, pd.DataFrame) or laps.empty:
        return pd.DataFrame(columns=columns)

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
    return summary.loc[:, columns]


def extract_fastest_lap_telemetry(session: Any, target: SessionTarget) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    laps = getattr(session, "laps", pd.DataFrame())
    if not isinstance(laps, pd.DataFrame) or laps.empty or "Driver" not in laps.columns:
        return pd.DataFrame()

    for driver_code in sorted(set(laps["Driver"].dropna().astype(str))):
        try:
            fastest_lap = session.laps.pick_drivers(driver_code).pick_fastest()
            if fastest_lap is None:
                continue
            telemetry = fastest_lap.get_car_data().add_distance().reset_index(drop=True)
        except Exception:
            continue

        if telemetry.empty:
            continue

        available = [
            column
            for column in (
                "Date",
                "SessionTime",
                "Time",
                "Distance",
                "RelativeDistance",
                "Speed",
                "RPM",
                "nGear",
                "Throttle",
                "Brake",
                "DRS",
                "Source",
            )
            if column in telemetry.columns
        ]
        frame = telemetry.loc[:, available].copy()
        frame.insert(0, "driver", driver_code)
        frame.insert(1, "session_code", target.session_code)
        frame.insert(2, "race_name", target.event_name)
        frame.insert(3, "round", target.round_number)
        frame.insert(4, "season", target.season)
        frame.insert(5, "lap_number", safe_int_value(getattr(fastest_lap, "LapNumber", None)))
        frame.insert(6, "compound", str(getattr(fastest_lap, "Compound", "") or ""))
        frame.insert(7, "tyre_life", safe_int_value(getattr(fastest_lap, "TyreLife", None)))

        for column in ("Date", "SessionTime", "Time"):
            if column in frame.columns:
                frame[column] = frame[column].astype(str)
        frames.append(frame)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def extract_fastest_lap_position(session: Any, target: SessionTarget) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    laps = getattr(session, "laps", pd.DataFrame())
    if not isinstance(laps, pd.DataFrame) or laps.empty or "Driver" not in laps.columns:
        return pd.DataFrame()

    for driver_code in sorted(set(laps["Driver"].dropna().astype(str))):
        try:
            fastest_lap = session.laps.pick_drivers(driver_code).pick_fastest()
            if fastest_lap is None:
                continue
            position = fastest_lap.get_pos_data().reset_index(drop=True)
        except Exception:
            continue

        if position.empty:
            continue

        available = [column for column in ("Date", "SessionTime", "Time", "X", "Y", "Z", "Status", "Source") if column in position.columns]
        frame = position.loc[:, available].copy()
        frame.insert(0, "driver", driver_code)
        frame.insert(1, "session_code", target.session_code)
        frame.insert(2, "race_name", target.event_name)
        frame.insert(3, "round", target.round_number)
        frame.insert(4, "season", target.season)
        frame.insert(5, "lap_number", safe_int_value(getattr(fastest_lap, "LapNumber", None)))

        for column in ("Date", "SessionTime", "Time"):
            if column in frame.columns:
                frame[column] = frame[column].astype(str)
        frames.append(frame)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def build_raw_session_metadata(
    event: pd.Series,
    target: SessionTarget,
    *,
    status: str,
    include_telemetry: bool,
    attempt: int,
    started_at: str,
    completed_at: str | None,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        **build_session_metadata_row(event, target.session_code, target.session_name),
        "event_format": target.event_format,
        "event_date": target.event_date,
        "country": target.country,
        "location": target.location,
        "official_event_name": target.official_event_name,
        "status": status,
        "download_attempts": attempt,
        "telemetry_requested": include_telemetry,
        "started_at": started_at,
        "completed_at": completed_at,
        "error": error,
    }


def file_details(path: Path) -> dict[str, Any]:
    return {
        "path": path.name,
        "bytes": path.stat().st_size,
        "sha256": checksum_sha256(path),
    }


def persist_session(
    *,
    settings: PipelineSettings,
    target: SessionTarget,
    event: pd.Series,
    session: Any,
    include_telemetry: bool,
    attempt: int,
    started_at: str,
) -> dict[str, Any]:
    raw_dir = raw_session_dir(settings, target)
    staged_dir = staged_session_dir(settings, target)
    raw_dir.mkdir(parents=True, exist_ok=True)
    staged_dir.mkdir(parents=True, exist_ok=True)

    raw_laps = getattr(session, "laps", pd.DataFrame())
    results = extract_results(getattr(session, "results", pd.DataFrame()))
    weather = extract_weather(getattr(session, "weather_data", pd.DataFrame()))
    best_laps = extract_best_laps(raw_laps)
    raw_stints = extract_raw_stints(raw_laps)

    normalized_laps = normalize_lap_frame(
        raw_laps,
        season=target.season,
        round_number=target.round_number,
        event_name=target.event_name,
        session_code=target.session_code,
        weather=weather,
    )
    normalized_stints = build_stint_frame(normalized_laps)
    session_summary = session_summary_from_laps(normalized_laps)

    telemetry = extract_fastest_lap_telemetry(session, target) if include_telemetry else pd.DataFrame()
    position = extract_fastest_lap_position(session, target) if include_telemetry else pd.DataFrame()

    write_frame(results, raw_dir / "results.csv")
    write_frame(normalized_laps, raw_dir / "laps.csv")
    write_frame(weather, raw_dir / "weather.csv")
    write_frame(best_laps, raw_dir / "best_laps.csv")
    write_frame(raw_stints, raw_dir / "stints.csv")

    write_frame(normalized_laps, staged_dir / "laps.csv")
    write_frame(normalized_stints, staged_dir / "stints.csv")
    write_frame(session_summary, staged_dir / "session_summary.csv")
    write_frame(results, staged_dir / "results.csv")
    write_frame(weather, staged_dir / "weather.csv")
    write_frame(best_laps, staged_dir / "best_laps.csv")

    if include_telemetry and not telemetry.empty:
        write_parquet(telemetry, raw_dir / "telemetry.parquet")
    if include_telemetry and not position.empty:
        write_parquet(position, raw_dir / "position.parquet")

    completed_at = utc_now_iso()
    raw_manifest = build_raw_session_metadata(
        event,
        target,
        status="complete",
        include_telemetry=include_telemetry,
        attempt=attempt,
        started_at=started_at,
        completed_at=completed_at,
    )
    raw_manifest.update(
        {
            "row_counts": {
                "results": int(len(results)),
                "laps": int(len(normalized_laps)),
                "weather": int(len(weather)),
                "best_laps": int(len(best_laps)),
                "stints": int(len(raw_stints)),
                "telemetry_rows": int(len(telemetry)),
                "position_rows": int(len(position)),
            },
            "telemetry_available": not telemetry.empty,
            "position_available": not position.empty,
        }
    )

    staged_manifest = {
        **build_session_metadata_row(event, target.session_code, target.session_name),
        "status": "complete",
        "started_at": started_at,
        "completed_at": completed_at,
        "source": "fastf1_staged_session_v2",
    }
    write_manifest(staged_dir / "session_manifest.json", staged_manifest)

    raw_manifest_path = raw_dir / "session_manifest.json"
    write_manifest(raw_manifest_path, raw_manifest)

    raw_files: dict[str, Any] = {name: file_details(raw_dir / name) for name in RAW_REQUIRED_FILES}
    staged_files: dict[str, Any] = {name: file_details(staged_dir / name) for name in STAGED_REQUIRED_FILES}
    if include_telemetry and (raw_dir / "telemetry.parquet").exists():
        raw_files["telemetry.parquet"] = file_details(raw_dir / "telemetry.parquet")
    if include_telemetry and (raw_dir / "position.parquet").exists():
        raw_files["position.parquet"] = file_details(raw_dir / "position.parquet")

    raw_manifest["raw_files"] = raw_files
    raw_manifest["staged_files"] = staged_files
    write_manifest(raw_manifest_path, raw_manifest)
    raw_manifest["manifest_sha256"] = checksum_sha256(raw_manifest_path)
    write_manifest(raw_manifest_path, raw_manifest)

    return raw_manifest


def persist_failure_manifest(
    *,
    settings: PipelineSettings,
    target: SessionTarget,
    event: pd.Series,
    include_telemetry: bool,
    attempt: int,
    started_at: str,
    status: str,
    error: str,
) -> dict[str, Any]:
    raw_dir = raw_session_dir(settings, target)
    staged_dir = staged_session_dir(settings, target)
    raw_dir.mkdir(parents=True, exist_ok=True)
    staged_dir.mkdir(parents=True, exist_ok=True)
    completed_at = utc_now_iso()
    raw_manifest = build_raw_session_metadata(
        event,
        target,
        status=status,
        include_telemetry=include_telemetry,
        attempt=attempt,
        started_at=started_at,
        completed_at=completed_at,
        error=error,
    )
    raw_manifest["row_counts"] = {
        "results": 0,
        "laps": 0,
        "weather": 0,
        "best_laps": 0,
        "stints": 0,
        "telemetry_rows": 0,
        "position_rows": 0,
    }
    raw_manifest["telemetry_available"] = False
    raw_manifest["position_available"] = False
    raw_manifest["raw_files"] = {}
    raw_manifest["staged_files"] = {}
    write_manifest(raw_dir / "session_manifest.json", raw_manifest)
    write_manifest(
        staged_dir / "session_manifest.json",
        {
            **build_session_metadata_row(event, target.session_code, target.session_name),
            "status": status,
            "started_at": started_at,
            "completed_at": completed_at,
            "error": error,
            "source": "fastf1_staged_session_v2",
        },
    )
    raw_manifest["manifest_sha256"] = checksum_sha256(raw_dir / "session_manifest.json")
    write_manifest(raw_dir / "session_manifest.json", raw_manifest)
    return raw_manifest


def mark_session_running(
    *,
    settings: PipelineSettings,
    target: SessionTarget,
    include_telemetry: bool,
    attempt: int,
    started_at: str,
) -> None:
    raw_dir = raw_session_dir(settings, target)
    staged_dir = staged_session_dir(settings, target)
    raw_dir.mkdir(parents=True, exist_ok=True)
    staged_dir.mkdir(parents=True, exist_ok=True)
    event_series = manifest_event_series(target)

    raw_manifest = build_raw_session_metadata(
        event_series,
        target,
        status="running",
        include_telemetry=include_telemetry,
        attempt=attempt,
        started_at=started_at,
        completed_at=None,
    )
    raw_manifest["row_counts"] = {}
    raw_manifest["telemetry_available"] = False
    raw_manifest["position_available"] = False
    raw_manifest["raw_files"] = {}
    raw_manifest["staged_files"] = {}
    write_manifest(raw_dir / "session_manifest.json", raw_manifest)

    write_manifest(
        staged_dir / "session_manifest.json",
        {
            **build_session_metadata_row(event_series, target.session_code, target.session_name),
            "status": "running",
            "started_at": started_at,
            "completed_at": None,
            "source": "fastf1_staged_session_v2",
        },
    )


def write_root_indexes(
    *,
    settings: PipelineSettings,
    manifest_rows: list[dict[str, Any]],
    targets: list[SessionTarget],
    persist: bool = True,
) -> dict[str, Any]:
    index_rows = []
    complete_count = 0
    failed_count = 0
    telemetry_present = 0
    missing_by_season_session: dict[str, dict[str, int]] = {}

    latest_by_session = {row["session_id"]: row for row in manifest_rows if "session_id" in row}
    for target in targets:
        row = latest_by_session.get(target.session_id)
        status = row.get("status") if row else "missing"
        if status == "complete":
            complete_count += 1
        elif status in {"failed", "unavailable", "partial"}:
            failed_count += 1
        if row and row.get("telemetry_available"):
            telemetry_present += 1
        if status != "complete":
            season_bucket = missing_by_season_session.setdefault(str(target.season), {})
            season_bucket[target.session_code] = season_bucket.get(target.session_code, 0) + 1

        index_rows.append(
            {
                "session_id": target.session_id,
                "season": target.season,
                "round": target.round_number,
                "event_name": target.event_name,
                "session_code": target.session_code,
                "status": status,
                "download_attempts": int(row.get("download_attempts") or 0) if row else 0,
                "telemetry_requested": bool(row.get("telemetry_requested")) if row else False,
                "telemetry_available": bool(row.get("telemetry_available")) if row else False,
                "position_available": bool(row.get("position_available")) if row else False,
                "manifest_sha256": row.get("manifest_sha256") if row else None,
                "completed_at": row.get("completed_at") if row else None,
                "error": row.get("error") if row else None,
            }
        )

    summary = {
        "generated_at": utc_now_iso(),
        "target_sessions": len(targets),
        "completed_sessions": complete_count,
        "failed_sessions": failed_count,
        "telemetry_files_present": telemetry_present,
        "missing_by_season_session": missing_by_season_session,
    }
    if persist:
        write_frame(pd.DataFrame(index_rows), settings.raw_fastf1_dir / "ingestion_manifest_index.csv")
        write_json(settings.raw_fastf1_dir / "completion_summary.json", summary)
    return summary


def load_or_fetch_schedule(*, season: int, settings: PipelineSettings) -> pd.DataFrame:
    schedule_path = settings.raw_fastf1_dir / f"event_schedule_{season}.csv"
    if schedule_path.exists():
        return pd.read_csv(schedule_path)

    import fastf1

    try:
        schedule = fastf1.get_event_schedule(season, include_testing=False)
    except Exception as error:  # noqa: BLE001
        if is_rate_limit_error(error):
            raise FastF1RateLimitStop(f"FastF1 rate limit reached while fetching {season} schedule: {error}") from error
        raise
    write_frame(schedule.copy(), schedule_path)
    return schedule


def run_fastf1_download(settings: PipelineSettings, options: DownloadOptions) -> dict[str, Any]:
    if options.include_telemetry and not options.dry_run:
        ensure_parquet_support()

    enable_fastf1_cache(settings)
    settings.raw_fastf1_dir.mkdir(parents=True, exist_ok=True)
    settings.staged_fastf1_dir.mkdir(parents=True, exist_ok=True)

    all_targets: list[SessionTarget] = []
    manifest_rows: list[dict[str, Any]] = []
    run_counters = {
        "planned": 0,
        "written": 0,
        "skipped": 0,
        "failed": 0,
        "telemetry_written": 0,
        "rate_limited": False,
    }
    stopped_early_reason: str | None = None

    season_from = options.season if options.season is not None else options.start_season
    season_to = options.season if options.season is not None else options.end_season

    for season in range(season_from, season_to + 1):
        try:
            schedule = load_or_fetch_schedule(season=season, settings=settings)
        except FastF1RateLimitStop as error:
            stopped_early_reason = str(error)
            run_counters["rate_limited"] = True
            break

        write_frame(schedule.copy(), settings.raw_fastf1_dir / f"event_schedule_{season}.csv")
        season_targets = list_session_targets(
            schedule,
            season=season,
            requested_sessions=options.sessions,
            cutoff_utc=datetime.now(timezone.utc),
            target_round_number=options.round_number,
            completion_buffer_minutes=options.completion_buffer_minutes,
        )
        all_targets.extend(season_targets)

        for target in season_targets:
            should_process, reason = should_process_session(target, settings=settings, options=options)
            if not should_process:
                run_counters["skipped"] += 1
                existing_manifest = load_manifest(raw_session_dir(settings, target) / "session_manifest.json")
                if existing_manifest:
                    manifest_rows.append({**existing_manifest, "session_id": target.session_id})
                continue

            run_counters["planned"] += 1
            if options.dry_run:
                manifest_rows.append(
                    {
                        "session_id": target.session_id,
                        "season": target.season,
                        "round": target.round_number,
                        "event_name": target.event_name,
                        "session_code": target.session_code,
                        "status": "planned",
                        "reason": reason,
                    }
                )
                continue

            started_at = utc_now_iso()
            raw_manifest = load_manifest(raw_session_dir(settings, target) / "session_manifest.json")
            attempt = int(raw_manifest.get("download_attempts") or 0) + 1 if raw_manifest else 1
            event_metadata = manifest_event_series(target)
            mark_session_running(
                settings=settings,
                target=target,
                include_telemetry=options.include_telemetry,
                attempt=attempt,
                started_at=started_at,
            )

            try:
                import fastf1

                event = fastf1.get_event(target.season, target.round_number)
                session = event.get_session(target.session_code)
                session.load(laps=True, telemetry=options.include_telemetry, weather=True, messages=False)
                persisted = persist_session(
                    settings=settings,
                    target=target,
                    event=event if isinstance(event, pd.Series) else event_metadata,
                    session=session,
                    include_telemetry=options.include_telemetry,
                    attempt=attempt,
                    started_at=started_at,
                )
                persisted["session_id"] = target.session_id
                manifest_rows.append(persisted)
                append_jsonl(settings.raw_fastf1_dir / "ingestion_manifest.jsonl", persisted)
                run_counters["written"] += 1
                if persisted.get("telemetry_available"):
                    run_counters["telemetry_written"] += 1
            except Exception as error:  # noqa: BLE001
                if is_rate_limit_error(error):
                    failure_manifest = persist_failure_manifest(
                        settings=settings,
                        target=target,
                        event=event_metadata,
                        include_telemetry=options.include_telemetry,
                        attempt=attempt,
                        started_at=started_at,
                        status="failed",
                        error=f"FastF1 rate limit reached: {error}",
                    )
                    failure_manifest["session_id"] = target.session_id
                    manifest_rows.append(failure_manifest)
                    append_jsonl(settings.raw_fastf1_dir / "ingestion_manifest.jsonl", failure_manifest)
                    append_jsonl(settings.raw_fastf1_dir / "failed_sessions.jsonl", failure_manifest)
                    run_counters["failed"] += 1
                    run_counters["rate_limited"] = True
                    stopped_early_reason = f"FastF1 rate limit reached while loading {target.session_id}: {error}"
                    break

                failure_status = "unavailable" if "session" in str(error).lower() and "not" in str(error).lower() else "failed"
                failure_manifest = persist_failure_manifest(
                    settings=settings,
                    target=target,
                    event=event_metadata,
                    include_telemetry=options.include_telemetry,
                    attempt=attempt,
                    started_at=started_at,
                    status=failure_status,
                    error=str(error),
                )
                failure_manifest["session_id"] = target.session_id
                manifest_rows.append(failure_manifest)
                append_jsonl(settings.raw_fastf1_dir / "ingestion_manifest.jsonl", failure_manifest)
                append_jsonl(settings.raw_fastf1_dir / "failed_sessions.jsonl", failure_manifest)
                run_counters["failed"] += 1

            write_root_indexes(settings=settings, manifest_rows=manifest_rows, targets=all_targets)
            if options.sleep_seconds > 0:
                time.sleep(options.sleep_seconds)

        if stopped_early_reason:
            break

    summary = write_root_indexes(
        settings=settings,
        manifest_rows=manifest_rows,
        targets=all_targets,
        persist=not options.dry_run,
    )
    summary["run"] = run_counters
    if stopped_early_reason:
        summary["stopped_early_reason"] = stopped_early_reason
    if not options.dry_run:
        write_json(settings.raw_fastf1_dir / "completion_summary.json", summary)
    return summary


def validate_fastf1_archive(
    settings: PipelineSettings,
    *,
    start_season: int,
    end_season: int,
    sessions: tuple[str, ...],
) -> dict[str, Any]:
    enable_fastf1_cache(settings)
    all_targets: list[SessionTarget] = []
    stopped_early_reason: str | None = None
    for season in range(start_season, end_season + 1):
        try:
            schedule = load_or_fetch_schedule(season=season, settings=settings)
        except FastF1RateLimitStop as error:
            stopped_early_reason = str(error)
            break

        all_targets.extend(
            list_session_targets(
                schedule,
                season=season,
                requested_sessions=sessions,
                cutoff_utc=datetime.now(timezone.utc),
            )
        )

    manifest_rows: list[dict[str, Any]] = []
    for target in all_targets:
        manifest = load_manifest(raw_session_dir(settings, target) / "session_manifest.json")
        if manifest:
            manifest_rows.append({**manifest, "session_id": target.session_id})

    summary = write_root_indexes(settings=settings, manifest_rows=manifest_rows, targets=all_targets, persist=False)
    summary["sessions_skipped"] = summary["completed_sessions"]
    summary["sessions_failed"] = summary["failed_sessions"]
    if stopped_early_reason:
        summary["stopped_early_reason"] = stopped_early_reason
    return summary
