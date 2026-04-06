from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from data_pipeline.fastf1.config.settings import FastF1PipelineConfig
from data_pipeline.fastf1.ingest.session_loader import LoadedSession
from data_pipeline.fastf1.utils.paths import session_output_dir


def should_skip(output_dir: Path, write_mode: str) -> bool:
    if write_mode == "overwrite":
        return False
    return (output_dir / "session_meta.json").exists()


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def write_parquet(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(path, index=False)


def save_loaded_session(
    loaded_session: LoadedSession,
    *,
    config: FastF1PipelineConfig,
    write_mode: str | None = None,
) -> tuple[Path, str]:
    resolved_write_mode = write_mode or config.default_write_mode
    output_dir = session_output_dir(
        config.raw_dir,
        loaded_session.year,
        loaded_session.round_number,
        loaded_session.race_name,
        loaded_session.session_type,
    )

    if should_skip(output_dir, resolved_write_mode):
        return output_dir, "skipped"

    output_dir.mkdir(parents=True, exist_ok=True)
    write_csv(loaded_session.laps, output_dir / "laps.csv")
    write_csv(loaded_session.results, output_dir / "results.csv")
    write_csv(loaded_session.weather, output_dir / "weather.csv")
    write_csv(loaded_session.best_laps, output_dir / "best_laps.csv")
    write_csv(loaded_session.stints, output_dir / "stints.csv")

    telemetry_rows = 0
    if loaded_session.telemetry is not None and not loaded_session.telemetry.empty:
        telemetry_rows = int(len(loaded_session.telemetry))
        write_parquet(loaded_session.telemetry, output_dir / "telemetry.parquet")

    position_rows = 0
    if loaded_session.position_data is not None and not loaded_session.position_data.empty:
        position_rows = int(len(loaded_session.position_data))
        write_parquet(loaded_session.position_data, output_dir / "position.parquet")

    meta_payload = {
        **loaded_session.metadata,
        "row_counts": {
            "laps": int(len(loaded_session.laps)),
            "results": int(len(loaded_session.results)),
            "weather": int(len(loaded_session.weather)),
            "best_laps": int(len(loaded_session.best_laps)),
            "stints": int(len(loaded_session.stints)),
            "telemetry_rows": telemetry_rows,
            "position_rows": position_rows,
        },
        "files": [
            "session_meta.json",
            "results.csv",
            "laps.csv",
            "weather.csv",
            "best_laps.csv",
            "stints.csv",
            "telemetry.parquet",
            "position.parquet",
        ],
    }
    (output_dir / "session_meta.json").write_text(json.dumps(meta_payload, indent=2), encoding="utf-8")
    return output_dir, "written"
