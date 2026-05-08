from __future__ import annotations

import argparse
import json

from f1_insightx_data.fastf1_downloader import normalize_requested_sessions, validate_fastf1_archive
from f1_insightx_data.settings import load_settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the FastF1 raw archive and summarize coverage.")
    parser.add_argument("--start-season", type=int, default=2020)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument(
        "--sessions",
        nargs="*",
        default=list(("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")),
        help="Session codes to validate. Supports FP1 FP2 FP3 Q SQ SS S R.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()
    summary = validate_fastf1_archive(
        settings,
        start_season=args.start_season,
        end_season=args.end_season,
        sessions=normalize_requested_sessions(args.sessions),
    )
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
