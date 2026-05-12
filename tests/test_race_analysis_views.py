from __future__ import annotations

import re
import importlib.util
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RACE_ANALYSIS_DIR = ROOT / "data" / "race_analysis"
BUILDER_PATH = ROOT / "data" / "build_race_analysis_views.py"


spec = importlib.util.spec_from_file_location("build_race_analysis_views", BUILDER_PATH)
builder = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(builder)


def read_view(name: str) -> pd.DataFrame:
    path = RACE_ANALYSIS_DIR / name
    assert path.exists(), f"{name} was not generated"
    return pd.read_csv(path, low_memory=False)


def test_race_analysis_views_exist_and_have_rows() -> None:
    expected = [
        "race_analysis_index.csv",
        "race_analysis_summary.csv",
        "race_analysis_story_points.csv",
        "race_analysis_stints.csv",
        "race_analysis_pit_strategy.csv",
        "race_analysis_pace_evolution.csv",
        "race_analysis_position_changes.csv",
        "race_analysis_weather_context.csv",
        "race_analysis_links.csv",
        "race_analysis_track_status.csv",
        "race_analysis_neutralization_phases.csv",
        "race_analysis_position_timeline.csv",
        "race_analysis_position_swing_events.csv",
        "race_analysis_traffic_proxy.csv",
    ]
    for file_name in expected:
        assert not read_view(file_name).empty


def test_stint_ranges_are_possible() -> None:
    stints = read_view("race_analysis_stints.csv")
    start = pd.to_numeric(stints["start_lap"], errors="coerce")
    end = pd.to_numeric(stints["end_lap"], errors="coerce")
    length = pd.to_numeric(stints["stint_length"], errors="coerce")
    assert ((end >= start) & (length >= 0)).all()


def test_confidence_values_are_bounded() -> None:
    for file_name in RACE_ANALYSIS_DIR.glob("race_analysis_*.csv"):
        frame = pd.read_csv(file_name, low_memory=False)
        confidence_columns = [
            col
            for col in frame.columns
            if col == "confidence" or col.endswith("_confidence") or col.endswith("_quality_score")
        ]
        for col in confidence_columns:
            values = pd.to_numeric(frame[col], errors="coerce").dropna()
            assert ((values >= 0) & (values <= 1)).all(), f"{file_name.name}:{col}"


def test_story_points_stay_concise_and_do_not_claim_incidents() -> None:
    story = read_view("race_analysis_story_points.csv")
    assert (story["title"].astype(str).str.len() <= 72).all()
    assert (story["summary"].astype(str).str.len() <= 170).all()
    text = " ".join(story[["title", "summary", "data_limit_note"]].fillna("").astype(str).agg(" ".join, axis=1))
    unsupported = re.compile(
        r"\b(?:penalty|penalties|incident|crash|collision|overtake|overtakes|passed)\b",
        re.IGNORECASE,
    )
    assert unsupported.search(text) is None


def test_no_true_energy_language_in_race_analysis_views() -> None:
    forbidden = re.compile(r"\b(ers|battery)\b", re.IGNORECASE)
    for file_name in RACE_ANALYSIS_DIR.glob("race_analysis_*.csv"):
        text = file_name.read_text(encoding="utf-8")
        assert forbidden.search(text) is None, file_name.name


def test_no_fake_overtake_or_exact_gap_language() -> None:
    forbidden = re.compile(
        r"\b(?:overtake|overtakes|passed|incident|crash|collision|drs pass|drs eligible|within one second|within 1 second|dirty air caused|stuck behind)\b",
        re.IGNORECASE,
    )
    for file_name in RACE_ANALYSIS_DIR.glob("race_analysis_*.csv"):
        text = file_name.read_text(encoding="utf-8")
        assert forbidden.search(text) is None, file_name.name


def test_track_status_mapping_is_conservative() -> None:
    assert builder.track_status_metadata("1")[0] == "green"
    assert builder.track_status_metadata("2")[0] == "yellow"
    assert builder.track_status_metadata("4")[0] == "safety-car"
    assert builder.track_status_metadata("6")[0] == "virtual-safety-car"
    assert builder.track_status_metadata("5")[0] == "red-flag"
    assert builder.track_status_metadata("124")[0] == "mixed"
    assert builder.track_status_metadata("3")[0] == "unknown"


def test_neutralization_phases_keep_causes_unavailable() -> None:
    phases = read_view("race_analysis_neutralization_phases.csv")
    start = pd.to_numeric(phases["start_lap"], errors="coerce")
    end = pd.to_numeric(phases["end_lap"], errors="coerce")
    assert (end >= start).all()
    assert phases["cause_available"].astype(str).str.lower().isin(["false", "0"]).all()
    assert phases["cause_note"].astype(str).str.contains("Cause unavailable", case=False, na=False).all()
    assert set(phases["status_label"].dropna().astype(str)).issubset(
        {"yellow", "safety-car", "virtual-safety-car", "red-flag", "mixed"}
    )


def test_position_timeline_and_swing_ranges_are_valid() -> None:
    timeline = read_view("race_analysis_position_timeline.csv")
    positions = pd.to_numeric(timeline["position"], errors="coerce")
    assert positions.notna().all()
    assert ((positions >= 1) & (positions <= 30)).all()

    swings = read_view("race_analysis_position_swing_events.csv")
    start = pd.to_numeric(swings["start_lap"], errors="coerce")
    end = pd.to_numeric(swings["end_lap"], errors="coerce")
    assert (end >= start).all()
    assert set(swings["event_type"].dropna().astype(str)).issubset(
        {
            "pit-cycle movement",
            "track-position gain",
            "track-position loss",
            "neutralization-affected movement",
            "unclear",
        }
    )


def test_traffic_proxy_remains_proxy_safe() -> None:
    traffic = read_view("race_analysis_traffic_proxy.csv")
    assert set(traffic["traffic_proxy_label"].dropna().astype(str)).issubset(
        {"clean-air likely", "traffic likely", "uncertain"}
    )
    assert (traffic["evidence_type"].astype(str) == "proxy").all()
    assert traffic["drs_window_proxy"].astype(str).str.contains("proxy|gap-data-missing", case=False, na=False).all()
