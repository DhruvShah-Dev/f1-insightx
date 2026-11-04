from __future__ import annotations

import pandas as pd
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))

from data.build_openf1_telemetry_bridge import annotate_laps, integrated_distance


def test_integrated_distance_uses_speed_and_elapsed_time() -> None:
    timestamps = pd.Series(pd.to_datetime(["2026-01-01T00:00:00Z", "2026-01-01T00:00:01Z"]))
    distance = integrated_distance(pd.Series([36.0, 36.0]), timestamps)
    assert distance.tolist() == [0.0, 10.0]


def test_annotate_laps_maps_compound_stint_and_tyre_life() -> None:
    laps = pd.DataFrame({"driver_number": [1, 1], "lap_number": [3, 4]})
    stints = pd.DataFrame(
        {
            "driver_number": [1],
            "stint_number": [2],
            "lap_start": [3],
            "lap_end": [4],
            "compound": ["MEDIUM"],
            "tyre_age_at_start": [1],
        }
    )
    annotated = annotate_laps(laps, stints)
    assert annotated["stint"].tolist() == [2, 2]
    assert annotated["compound"].tolist() == ["MEDIUM", "MEDIUM"]
    assert annotated["tyre_life"].tolist() == [2.0, 3.0]
    assert not annotated["fresh_tyre"].any()
