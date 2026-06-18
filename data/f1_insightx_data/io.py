from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd


def read_csv_or_empty(path: Path, **kwargs: Any) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, **kwargs)


def write_csv(frame: pd.DataFrame, path: Path, **kwargs: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False, **kwargs)
