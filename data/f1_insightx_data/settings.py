from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"


@dataclass(frozen=True)
class PipelineSettings:
    jolpica_base_url: str
    raw_reference_dir: Path
    curated_dir: Path
    sql_dir: Path


def load_settings() -> PipelineSettings:
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env.local")

    return PipelineSettings(
        jolpica_base_url=os.getenv("JOLPICA_BASE_URL", "https://api.jolpi.ca/ergast/f1").rstrip("/"),
        raw_reference_dir=DATA_DIR / "raw" / "reference",
        curated_dir=DATA_DIR / "curated",
        sql_dir=DATA_DIR / "sql",
    )
