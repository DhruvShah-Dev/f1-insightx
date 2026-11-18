"""Report local 2026 OpenF1 source and normalized-session coverage."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw" / "openf1" / "2026"
STAGED = ROOT / "staged" / "openf1" / "2026"
NEUTRAL = ROOT / "staged" / "sessions" / "2026"
REPORT = ROOT / "reports" / "openf1_2026_session_audit.json"
CODES = {"Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3", "Qualifying": "Q", "Sprint Qualifying": "SQ", "Sprint": "S", "Race": "R"}
FEEDS = ("drivers", "laps", "session_result", "weather", "stints", "position", "intervals", "overtakes", "race_control", "pit", "car_data", "location", "team_radio", "championship_drivers", "championship_teams", "starting_grid")


def main() -> None:
    sessions = json.loads((RAW / "sessions.json").read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    neutral_by_key = {}
    for path in NEUTRAL.glob("*/*/session_manifest.json"):
        item = json.loads(path.read_text(encoding="utf-8"))
        if item.get("source_session_key"):
            neutral_by_key[int(item["source_session_key"])] = item
    records = []
    for session in sorted(sessions, key=lambda s: (s["date_start"], s["session_key"])):
        code = CODES.get(session.get("session_name"))
        if not code or session.get("is_cancelled"):
            continue
        key = int(session["session_key"])
        folder = STAGED / str(session["meeting_key"]) / f"{key}_{code}"
        finished = datetime.fromisoformat(session["date_end"].replace("Z", "+00:00")) <= now
        feeds = {name: (folder / f"{name}.csv").exists() and (folder / f"{name}.csv").stat().st_size > 20 for name in FEEDS}
        neutral = neutral_by_key.get(key)
        records.append({"session_key": key, "meeting_key": int(session["meeting_key"]), "session": code, "completed": finished, "feeds": feeds, "neutral_status": neutral.get("status") if neutral else "not_built"})
    completed = [r for r in records if r["completed"]]
    competition_feeds = {"intervals", "overtakes", "starting_grid", "championship_drivers", "championship_teams"}
    report = {"checked_at": now.replace(microsecond=0).isoformat(), "season": 2026, "sessions_total": len(records), "sessions_completed": len(completed), "neutral_status_counts": dict(Counter(r["neutral_status"] for r in completed)), "completed_feed_counts": {name: sum(r["feeds"][name] for r in completed) for name in FEEDS}, "applicable_session_counts": {name: sum(r["session"] in {"R", "S"} if name in competition_feeds else True for r in completed) for name in FEEDS}, "records": records}
    report["status"] = "passed" if report["neutral_status_counts"] == {"complete": len(completed)} else "incomplete"
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    cleaning_report = {"schema_version": 2, "source_provider": "openf1", "season": 2026, "sessions_processed": len(completed), "complete": report["neutral_status_counts"].get("complete", 0), "pending": len(completed) - report["neutral_status_counts"].get("complete", 0), "sessions": [neutral_by_key[r["session_key"]] for r in completed if r["session_key"] in neutral_by_key]}
    (ROOT / "reports" / "openf1_cleaning_quality.json").write_text(json.dumps(cleaning_report, indent=2), encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("sessions_total", "sessions_completed", "neutral_status_counts", "completed_feed_counts")}, indent=2))


if __name__ == "__main__":
    main()
