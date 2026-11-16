"""Run the provider-neutral OpenF1 session and product pipeline."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch, clean, and build OpenF1 session products.")
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--round", type=int, dest="round_number")
    parser.add_argument("--race-date")
    parser.add_argument("--sessions", nargs="+", default=["FP1", "FP2", "FP3", "Q", "SQ", "S", "R"])
    parser.add_argument("--only-missing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def run(*args: str) -> None:
    subprocess.run([sys.executable, *args], cwd=ROOT, check=True)


def main() -> None:
    args = parse_args()
    fetch = [
        "data/fetch_openf1_data.py", "--start-season", str(args.season), "--end-season", str(args.season),
        "--session-types", *args.sessions,
    ]
    if args.race_date:
        fetch += ["--race-date", args.race_date]
    if args.only_missing:
        fetch.append("--only-missing")
    if args.dry_run:
        print("Would run:", sys.executable, *fetch)
        return
    run(*fetch)
    clean = ["data/clean_openf1_sessions.py", "--season", str(args.season)]
    if args.round_number:
        clean += ["--round", str(args.round_number)]
    run(*clean)
    run("data/build_openf1_quality_report.py")
    run("validate_openf1_quality.py")
    run("build_canonical_sessions.py", "--start-season", "2020", "--end-season", str(args.season))
    run("validate_canonical_sessions.py")
    run("build_session_telemetry_features.py", "--start-season", "2020", "--end-season", str(args.season))
    run("validate_telemetry_features.py")
    run("data/build_session_features.py")
    run("data/build_session_models.py")


if __name__ == "__main__":
    main()
