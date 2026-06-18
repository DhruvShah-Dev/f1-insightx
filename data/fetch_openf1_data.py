from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from f1_insightx_data.openf1 import OpenF1Client, write_records_csv
from f1_insightx_data.settings import load_settings


DEFAULT_ENDPOINTS = [
    "drivers",
    "session_result",
    "starting_grid",
    "weather",
    "laps",
    "stints",
    "pit",
    "race_control",
]
SESSION_TYPE_ALIASES = {
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
    "Q": "Qualifying",
    "SQ": "Sprint Qualifying",
    "S": "Sprint",
    "R": "Race",
}


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    current_year = datetime.now(tz=UTC).year
    parser = argparse.ArgumentParser(description="Fetch historical OpenF1 snapshots for F1 InsightX.")
    parser.add_argument("--start-season", type=int, default=2023, help="OpenF1 historical data starts in 2023.")
    parser.add_argument("--end-season", type=int, default=current_year)
    parser.add_argument(
        "--session-types",
        nargs="+",
        default=["Q", "R"],
        choices=sorted(SESSION_TYPE_ALIASES),
        help="Session types to snapshot.",
    )
    parser.add_argument(
        "--endpoints",
        nargs="+",
        default=DEFAULT_ENDPOINTS,
        help="OpenF1 session endpoints to fetch.",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Skip endpoint files that already exist.",
    )
    return parser.parse_args()


def session_code(session_name: str) -> str:
    for code, name in SESSION_TYPE_ALIASES.items():
        if session_name == name:
            return code
    return session_name.upper().replace(" ", "_")


def session_dir_for(base_dir: Path, session: dict[str, Any]) -> Path:
    year = int(session["year"])
    meeting_key = int(session["meeting_key"])
    key = int(session["session_key"])
    code = session_code(str(session["session_name"]))
    return base_dir / str(year) / f"{meeting_key}" / f"{key}_{code}"


def main() -> None:
    args = parse_args()
    settings = load_settings()
    fetched_at = datetime.now(tz=UTC).isoformat()
    allowed_session_names = {SESSION_TYPE_ALIASES[code] for code in args.session_types}

    client = OpenF1Client(settings.openf1_base_url)
    manifest_rows: list[dict[str, Any]] = []
    try:
        for season in range(max(2023, args.start_season), args.end_season + 1):
            season_raw_dir = settings.raw_openf1_dir / str(season)
            meetings = client.fetch_meetings(season)
            sessions = client.fetch_sessions(season=season)
            write_json(season_raw_dir / "meetings.json", meetings)
            write_json(season_raw_dir / "sessions.json", sessions)
            write_records_csv(meetings, settings.staged_openf1_dir / str(season) / "meetings.csv")
            write_records_csv(sessions, settings.staged_openf1_dir / str(season) / "sessions.csv")

            target_sessions = [
                session
                for session in sessions
                if str(session.get("session_name")) in allowed_session_names
            ]

            for session in target_sessions:
                raw_session_dir = session_dir_for(settings.raw_openf1_dir, session)
                staged_session_dir = session_dir_for(settings.staged_openf1_dir, session)
                write_json(raw_session_dir / "session.json", session)

                for endpoint in args.endpoints:
                    raw_path = raw_session_dir / f"{endpoint}.json"
                    staged_path = staged_session_dir / f"{endpoint}.csv"
                    if args.only_missing and raw_path.exists() and staged_path.exists():
                        status = "skipped_existing"
                        row_count = None
                    else:
                        try:
                            records = client.fetch_endpoint_for_session(endpoint, int(session["session_key"]))
                            write_json(raw_path, records)
                            write_records_csv(records, staged_path)
                            status = "fetched"
                            row_count = len(records)
                        except Exception as error:  # noqa: BLE001
                            status = f"failed: {error}"
                            row_count = None

                    manifest_rows.append(
                        {
                            "season": season,
                            "meeting_key": session.get("meeting_key"),
                            "meeting_name": session.get("meeting_name"),
                            "session_key": session.get("session_key"),
                            "session_name": session.get("session_name"),
                            "endpoint": endpoint,
                            "status": status,
                            "row_count": row_count,
                            "raw_path": raw_path.relative_to(settings.raw_openf1_dir).as_posix(),
                            "staged_path": staged_path.relative_to(settings.staged_openf1_dir).as_posix(),
                        }
                    )

        write_json(
            settings.raw_openf1_dir / "metadata.json",
            {
                "fetched_at": fetched_at,
                "start_season": max(2023, args.start_season),
                "end_season": args.end_season,
                "session_types": args.session_types,
                "endpoints": args.endpoints,
                "free_tier_note": "Historical data only; keep requests under 3 req/s and 30 req/min.",
            },
        )
        write_records_csv(manifest_rows, settings.staged_openf1_dir / "ingestion_manifest.csv")
    finally:
        client.close()


if __name__ == "__main__":
    main()
