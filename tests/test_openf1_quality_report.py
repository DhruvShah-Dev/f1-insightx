from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data"))
BUILDER_PATH = ROOT / "data" / "build_openf1_quality_report.py"

spec = importlib.util.spec_from_file_location("build_openf1_quality_report", BUILDER_PATH)
builder = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(builder)


def test_openf1_quality_marks_full_session_coverage_as_primary_cross_check() -> None:
    races = pd.DataFrame(
        [
            {
                "id": "2025-01-australian",
                "season": 2025,
                "round": 1,
                "race_name": "Australian Grand Prix",
            }
        ]
    )
    race_results = pd.DataFrame([{"race_id": "2025-01-australian"}])
    qualifying_results = pd.DataFrame([{"race_id": "2025-01-australian"}])
    openf1_sessions = pd.DataFrame(
        [
            {
                "year": 2025,
                "meeting_key": 1250,
                "meeting_name": "Australian Grand Prix",
                "session_key": 9501,
                "session_name": "Qualifying",
            },
            {
                "year": 2025,
                "meeting_key": 1250,
                "meeting_name": "Australian Grand Prix",
                "session_key": 9502,
                "session_name": "Race",
            },
        ]
    )
    endpoint_counts = pd.DataFrame(
        [
            {"session_key": 9501, "endpoint": "laps", "row_count": 100},
            {"session_key": 9501, "endpoint": "weather", "row_count": 10},
            {"session_key": 9502, "endpoint": "session_result", "row_count": 20},
            {"session_key": 9502, "endpoint": "starting_grid", "row_count": 20},
            {"session_key": 9502, "endpoint": "laps", "row_count": 1100},
            {"session_key": 9502, "endpoint": "weather", "row_count": 70},
        ]
    )

    report = builder.build_openf1_quality_report(
        races=races,
        race_results=race_results,
        qualifying_results=qualifying_results,
        openf1_sessions=openf1_sessions,
        endpoint_counts=endpoint_counts,
    )

    row = report.iloc[0]
    assert row["recommended_use"] == "primary_cross_check"
    assert row["coverage_score"] == 1.0
    assert row["source_agreement_score"] == 1.0
    assert row["openf1_q_session_key"] == 9501
    assert row["openf1_r_session_key"] == 9502


def test_openf1_quality_does_not_recommend_pre_2023_races() -> None:
    races = pd.DataFrame(
        [
            {
                "id": "2022-01-bahrain",
                "season": 2022,
                "round": 1,
                "race_name": "Bahrain Grand Prix",
            }
        ]
    )

    report = builder.build_openf1_quality_report(
        races=races,
        race_results=pd.DataFrame(),
        qualifying_results=pd.DataFrame(),
        openf1_sessions=pd.DataFrame(),
        endpoint_counts=pd.DataFrame(),
    )

    assert report.iloc[0]["recommended_use"] == "not_available_pre_2023"
    assert report.iloc[0]["coverage_score"] == 0.0
