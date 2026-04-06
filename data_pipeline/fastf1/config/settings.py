from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_ROOT = REPO_ROOT / "data_pipeline"
FASTF1_ROOT = PIPELINE_ROOT / "fastf1"
DEFAULT_START_YEAR = 2020
DEFAULT_END_YEAR = 2026

SESSION_IMPORTANCE = {
    "FP1": "low",
    "FP2": "primary",
    "FP3": "medium",
    "Q": "high",
    "SQ": "high",
    "S": "high",
    "R": "ground_truth",
}

DEFAULT_WEEKEND_SESSIONS = ("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")


@dataclass(frozen=True)
class FastF1PipelineConfig:
    pipeline_root: Path
    fastf1_root: Path
    raw_dir: Path
    cache_dir: Path
    logs_dir: Path
    default_write_mode: str
    weekend_sessions: tuple[str, ...]
    start_year: int
    end_year: int
    latest_completed_cutoff_utc: datetime


def load_config(
    *,
    raw_dir: str | None = None,
    cache_dir: str | None = None,
    logs_dir: str | None = None,
    write_mode: str | None = None,
) -> FastF1PipelineConfig:
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.local")

    resolved_raw_dir = Path(
        raw_dir
        or os.getenv("FASTF1_PIPELINE_RAW_DIR")
        or str(FASTF1_ROOT / "raw")
    )
    resolved_cache_dir = Path(
        cache_dir
        or os.getenv("FASTF1_PIPELINE_CACHE_DIR")
        or str(FASTF1_ROOT / "cache")
    )
    resolved_logs_dir = Path(
        logs_dir
        or os.getenv("FASTF1_PIPELINE_LOGS_DIR")
        or str(FASTF1_ROOT / "logs")
    )

    return FastF1PipelineConfig(
        pipeline_root=PIPELINE_ROOT,
        fastf1_root=FASTF1_ROOT,
        raw_dir=resolved_raw_dir,
        cache_dir=resolved_cache_dir,
        logs_dir=resolved_logs_dir,
        default_write_mode=write_mode or os.getenv("FASTF1_PIPELINE_WRITE_MODE", "skip"),
        weekend_sessions=DEFAULT_WEEKEND_SESSIONS,
        start_year=int(os.getenv("FASTF1_PIPELINE_START_YEAR", DEFAULT_START_YEAR)),
        end_year=int(os.getenv("FASTF1_PIPELINE_END_YEAR", DEFAULT_END_YEAR)),
        latest_completed_cutoff_utc=datetime.now(timezone.utc),
    )


def ensure_pipeline_directories(config: FastF1PipelineConfig) -> None:
    config.fastf1_root.mkdir(parents=True, exist_ok=True)
    config.raw_dir.mkdir(parents=True, exist_ok=True)
    config.cache_dir.mkdir(parents=True, exist_ok=True)
    config.logs_dir.mkdir(parents=True, exist_ok=True)
