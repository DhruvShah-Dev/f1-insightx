from __future__ import annotations

import csv
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from data import post_race_refresh as refresh
from data.build_web_fallback import select_upcoming
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))
from data.fetch_openf1_data import DEFAULT_ENDPOINTS, driver_numbers, near_race


def race(round_number: int, scheduled: datetime, sprint: bool = False) -> dict[str, str]:
    return {
        "id": f"2026-{round_number:02d}-test",
        "season": "2026",
        "round": str(round_number),
        "scheduled_at": scheduled.isoformat().replace("+00:00", "Z"),
        "sprint_weekend": str(sprint).lower(),
    }


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)


def test_post_race_gate_handles_ordinary_and_sprint_weekends() -> None:
    start = datetime(2026, 10, 25, 20, tzinfo=UTC)
    races = [race(18, start), race(19, start + timedelta(days=7), sprint=True)]
    assert refresh.race_target(start + timedelta(hours=2), races) is None
    assert refresh.race_target(start + timedelta(hours=4), races)["round"] == "18"
    assert refresh.race_target(start + timedelta(days=7, hours=4), races)["round"] == "19"
    assert refresh.race_target(start + timedelta(days=15), races) is None


def test_results_wait_for_classification(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(refresh, "ROOT", tmp_path)
    target = race(18, datetime(2026, 10, 25, 20, tzinfo=UTC))
    path = tmp_path / "data/curated/race_results.csv"
    write_csv(path, [{"race_id": target["id"], "driver_id": str(i)} for i in range(9)])
    assert not refresh.result_ready(target)
    write_csv(path, [{"race_id": target["id"], "driver_id": str(i)} for i in range(20)])
    assert refresh.result_ready(target)


def test_enriched_waits_for_all_current_race_surfaces(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(refresh, "ROOT", tmp_path)
    target = race(18, datetime(2026, 10, 25, 20, tzinfo=UTC))
    files = (
        ("data/canonical_sessions/sessions.csv", "session_code"),
        ("data/telemetry_features/telemetry_lap_summary.csv", "session"),
        ("data/analytics/analytics_session_index.csv", "session"),
        ("data/race_analysis/race_analysis_index.csv", None),
    )
    for name, code_key in files[:-1]:
        row = {"season": "2026", "round": "18"}
        if code_key:
            row[code_key] = "R"
        write_csv(tmp_path / name, [row])
    assert not refresh.enriched_ready(target)
    write_csv(tmp_path / files[-1][0], [{"season": "2026", "round": "18"}])
    assert refresh.enriched_ready(target)
    write_csv(tmp_path / files[1][0], [{"season": "2026", "round": "17", "session": "R"}])
    assert not refresh.enriched_ready(target)


def test_missing_race_telemetry_requests_retry(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(refresh, "ROOT", tmp_path)
    target = race(18, datetime(2026, 10, 25, 20, tzinfo=UTC))
    folder = tmp_path / "data/staged/sessions/2026/18_test-grand-prix/r"
    folder.mkdir(parents=True)
    (folder / "session_manifest.json").write_text(json.dumps({
        "status": "pending_openf1", "source_provider": "openf1"
    }))
    assert not refresh.race_telemetry_ready(target)
    (folder / "session_manifest.json").write_text(json.dumps({
        "status": "complete", "source_provider": "openf1"
    }))
    (folder / "telemetry.parquet").write_bytes(b"fixture")
    assert refresh.race_telemetry_ready(target)


def test_last_race_can_still_be_selected_after_finish() -> None:
    finish = datetime(2026, 12, 6, 13, tzinfo=UTC)
    final = race(23, finish)
    assert refresh.race_target(finish + timedelta(days=1), [final]) == final


def test_fallback_marks_season_complete_without_next_race() -> None:
    completed = {"id": "2026-23-test", "season": 2026, "round": 23}
    assert select_upcoming({"latest_completed_race": completed, "next_race": None}) == (completed, True)


def test_openf1_refresh_targets_only_the_completed_weekend() -> None:
    race_at = "2026-10-25T20:00:00Z"
    assert near_race({"date_start": "2026-10-23T17:30:00Z"}, race_at)
    assert near_race({"date_start": "2026-10-24T19:00:00Z"}, race_at)
    assert not near_race({"date_start": "2026-10-30T17:30:00Z"}, race_at)


def test_openf1_default_snapshot_includes_post_session_telemetry() -> None:
    assert "car_data" in DEFAULT_ENDPOINTS
    assert "location" in DEFAULT_ENDPOINTS


def test_openf1_telemetry_partitions_use_unique_driver_numbers() -> None:
    records = [{"driver_number": 44}, {"driver_number": "1"}, {"driver_number": 44}, {}]
    assert driver_numbers(records) == [1, 44]
