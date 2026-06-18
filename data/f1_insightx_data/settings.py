from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DEFAULT_JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1"
DEFAULT_OPENF1_BASE_URL = "https://api.openf1.org/v1"


@dataclass(frozen=True)
class PipelineSettings:
    jolpica_base_url: str
    openf1_base_url: str
    raw_reference_dir: Path
    raw_fastf1_dir: Path
    raw_openf1_dir: Path
    curated_dir: Path
    staged_openf1_dir: Path
    staged_fastf1_dir: Path
    canonical_fastf1_dir: Path
    features_dir: Path
    model_inputs_dir: Path
    predictions_dir: Path
    race_week_dir: Path
    strategy_lab_dir: Path
    fastf1_cache_dir: Path
    sql_dir: Path


def env_or_default(name: str, default: str) -> str:
    value = os.getenv(name)
    return (value.strip() if value and value.strip() else default).rstrip("/")


def load_settings() -> PipelineSettings:
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")

    return PipelineSettings(
        jolpica_base_url=env_or_default("JOLPICA_BASE_URL", DEFAULT_JOLPICA_BASE_URL),
        openf1_base_url=env_or_default("OPENF1_BASE_URL", DEFAULT_OPENF1_BASE_URL),
        raw_reference_dir=DATA_DIR / "raw" / "reference",
        raw_fastf1_dir=DATA_DIR / "raw" / "fastf1",
        raw_openf1_dir=DATA_DIR / "raw" / "openf1",
        curated_dir=DATA_DIR / "curated",
        staged_openf1_dir=DATA_DIR / "staged" / "openf1",
        staged_fastf1_dir=DATA_DIR / "staged" / "fastf1",
        canonical_fastf1_dir=DATA_DIR / "canonical_fastf1",
        features_dir=DATA_DIR / "features",
        model_inputs_dir=DATA_DIR / "model_inputs",
        predictions_dir=DATA_DIR / "predictions",
        race_week_dir=DATA_DIR / "race_week",
        strategy_lab_dir=DATA_DIR / "strategy_lab",
        fastf1_cache_dir=DATA_DIR / ".cache" / "fastf1",
        sql_dir=DATA_DIR / "sql",
    )
