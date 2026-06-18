from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SEASON_STATE_PATH = ROOT / "data" / "season_state.json"
DEFAULT_SESSIONS = ("FP1", "FP2", "FP3", "Q")
SUPPORTED_SESSIONS = ("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Refresh completed sessions for the current Race Week product view.",
    )
    parser.add_argument(
        "--sessions",
        nargs="*",
        default=list(DEFAULT_SESSIONS),
        choices=SUPPORTED_SESSIONS,
        help="FastF1 session codes to target. Defaults to FP1 FP2 FP3 Q.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Plan FastF1 ingestion without writing data or rebuilding views.")
    parser.add_argument("--retry-failed", action="store_true", help="Retry previously failed or unavailable sessions.")
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--sleep-seconds", type=float, default=1.5)
    parser.add_argument("--completion-buffer-minutes", type=int, default=30)
    return parser.parse_args()


def load_current_race_week() -> dict[str, Any]:
    if not SEASON_STATE_PATH.exists():
        raise SystemExit("data/season_state.json is missing; build season state before refreshing sessions.")

    state = json.loads(SEASON_STATE_PATH.read_text(encoding="utf-8"))
    race = state.get("current_race_week", {}).get("race")
    if not isinstance(race, dict):
        raise SystemExit("season_state.current_race_week.race is missing.")
    season = race.get("season")
    round_number = race.get("round")
    race_id = race.get("id")
    if not isinstance(season, int) or not isinstance(round_number, int) or not race_id:
        raise SystemExit("current race week has invalid season, round, or id.")
    return race


def run_command(command: list[str]) -> dict[str, Any]:
    completed = subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    result: dict[str, Any] = {
        "command": command,
        "returncode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }
    try:
        result["json"] = json.loads(completed.stdout)
    except json.JSONDecodeError:
        pass
    if completed.returncode != 0:
        print(f"Command failed with exit code {completed.returncode}: {' '.join(command)}", file=sys.stderr)
        if result["stdout"]:
            print("\n--- stdout ---", file=sys.stderr)
            print(result["stdout"], file=sys.stderr)
        if result["stderr"]:
            print("\n--- stderr ---", file=sys.stderr)
            print(result["stderr"], file=sys.stderr)
        raise SystemExit(completed.returncode)
    return result


def main() -> None:
    args = parse_args()
    race = load_current_race_week()
    season = int(race["season"])
    round_number = int(race["round"])
    sessions = tuple(args.sessions or DEFAULT_SESSIONS)

    ingest_command = [
        sys.executable,
        "data/fastf1_ingest.py",
        "--season",
        str(season),
        "--round",
        str(round_number),
        "--sessions",
        *sessions,
        "--only-missing",
        "--sleep-seconds",
        str(max(0.0, float(args.sleep_seconds))),
        "--max-retries",
        str(max(1, int(args.max_retries))),
        "--completion-buffer-minutes",
        str(max(0, int(args.completion_buffer_minutes))),
    ]
    if args.retry_failed:
        ingest_command.append("--retry-failed")
    if args.dry_run:
        ingest_command.append("--dry-run")

    steps = [run_command(ingest_command)]
    ingestion_summary = steps[0].get("json", {})
    run_summary = ingestion_summary.get("run", {}) if isinstance(ingestion_summary, dict) else {}

    if not args.dry_run:
        for command in [
            [sys.executable, "data/build_race_week_layers.py"],
            [sys.executable, "build_product_manifest.py"],
            [sys.executable, "build_season_state.py"],
        ]:
            steps.append(run_command(command))

    summary = {
        "race": {
            "id": race.get("id"),
            "season": season,
            "round": round_number,
            "race_name": race.get("race_name"),
        },
        "sessions": list(sessions),
        "dry_run": bool(args.dry_run),
        "ingestion": {
            "target_sessions": ingestion_summary.get("target_sessions") if isinstance(ingestion_summary, dict) else None,
            "planned": run_summary.get("planned"),
            "written": run_summary.get("written"),
            "skipped": run_summary.get("skipped"),
            "failed": run_summary.get("failed"),
            "rate_limited": run_summary.get("rate_limited"),
        },
        "steps": steps,
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
