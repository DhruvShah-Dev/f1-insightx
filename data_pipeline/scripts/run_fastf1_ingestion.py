from __future__ import annotations

import argparse
import logging
import sys
from collections import Counter
from pathlib import Path


if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from data_pipeline.fastf1.config.settings import ensure_pipeline_directories, load_config
from data_pipeline.fastf1.extract.session_extractor import extract_session_datasets
from data_pipeline.fastf1.ingest.schedule import EventDescriptor, list_target_events
from data_pipeline.fastf1.ingest.session_loader import get_event_schedule
from data_pipeline.fastf1.storage.raw_store import save_loaded_session
from data_pipeline.fastf1.utils.logging import get_logger


class IngestionInterruptedError(RuntimeError):
    """Raised when the pipeline should stop cleanly and be resumed later."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run FastF1 raw historical ingestion.")
    parser.add_argument("--telemetry", action="store_true", help="Extract telemetry and position parquet outputs.")
    parser.add_argument("--write-mode", choices=["skip", "overwrite"], default=None)
    parser.add_argument("--verbosity", choices=["info", "debug"], default="info")

    subparsers = parser.add_subparsers(dest="command", required=True)

    session_parser = subparsers.add_parser("session", help="Ingest a single session.")
    session_parser.add_argument("--year", type=int, required=True)
    session_parser.add_argument("--race", required=True)
    session_parser.add_argument("--session", required=True)

    weekend_parser = subparsers.add_parser("weekend", help="Ingest a full race weekend.")
    weekend_parser.add_argument("--year", type=int, required=True)
    weekend_parser.add_argument("--race", required=True)

    season_parser = subparsers.add_parser("season", help="Ingest all completed events in one season.")
    season_parser.add_argument("--year", type=int, required=True)

    subparsers.add_parser("full-range", help="Ingest 2020 through the latest completed 2026 event.")

    return parser.parse_args()


def _log_level(verbosity: str) -> int:
    return logging.DEBUG if verbosity == "debug" else logging.INFO


def _logger(verbosity: str = "info"):
    config = load_config()
    ensure_pipeline_directories(config)
    return get_logger(log_file=config.logs_dir / "fastf1_ingestion.log", level=_log_level(verbosity))


def _is_rate_limit_error(error: Exception) -> bool:
    return error.__class__.__name__ == "RateLimitExceededError" or "500 calls/h" in str(error)


def ingest_session(
    *,
    year: int,
    race: str,
    session_name: str,
    include_telemetry: bool,
    write_mode: str | None,
    verbosity: str = "info",
) -> tuple[str, str | None]:
    config = load_config(write_mode=write_mode)
    ensure_pipeline_directories(config)
    logger = get_logger(log_file=config.logs_dir / "fastf1_ingestion.log", level=_log_level(verbosity))

    try:
        loaded = extract_session_datasets(
            year,
            race,
            session_name,
            config=config,
            include_telemetry=include_telemetry,
        )
        output_dir, status = save_loaded_session(loaded, config=config, write_mode=write_mode)
        logger.info(f"{year} {race} {session_name}: {status} -> {output_dir}")
        return status, None
    except Exception as error:  # noqa: BLE001
        if _is_rate_limit_error(error):
            logger.warning(
                f"{year} {race} {session_name}: rate limit reached; stop now and rerun later to resume from cache/raw outputs"
            )
            raise IngestionInterruptedError(str(error)) from error
        logger.error(f"{year} {race} {session_name}: failed -> {error}")
        return "failed", str(error)


def _event_for_named_race(year: int, race: str, *, write_mode: str | None) -> EventDescriptor:
    config = load_config(write_mode=write_mode)
    schedule = get_event_schedule(year)
    target_events = list_target_events(schedule, year=year, config=config)
    for event in target_events:
        if event.event_name.lower() == race.lower() or event.official_event_name.lower() == race.lower():
            return event
    raise ValueError(f"Completed event not found in schedule: {year} {race}")


def ingest_event(
    event: EventDescriptor,
    *,
    include_telemetry: bool,
    write_mode: str | None,
    verbosity: str = "info",
) -> Counter:
    logger = _logger(verbosity)
    summary: Counter = Counter()

    logger.info(f"Ingesting event: {event.year} round {event.round_number} {event.event_name}")
    summary["events_seen"] += 1
    for _, session_name in event.sessions:
        try:
            status, _ = ingest_session(
                year=event.year,
                race=event.event_name,
                session_name=session_name,
                include_telemetry=include_telemetry,
                write_mode=write_mode,
                verbosity=verbosity,
            )
        except IngestionInterruptedError:
            summary["interrupted"] += 1
            raise
        if status == "written":
            summary["sessions_written"] += 1
        elif status == "skipped":
            summary["sessions_skipped"] += 1
        else:
            summary["sessions_failed"] += 1
    return summary


def ingest_season(
    *,
    year: int,
    include_telemetry: bool,
    write_mode: str | None,
    verbosity: str = "info",
) -> Counter:
    config = load_config(write_mode=write_mode)
    ensure_pipeline_directories(config)
    logger = get_logger(log_file=config.logs_dir / "fastf1_ingestion.log", level=_log_level(verbosity))

    try:
        schedule = get_event_schedule(year)
    except Exception as error:  # noqa: BLE001
        if _is_rate_limit_error(error):
            logger.warning(
                f"{year}: rate limit reached while fetching schedule; stop now and rerun later to resume"
            )
            summary = Counter()
            summary["interrupted"] += 1
            raise IngestionInterruptedError(str(error)) from error
        raise
    target_events = list_target_events(schedule, year=year, config=config)
    seen_rounds = {event.round_number for event in target_events}

    summary: Counter = Counter()
    for _, row in schedule.iterrows():
        round_number = int(row.get("RoundNumber", 0) or 0)
        if round_number > 0 and round_number not in seen_rounds:
            logger.info(f"Skipping future or unavailable event: {year} round {round_number} {row.get('EventName', '')}")
            summary["events_skipped"] += 1

    for event in target_events:
        summary.update(
            ingest_event(
                event,
                include_telemetry=include_telemetry,
                write_mode=write_mode,
                verbosity=verbosity,
            )
        )
    return summary


def ingest_full_range(*, include_telemetry: bool, write_mode: str | None, verbosity: str = "info") -> Counter:
    config = load_config(write_mode=write_mode)
    summary: Counter = Counter()
    for year in range(config.start_year, config.end_year + 1):
        try:
            summary.update(
                ingest_season(
                    year=year,
                    include_telemetry=include_telemetry,
                    write_mode=write_mode,
                    verbosity=verbosity,
                )
            )
        except IngestionInterruptedError:
            summary["interrupted"] += 1
            break
    return summary


def main() -> None:
    args = parse_args()
    logger = _logger(args.verbosity)

    if args.command == "session":
        try:
            status, error = ingest_session(
                year=args.year,
                race=args.race,
                session_name=args.session,
                include_telemetry=args.telemetry,
                write_mode=args.write_mode,
                verbosity=args.verbosity,
            )
            logger.info(f"Session summary: status={status} error={error or 'none'}")
        except IngestionInterruptedError as error:
            logger.warning(f"Session summary: interrupted due to rate limit -> {error}")
        return

    if args.command == "weekend":
        try:
            event = _event_for_named_race(args.year, args.race, write_mode=args.write_mode)
            summary = ingest_event(
                event,
                include_telemetry=args.telemetry,
                write_mode=args.write_mode,
                verbosity=args.verbosity,
            )
        except IngestionInterruptedError as error:
            logger.warning(f"Weekend summary: interrupted due to rate limit -> {error}")
            return
        logger.info(f"Weekend summary: {dict(summary)}")
        return

    if args.command == "season":
        try:
            summary = ingest_season(
                year=args.year,
                include_telemetry=args.telemetry,
                write_mode=args.write_mode,
                verbosity=args.verbosity,
            )
        except IngestionInterruptedError as error:
            logger.warning(f"Season summary: interrupted due to rate limit -> {error}")
            return
        logger.info(f"Season summary: {dict(summary)}")
        return

    summary = ingest_full_range(
        include_telemetry=args.telemetry,
        write_mode=args.write_mode,
        verbosity=args.verbosity,
    )
    if summary.get("interrupted", 0):
        logger.warning(
            "Full-range summary: interrupted by FastF1 rate limit. Re-run the same command later; existing outputs will be skipped."
        )
    logger.info(f"Full-range summary: {dict(summary)}")


if __name__ == "__main__":
    main()
