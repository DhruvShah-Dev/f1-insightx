from __future__ import annotations

import argparse

import pandas as pd

from f1_insightx_data.fastf1_pipeline import (
    SESSION_PREFERENCE,
    build_session_metadata_row,
    build_stint_frame,
    enable_fastf1_cache,
    normalize_lap_frame,
    session_summary_from_laps,
    slugify,
    write_frame,
    write_json,
)
from f1_insightx_data.settings import load_settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest FastF1 session data into raw and staged layers.")
    parser.add_argument("--start-season", type=int, default=2024)
    parser.add_argument("--end-season", type=int, default=2026)
    parser.add_argument(
        "--include-telemetry-sessions",
        nargs="*",
        default=[],
        help="Optional list of session codes to preserve as telemetry-ready cache targets.",
    )
    parser.add_argument("--force", action="store_true", help="Rebuild staged extracts even if manifest files exist.")
    return parser.parse_args()


def safe_event_field(event: pd.Series, field: str, fallback: object = "") -> object:
    if field in event.index:
        return event[field]
    return fallback


def try_load_session(session: object) -> None:
    load = getattr(session, "load")
    try:
        load(laps=True, telemetry=False, weather=True, messages=False)
    except TypeError:
        load()


def main() -> None:
    import fastf1

    args = parse_args()
    settings = load_settings()
    enable_fastf1_cache(settings)
    settings.raw_fastf1_dir.mkdir(parents=True, exist_ok=True)
    settings.staged_fastf1_dir.mkdir(parents=True, exist_ok=True)

    manifest_rows: list[dict[str, object]] = []

    for season in range(args.start_season, args.end_season + 1):
        schedule = fastf1.get_event_schedule(season, include_testing=False)
        write_frame(schedule.copy(), settings.raw_fastf1_dir / f"event_schedule_{season}.csv")

        for _, event in schedule.iterrows():
            round_number = int(safe_event_field(event, "RoundNumber", 0) or 0)
            if round_number <= 0:
                continue

            event_name = str(safe_event_field(event, "EventName", f"round-{round_number}"))
            event_slug = slugify(event_name)
            event_dir = settings.staged_fastf1_dir / str(season) / f"{round_number:02d}_{event_slug}"

            for session_code in SESSION_PREFERENCE:
                try:
                    session_name = event.get_session_name(session_code)
                    session = event.get_session(session_code)
                except Exception:
                    continue

                session_dir = event_dir / session_code.lower()
                manifest_path = session_dir / "session_manifest.json"
                if manifest_path.exists() and not args.force:
                    manifest_rows.append(
                        {
                            **build_session_metadata_row(event, session_code, session_name),
                            "status": "cached",
                            "session_dir": str(session_dir.relative_to(settings.staged_fastf1_dir)),
                        }
                    )
                    continue

                session_dir.mkdir(parents=True, exist_ok=True)

                try:
                    try_load_session(session)
                except Exception as error:  # noqa: BLE001
                    write_json(
                        manifest_path,
                        {
                            **build_session_metadata_row(event, session_code, session_name),
                            "status": "error",
                            "error": str(error),
                        },
                    )
                    manifest_rows.append(
                        {
                            **build_session_metadata_row(event, session_code, session_name),
                            "status": "error",
                            "session_dir": str(session_dir.relative_to(settings.staged_fastf1_dir)),
                        }
                    )
                    continue

                laps = normalize_lap_frame(
                    getattr(session, "laps", pd.DataFrame()),
                    season=season,
                    round_number=round_number,
                    event_name=event_name,
                    session_code=session_code,
                )
                stints = build_stint_frame(laps)
                session_summary = session_summary_from_laps(laps)

                results = getattr(session, "results", pd.DataFrame())
                weather = getattr(session, "weather_data", pd.DataFrame())

                write_frame(laps, session_dir / "laps.csv")
                write_frame(stints, session_dir / "stints.csv")
                write_frame(session_summary, session_dir / "session_summary.csv")

                if isinstance(results, pd.DataFrame) and not results.empty:
                    write_frame(results.reset_index(drop=True), session_dir / "results.csv")

                if isinstance(weather, pd.DataFrame) and not weather.empty:
                    write_frame(weather.reset_index(drop=True), session_dir / "weather.csv")

                write_json(
                    manifest_path,
                    {
                        **build_session_metadata_row(event, session_code, session_name),
                        "status": "ok",
                        "event_slug": event_slug,
                        "session_dir": str(session_dir.relative_to(settings.staged_fastf1_dir)),
                        "lap_rows": int(len(laps)),
                        "stint_rows": int(len(stints)),
                        "summary_rows": int(len(session_summary)),
                        "results_rows": int(len(results)) if isinstance(results, pd.DataFrame) else 0,
                        "weather_rows": int(len(weather)) if isinstance(weather, pd.DataFrame) else 0,
                        "telemetry_cache_ready": session_code in set(args.include_telemetry_sessions),
                    },
                )

                manifest_rows.append(
                    {
                        **build_session_metadata_row(event, session_code, session_name),
                        "status": "ok",
                        "session_dir": str(session_dir.relative_to(settings.staged_fastf1_dir)),
                    }
                )

    write_frame(pd.DataFrame(manifest_rows), settings.raw_fastf1_dir / "session_manifest_index.csv")


if __name__ == "__main__":
    main()
