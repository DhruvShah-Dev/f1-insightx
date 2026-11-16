from __future__ import annotations

import sys
import json
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))

from clean_openf1_sessions import clean_endpoint, endpoint_applicable
from fetch_openf1_data import write_raw_response
from f1_insightx_data.openf1 import OpenF1Client, OpenF1RateLimit
from build_canonical_sessions import selected_session_manifests


SESSION = {"session_key": 100, "meeting_key": 10}


def clean(endpoint: str, rows: list[dict[str, object]], tmp_path: Path):
    return clean_endpoint(
        endpoint,
        pd.DataFrame(rows),
        source_path=tmp_path / f"{endpoint}.json",
        session=SESSION,
        valid_drivers={1, 2},
    )


def test_mixed_iso_timestamps_are_normalized_to_utc(tmp_path: Path) -> None:
    rows = [
        {"meeting_key": 10, "session_key": 100, "driver_number": 1, "date": "2026-01-01T00:00:00Z", "speed": 1},
        {"meeting_key": 10, "session_key": 100, "driver_number": 1, "date": "2026-01-01T00:00:00.500Z", "speed": 2},
    ]
    output, rejected, stats = clean("car_data", rows, tmp_path)
    assert stats == {"raw": 2, "clean": 2, "duplicate": 0, "quarantined": 0}
    assert not rejected
    assert str(output["date"].dt.tz) == "UTC"


def test_conflicting_duplicate_keeps_most_complete_row(tmp_path: Path) -> None:
    rows = [
        {"meeting_key": 10, "session_key": 100, "driver_number": 1, "lap_number": 1, "lap_duration": 90.0},
        {"meeting_key": 10, "session_key": 100, "driver_number": 1, "lap_number": 1, "lap_duration": 89.0, "i1_speed": 300},
    ]
    output, rejected, stats = clean("laps", rows, tmp_path)
    assert output.iloc[0]["lap_duration"] == 89.0
    assert stats["duplicate"] == 1
    assert rejected[0].iloc[0]["rejection_reason"] == "duplicate_conflict"


def test_domain_and_cross_table_failures_are_quarantined(tmp_path: Path) -> None:
    rows = [
        {"meeting_key": 10, "session_key": 100, "driver_number": 1, "date": "2026-01-01T00:00:00Z", "throttle": 101},
        {"meeting_key": 10, "session_key": 100, "driver_number": 99, "date": "2026-01-01T00:00:01Z", "throttle": 50},
    ]
    output, rejected, stats = clean("car_data", rows, tmp_path)
    assert output.empty
    assert stats["quarantined"] == 2
    assert {group.iloc[0]["rejection_reason"] for group in rejected} == {"orphan_driver", "throttle_out_of_range"}


def test_session_type_applicability_avoids_false_failures() -> None:
    for endpoint in ("starting_grid", "pit", "intervals", "overtakes"):
        assert not endpoint_applicable(endpoint, "Practice 1")
        assert endpoint_applicable(endpoint, "Race")
    assert endpoint_applicable("weather", "Practice 1")


def test_openf1_rate_limit_defaults_match_provider_contract() -> None:
    limit = OpenF1RateLimit()
    assert limit.requests_per_second == 3
    assert limit.requests_per_minute == 30


def test_openf1_retries_transient_response() -> None:
    retry = Mock(status_code=429, headers={"Retry-After": "0"})
    retry.raise_for_status.side_effect = RuntimeError("rate limited")
    success = Mock(status_code=200, headers={})
    success.json.return_value = [{"session_key": 100}]
    client = OpenF1Client("https://example.test", max_retries=1)
    client._client = Mock()  # noqa: SLF001
    client._client.get.side_effect = [retry, success]
    with patch.object(client, "_throttle"), patch("f1_insightx_data.openf1.time.sleep"):
        assert client.fetch_sessions(season=2026) == [{"session_key": 100}]
    assert client._client.get.call_count == 2


def test_raw_response_is_preserved_byte_for_byte(tmp_path: Path) -> None:
    raw = b'[{"date":"2026-01-01T00:00:00Z", "speed":301}]\n'
    target = tmp_path / "raw" / "laps.json"
    write_raw_response(target, raw)
    assert target.read_bytes() == raw


def write_manifest(root: Path, season: int, round_number: int, provider: str, status: str = "complete") -> Path:
    path = root / str(season) / f"{round_number:02d}_race" / "r" / "session_manifest.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "season": season, "round": round_number, "session_code": "R",
        "event_name": "Test Grand Prix", "source_provider": provider,
        "source": provider, "status": status,
    }), encoding="utf-8")
    return path


def test_source_policy_boundaries_and_missing_legacy_fill(tmp_path: Path) -> None:
    legacy = tmp_path / "raw_fastf1"
    neutral = tmp_path / "sessions"
    pre_cutover = write_manifest(legacy, 2026, 17, "fastf1_legacy")
    write_manifest(legacy, 2026, 18, "fastf1_legacy")
    fill = write_manifest(neutral, 2025, 7, "openf1")
    cutover = write_manifest(neutral, 2026, 18, "openf1")
    write_manifest(neutral, 2022, 5, "openf1")
    settings = SimpleNamespace(raw_fastf1_dir=legacy, staged_sessions_dir=neutral)

    selected, skipped = selected_session_manifests(settings, 2020, 2026)

    assert set(selected) == {pre_cutover, fill, cutover}
    assert any(item["status"] == "outside_openf1_coverage" for item in skipped)
