from __future__ import annotations

from datetime import UTC, datetime

from data.race_week_refresh_gate import evaluate_refresh_window


RACES = [
    {
        "id": "2026-10-silverstone",
        "season": "2026",
        "round": "10",
        "race_name": "British Grand Prix",
        "scheduled_at": "2026-07-05T14:00:00Z",
    }
]


def at(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def test_gate_skips_non_race_weekend() -> None:
    result = evaluate_refresh_window(RACES, at("2026-06-27T12:00:00Z"))

    assert result["refresh"] is False
    assert result["post_race_catchup"] is False


def test_gate_refreshes_from_thursday_before_race() -> None:
    result = evaluate_refresh_window(RACES, at("2026-07-02T00:00:00Z"))

    assert result["refresh"] is True
    assert result["race"]["id"] == "2026-10-silverstone"
    assert result["post_race_catchup"] is False


def test_gate_keeps_sunday_race_target_after_race_start() -> None:
    result = evaluate_refresh_window(RACES, at("2026-07-05T16:30:00Z"))

    assert result["refresh"] is True
    assert result["race"]["round"] == 10
    assert result["post_race_catchup"] is False


def test_gate_skips_tuesday_after_race() -> None:
    result = evaluate_refresh_window(RACES, at("2026-07-07T00:00:00Z"))

    assert result["refresh"] is False
    assert result["post_race_catchup"] is False


def test_gate_marks_monday_post_race_catchup() -> None:
    result = evaluate_refresh_window(RACES, at("2026-07-06T06:00:00Z"))

    assert result["refresh"] is True
    assert result["post_race_catchup"] is True
