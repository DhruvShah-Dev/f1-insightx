from __future__ import annotations

from data_pipeline.fastf1.ingest.session_loader import LoadedSession, load_session


def extract_session_datasets(
    year: int,
    race_name: str | int,
    session_name: str,
    *,
    config,
    include_telemetry: bool = False,
) -> LoadedSession:
    return load_session(
        year,
        race_name,
        session_name,
        config=config,
        include_telemetry=include_telemetry,
    )
