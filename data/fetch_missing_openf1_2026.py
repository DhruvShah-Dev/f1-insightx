"""Fill missing completed 2026 OpenF1 session snapshots without overwriting raw files.

Downloads the report-scale endpoints. High-frequency car_data and location are
separate because they require driver-partitioned requests and much more storage.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from f1_insightx_data.openf1 import OpenF1Client, write_records_csv
from f1_insightx_data.settings import load_settings


ENDPOINTS = (
    "drivers", "session_result", "starting_grid", "weather", "laps",
    "stints", "pit", "race_control", "position", "intervals", "overtakes",
)
RACE_ONLY = {"starting_grid", "pit", "intervals", "overtakes"}
SESSION_CODES = {
    "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
    "Qualifying": "Q", "Sprint Qualifying": "SQ", "Sprint": "S", "Race": "R",
}
REPORT = Path(__file__).resolve().parent / "reports" / "openf1_missing_2026_download.json"


def completed(session: dict[str, object], now: datetime) -> bool:
    if session.get("session_name") not in SESSION_CODES:
        return False
    try:
        return datetime.fromisoformat(str(session["date_end"]).replace("Z", "+00:00")) <= now
    except (KeyError, ValueError):
        return False


def main() -> None:
    settings = load_settings()
    now = datetime.now(UTC)
    client = OpenF1Client(settings.openf1_base_url)
    records: list[dict[str, object]] = []
    try:
        sessions = client.fetch_sessions(season=2026)
        targets = sorted((s for s in sessions if completed(s, now)), key=lambda s: (s["date_start"], s["session_key"]))
        for session in targets:
            code = SESSION_CODES[str(session["session_name"])]
            key = int(session["session_key"])
            folder = Path("2026") / str(session["meeting_key"]) / f"{key}_{code}"
            for endpoint in ENDPOINTS:
                if endpoint in RACE_ONLY and code not in {"R", "S"}:
                    continue
                raw = settings.raw_openf1_dir / folder / f"{endpoint}.json"
                staged = settings.staged_openf1_dir / folder / f"{endpoint}.csv"
                if raw.exists():
                    if not staged.exists():
                        try:
                            existing = json.loads(raw.read_text(encoding="utf-8"))
                            if isinstance(existing, list):
                                write_records_csv(existing, staged)
                        except (OSError, ValueError):
                            pass
                    continue
                try:
                    payload, raw_bytes = client.fetch_endpoint_snapshot(endpoint, key)
                    raw.parent.mkdir(parents=True, exist_ok=True)
                    raw.write_bytes(raw_bytes)
                    write_records_csv(payload, staged)
                    record = {"session_key": key, "meeting_key": session["meeting_key"], "session": code,
                              "endpoint": endpoint, "status": "downloaded", "rows": len(payload),
                              "raw_path": raw.relative_to(settings.raw_openf1_dir).as_posix()}
                except Exception as error:  # Keep later sessions moving; report every gap.
                    status = "unavailable" if "404" in str(error) else "failed"
                    record = {"session_key": key, "meeting_key": session["meeting_key"], "session": code,
                              "endpoint": endpoint, "status": status, "error": str(error).splitlines()[0]}
                records.append(record)
                print(f"{key}_{code} {endpoint}: {record['status']} {record.get('rows', '')}", flush=True)
    finally:
        client.close()
        counts = Counter(str(row["status"]) for row in records)
        REPORT.write_text(json.dumps({"checked_at": now.isoformat(), "season": 2026,
                                      "counts": counts, "records": records}, indent=2), encoding="utf-8")
        print(f"Summary: {dict(counts)}", flush=True)


if __name__ == "__main__":
    main()
