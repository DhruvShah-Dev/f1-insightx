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
    return (output_dir / "meta.json").exists()


def write_frame(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


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
        loaded_session.race_name,
        loaded_session.session_type,
    )

    if should_skip(output_dir, resolved_write_mode):
        return output_dir, "skipped"

    output_dir.mkdir(parents=True, exist_ok=True)
    write_frame(loaded_session.laps, output_dir / "laps.csv")
    write_frame(loaded_session.results, output_dir / "results.csv")
    write_frame(loaded_session.weather, output_dir / "weather.csv")

    if loaded_session.telemetry:
        telemetry_dir = output_dir / "telemetry"
        telemetry_dir.mkdir(parents=True, exist_ok=True)
        for driver_code, telemetry in loaded_session.telemetry.items():
            write_frame(telemetry, telemetry_dir / f"{driver_code}.csv")

    meta_payload = {
        **loaded_session.metadata,
        "row_counts": {
            "laps": int(len(loaded_session.laps)),
            "results": int(len(loaded_session.results)),
            "weather": int(len(loaded_session.weather)),
            "telemetry_drivers": int(len(loaded_session.telemetry or {})),
        },
    }
    (output_dir / "meta.json").write_text(json.dumps(meta_payload, indent=2), encoding="utf-8")
    return output_dir, "written"
