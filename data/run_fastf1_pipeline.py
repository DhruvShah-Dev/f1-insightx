from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the FastF1 ingestion and feature pipeline.")
    parser.add_argument("--start-season", type=int, default=2024)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_dir = Path(__file__).resolve().parent

    commands = [
        [sys.executable, str(data_dir / "fastf1_ingest.py"), "--start-season", str(args.start_season), "--end-season", str(args.end_season)]
        + (["--force"] if args.force else []),
        [sys.executable, str(data_dir / "build_fastf1_features.py")],
        [sys.executable, str(data_dir / "build_fastf1_models.py")],
        [sys.executable, str(data_dir / "build_race_week_layers.py")],
        [sys.executable, str(data_dir / "build_strategy_lab_layers.py")],
        [sys.executable, str(data_dir / "build_fastf1_track_paths.py"), "--season-from", str(args.start_season)]
        + (["--force"] if args.force else []),
    ]

    for command in commands:
        subprocess.run(command, check=True)


if __name__ == "__main__":
    main()
