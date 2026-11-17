"""Fetch the remaining small OpenF1 2026 endpoints absent from the archive."""

from __future__ import annotations

import json
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from f1_insightx_data.openf1 import OpenF1Client, write_records_csv
from f1_insightx_data.settings import load_settings


ROOT = Path(__file__).resolve().parent
REPORT = ROOT / "reports" / "openf1_extras_2026_download.json"
CODES = {
    "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
    "Qualifying": "Q", "Sprint Qualifying": "SQ", "Sprint": "S", "Race": "R",
}


def main() -> None:
    settings = load_settings()
    now = datetime.now(UTC)
    sessions = json.loads((settings.raw_openf1_dir / "2026" / "sessions.json").read_text(encoding="utf-8"))
    records: list[dict[str, object]] = []
    client = OpenF1Client(settings.openf1_base_url)
    try:
        for session in sorted(sessions, key=lambda row: (row["date_start"], row["session_key"])):
            code = CODES.get(str(session.get("session_name")))
            if code is None:
                continue
            try:
                if datetime.fromisoformat(str(session["date_end"]).replace("Z", "+00:00")) > now:
                    continue
            except (KeyError, ValueError):
                continue
            folder = (Path("2026") / str(session["meeting_key"])
                      / f"{session['session_key']}_{code}")
            if not (settings.raw_openf1_dir / folder / "position.json").exists():
                continue
            endpoints = ["team_radio"]
            if code in {"R", "S"}:
                endpoints.extend(["championship_drivers", "championship_teams"])
            for endpoint in endpoints:
                raw = settings.raw_openf1_dir / folder / f"{endpoint}.json"
                staged = settings.staged_openf1_dir / folder / f"{endpoint}.csv"
                record: dict[str, object] = {"session_key": session["session_key"],
                                             "session": code, "endpoint": endpoint}
                if raw.exists():
                    record["status"] = "existing"
                    if not staged.exists():
                        write_records_csv(json.loads(raw.read_text(encoding="utf-8")), staged)
                else:
                    try:
                        rows, raw_bytes = client.fetch_endpoint_snapshot(
                            endpoint, int(session["session_key"])
                        )
                        raw.parent.mkdir(parents=True, exist_ok=True)
                        raw.write_bytes(raw_bytes)
                        write_records_csv(rows, staged)
                        record.update(status="downloaded", rows=len(rows))
                    except Exception as error:
                        record.update(status="unavailable" if "404" in str(error) else "failed",
                                      error=str(error).splitlines()[0])
                records.append(record)
                print(f"{session['session_key']}_{code} {endpoint}: {record['status']}", flush=True)
    finally:
        client.close()
        REPORT.write_text(json.dumps({"checked_at": now.isoformat(), "season": 2026,
                                      "counts": dict(Counter(str(row["status"]) for row in records)),
                                      "records": records}, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
