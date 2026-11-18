"""Source-backed checks for the opening-lap view and time-window semantics."""

import csv
from pathlib import Path

from data.build_opening_evidence import first_lap_windows


DATA = Path(__file__).resolve().parents[1] / "data"


def test_opening_view_covers_sprint_and_sparse_races_without_filling_gaps():
    with (DATA / "race_analysis" / "race_analysis_opening_positions.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    by_race = {race: [row for row in rows if row["race_analysis_id"] == race]
               for race in {row["race_analysis_id"] for row in rows}}
    assert len(by_race) == 20
    assert by_race["2026-02-shanghai"]  # sprint weekend, Grand Prix race feed
    assert len({row["driver"] for row in by_race["2026-16-sepang"]}) < 22  # sparse provider coverage stays sparse


def test_provider_lap_one_label_does_not_admit_pre_race_control():
    start, end = first_lap_windows()[1]
    with (DATA / "race_analysis" / "race_analysis_events.csv").open(encoding="utf-8", newline="") as handle:
        rows = [row for row in csv.DictReader(handle)
                if row["race_analysis_id"] == "2026-01-albert_park"
                and row["event_type"] == "race_control" and row["lap_number"] == "1"]
    from datetime import datetime

    pre_race = [row for row in rows if datetime.fromisoformat(row["timestamp_utc"].replace("Z", "+00:00")) < start]
    within = [row for row in rows if start <= datetime.fromisoformat(row["timestamp_utc"].replace("Z", "+00:00")) <= end]
    assert pre_race and within
