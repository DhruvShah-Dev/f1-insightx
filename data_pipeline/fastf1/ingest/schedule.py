from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pandas as pd

from data_pipeline.fastf1.config.settings import FastF1PipelineConfig


SESSION_NAME_TO_CODE = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint": "S",
    "Sprint Qualifying": "SQ",
    "Sprint Shootout": "SQ",
    "Race": "R",
}


@dataclass(frozen=True)
class EventDescriptor:
    year: int
    round_number: int
    event_name: str
    official_event_name: str
    country: str
    location: str
    event_format: str
    event_date: str
    is_completed: bool
    sessions: tuple[tuple[str, str], ...]


def _to_utc_datetime(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    parsed = pd.to_datetime(value, utc=True, errors="coerce")
    if pd.isna(parsed):
        return None
    return parsed.to_pydatetime() if isinstance(parsed, pd.Timestamp) else parsed


def _event_completed(event: pd.Series, *, cutoff_utc: datetime) -> bool:
    session_datetimes: list[datetime] = []
    for index in range(1, 6):
        for suffix in ("DateUtc", "Date"):
            key = f"Session{index}{suffix}"
            if key in event.index:
                parsed = _to_utc_datetime(event.get(key))
                if parsed is not None:
                    session_datetimes.append(parsed)
                    break

    if not session_datetimes:
        fallback = _to_utc_datetime(event.get("EventDate"))
        if fallback is None:
            return False
        session_datetimes.append(fallback)

    return max(session_datetimes) <= cutoff_utc


def _session_columns(event: pd.Series) -> tuple[tuple[str, str], ...]:
    sessions: list[tuple[str, str]] = []
    for index in range(1, 6):
        session_name = event.get(f"Session{index}")
        if not isinstance(session_name, str) or not session_name.strip():
            continue

        normalized_name = session_name.strip()
        session_code = SESSION_NAME_TO_CODE.get(normalized_name)
        if session_code is None:
            continue
        sessions.append((session_code, normalized_name))

    deduped: list[tuple[str, str]] = []
    seen_codes: set[str] = set()
    for session_code, session_name in sessions:
        if session_code in seen_codes:
            continue
        seen_codes.add(session_code)
        deduped.append((session_code, session_name))
    return tuple(deduped)


def list_target_events(schedule: pd.DataFrame, *, year: int, config: FastF1PipelineConfig) -> list[EventDescriptor]:
    events: list[EventDescriptor] = []
    for _, event in schedule.iterrows():
        round_number = int(event.get("RoundNumber", 0) or 0)
        if round_number <= 0:
            continue

        sessions = _session_columns(event)
        if not sessions:
            continue

        is_completed = _event_completed(event, cutoff_utc=config.latest_completed_cutoff_utc)
        if not is_completed:
            continue

        events.append(
            EventDescriptor(
                year=year,
                round_number=round_number,
                event_name=str(event.get("EventName", "")).strip(),
                official_event_name=str(event.get("OfficialEventName", "")).strip(),
                country=str(event.get("Country", "")).strip(),
                location=str(event.get("Location", "")).strip(),
                event_format=str(event.get("EventFormat", "")).strip(),
                event_date=str(event.get("EventDate", "")).strip(),
                is_completed=is_completed,
                sessions=sessions,
            )
        )
    return events
