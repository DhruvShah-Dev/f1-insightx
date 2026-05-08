from __future__ import annotations

import argparse
import json

from f1_insightx_data.fastf1_downloader import (
    DownloadOptions,
    normalize_requested_sessions,
    run_fastf1_download,
)
from f1_insightx_data.settings import load_settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download and stage FastF1 session data with cache-first, resumable behavior."
    )
    parser.add_argument("--start-season", type=int, default=2020)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument(
        "--include-telemetry",
        action="store_true",
        help="Also save fastest-lap telemetry and position data as parquet where available.",
    )
    parser.add_argument(
        "--sessions",
        nargs="*",
        default=list(("FP1", "FP2", "FP3", "Q", "SQ", "S", "R")),
        help="Session codes to target. Supports FP1 FP2 FP3 Q SQ SS S R.",
    )
    parser.add_argument(
        "--only-missing",
        action="store_true",
        help="Download only sessions that do not already have a complete manifest.",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Retry sessions currently marked failed or unavailable, up to --max-retries.",
    )
    parser.add_argument("--max-retries", type=int, default=3)
    parser.add_argument("--sleep-seconds", type=float, default=1.5)
    parser.add_argument("--dry-run", action="store_true", help="Plan the run without downloading or writing files.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download sessions even if they already have a complete manifest.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = load_settings()
    options = DownloadOptions(
        start_season=args.start_season,
        end_season=args.end_season,
        sessions=normalize_requested_sessions(args.sessions),
        include_telemetry=bool(args.include_telemetry),
        only_missing=bool(args.only_missing),
        retry_failed=bool(args.retry_failed),
        max_retries=max(1, int(args.max_retries)),
        sleep_seconds=max(0.0, float(args.sleep_seconds)),
        dry_run=bool(args.dry_run),
        force=bool(args.force),
    )
    summary = run_fastf1_download(settings, options)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
