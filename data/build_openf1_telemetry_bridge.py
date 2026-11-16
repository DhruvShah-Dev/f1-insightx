from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from f1_insightx_data.fastf1_pipeline import (
    SESSION_WEIGHTS,
    build_stint_frame,
    session_summary_from_laps,
)
from f1_insightx_data.settings import load_settings


SESSION_CODES = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint": "S",
    "Race": "R",
}
SOURCE_LABEL = "openf1_post_session_bridge_v1"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Normalize OpenF1 post-session data for the analytics pipeline.")
    parser.add_argument("--season", type=int, default=2026)
    selector = parser.add_mutually_exclusive_group(required=True)
    selector.add_argument("--meeting-key", nargs="+", type=int)
    selector.add_argument("--round", type=int, help="Resolve the OpenF1 meeting from the curated season/round.")
    return parser.parse_args()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def match_curated_race(races: pd.DataFrame, meeting: pd.Series, season: int) -> pd.DataFrame:
    season_races = races[races["season"].eq(season)]
    meeting_name = str(meeting.get("meeting_name") or "")
    exact = season_races[season_races["race_name"].eq(meeting_name)]
    if not exact.empty:
        return exact

    circuit_slug = slugify(str(meeting.get("circuit_short_name") or "")).replace("-", "_")
    if circuit_slug:
        race_circuits = season_races["circuit_id"].astype(str).map(
            lambda value: slugify(value).replace("-", "_")
        )
        by_circuit = season_races[race_circuits.eq(circuit_slug)]
        if len(by_circuit) == 1:
            return by_circuit

    meeting_date = pd.to_datetime(meeting.get("date_end"), utc=True, errors="coerce")
    if pd.notna(meeting_date):
        scheduled = pd.to_datetime(season_races["scheduled_at"], utc=True, errors="coerce")
        by_date = season_races[scheduled.dt.date.eq(meeting_date.date())]
        if len(by_date) == 1:
            return by_date
    return season_races.iloc[0:0]


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def write_json(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def driver_map(drivers: pd.DataFrame) -> pd.DataFrame:
    if drivers.empty:
        return pd.DataFrame(columns=["driver_number", "driver", "team", "full_name", "team_colour"])
    mapped = drivers.rename(
        columns={
            "name_acronym": "driver",
            "team_name": "team",
            "team_colour": "team_colour",
        }
    ).copy()
    mapped["driver_number"] = pd.to_numeric(mapped["driver_number"], errors="coerce").astype("Int64")
    return mapped[["driver_number", "driver", "team", "full_name", "broadcast_name", "team_colour"]].drop_duplicates(
        "driver_number"
    )


def annotate_laps(laps: pd.DataFrame, stints: pd.DataFrame) -> pd.DataFrame:
    result = laps.copy()
    result["stint"] = pd.NA
    result["compound"] = ""
    result["tyre_life"] = pd.NA
    result["fresh_tyre"] = False
    if stints.empty:
        return result

    for _, stint in stints.iterrows():
        mask = (
            result["driver_number"].eq(stint["driver_number"])
            & result["lap_number"].between(stint["lap_start"], stint["lap_end"], inclusive="both")
        )
        tyre_age = float(stint.get("tyre_age_at_start") or 0)
        result.loc[mask, "stint"] = stint["stint_number"]
        result.loc[mask, "compound"] = str(stint.get("compound") or "")
        result.loc[mask, "tyre_life"] = result.loc[mask, "lap_number"] - float(stint["lap_start"]) + tyre_age + 1
        result.loc[mask, "fresh_tyre"] = tyre_age == 0
    return result


def nearest_weather(laps: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    result = laps.copy()
    weather_columns = {
        "air_temperature": "air_temp_c",
        "track_temperature": "track_temp_c",
        "humidity": "humidity_pct",
        "rainfall": "rainfall",
        "wind_speed": "wind_speed_mps",
        "wind_direction": "wind_direction_deg",
    }
    if weather.empty or result.empty:
        for target in weather_columns.values():
            result[target] = pd.NA
        return result

    right = weather.rename(columns=weather_columns).copy()
    right["_date"] = pd.to_datetime(right["date"], utc=True, errors="coerce")
    left = result.copy()
    left["_date"] = pd.to_datetime(left["date_start"], utc=True, errors="coerce")
    left["_row_order"] = range(len(left))
    valid_left = left[left["_date"].notna()].sort_values("_date")
    invalid_left = left[left["_date"].isna()].copy()
    merged_valid = pd.merge_asof(
        valid_left,
        right[["_date", *weather_columns.values()]].dropna(subset=["_date"]).sort_values("_date"),
        on="_date",
        direction="nearest",
        tolerance=pd.Timedelta(minutes=5),
    )
    if invalid_left.empty:
        combined = merged_valid
    else:
        for target in weather_columns.values():
            invalid_left[target] = np.nan
        combined = pd.concat([merged_valid, invalid_left], ignore_index=True)
    return combined.sort_values("_row_order").drop(columns=["_date", "_row_order"]).reset_index(drop=True)


def normalize_laps(
    laps: pd.DataFrame,
    stints: pd.DataFrame,
    drivers: pd.DataFrame,
    weather: pd.DataFrame,
    *,
    season: int,
    round_number: int,
    event_name: str,
    session_code: str,
) -> pd.DataFrame:
    if laps.empty:
        return pd.DataFrame()
    frame = annotate_laps(laps, stints).merge(driver_map(drivers), on="driver_number", how="left")
    frame = nearest_weather(frame, weather)
    frame["lap_duration"] = pd.to_numeric(frame["lap_duration"], errors="coerce")
    sector_sum = frame[["duration_sector_1", "duration_sector_2", "duration_sector_3"]].apply(
        pd.to_numeric, errors="coerce"
    ).sum(axis=1, min_count=3)
    frame["is_accurate"] = (
        frame["lap_duration"].notna()
        & sector_sum.notna()
        & (frame["lap_duration"] - sector_sum).abs().le(0.25)
        & ~frame["is_pit_out_lap"].fillna(False).astype(bool)
    )
    frame["is_personal_best"] = frame["lap_duration"].eq(
        frame.groupby("driver_number")["lap_duration"].transform("min")
    )
    frame["top_speed"] = frame[["i1_speed", "i2_speed", "st_speed"]].apply(pd.to_numeric, errors="coerce").max(axis=1)
    output = pd.DataFrame(
        {
            "season": season,
            "round": round_number,
            "event_name": event_name,
            "session_code": session_code,
            "driver": frame["driver"],
            "team": frame["team"],
            "lap_number": frame["lap_number"],
            "stint": frame["stint"],
            "compound": frame["compound"],
            "tyre_life": frame["tyre_life"],
            "lap_time_s": frame["lap_duration"],
            "sector_1_s": frame["duration_sector_1"],
            "sector_2_s": frame["duration_sector_2"],
            "sector_3_s": frame["duration_sector_3"],
            "speed_i1": frame["i1_speed"],
            "speed_i2": frame["i2_speed"],
            "speed_fl": pd.NA,
            "speed_st": frame["st_speed"],
            "track_status": "",
            "fresh_tyre": frame["fresh_tyre"],
            "is_personal_best": frame["is_personal_best"],
            "is_accurate": frame["is_accurate"],
            "deleted": False,
            "lap_start_time": frame["date_start"],
            "position": pd.NA,
            "air_temp_c": frame["air_temp_c"],
            "track_temp_c": frame["track_temp_c"],
            "humidity_pct": frame["humidity_pct"],
            "rainfall": pd.to_numeric(frame["rainfall"], errors="coerce").fillna(0).astype(bool),
            "wind_speed_mps": frame["wind_speed_mps"],
            "wind_direction_deg": frame["wind_direction_deg"],
            "source_label": SOURCE_LABEL,
        }
    )
    return output.dropna(subset=["driver", "lap_number"]).reset_index(drop=True)


def normalize_weather(weather: pd.DataFrame, session_start: pd.Timestamp) -> pd.DataFrame:
    if weather.empty:
        return pd.DataFrame()
    date = pd.to_datetime(weather["date"], utc=True, errors="coerce")
    return pd.DataFrame(
        {
            "Time": date - session_start,
            "AirTemp": weather["air_temperature"],
            "TrackTemp": weather["track_temperature"],
            "Humidity": weather["humidity"],
            "Pressure": weather["pressure"],
            "Rainfall": weather["rainfall"].fillna(0).astype(bool),
            "WindDirection": weather["wind_direction"],
            "WindSpeed": weather["wind_speed"],
            "source_label": SOURCE_LABEL,
        }
    )


def normalize_results(results: pd.DataFrame, drivers: pd.DataFrame) -> pd.DataFrame:
    if results.empty:
        return pd.DataFrame()
    frame = results.merge(driver_map(drivers), on="driver_number", how="left")
    def optional(column: str, default: Any = pd.NA) -> pd.Series:
        return frame[column] if column in frame.columns else pd.Series(default, index=frame.index)

    status = np.where(
        optional("dns", False).fillna(False),
        "Did not start",
        np.where(optional("dnf", False).fillna(False), "Retired", "Finished"),
    )
    return pd.DataFrame(
        {
            "Position": frame["position"],
            "ClassifiedPosition": frame["position"],
            "DriverNumber": frame["driver_number"],
            "BroadcastName": frame["broadcast_name"],
            "Abbreviation": frame["driver"],
            "FullName": frame["full_name"],
            "TeamName": frame["team"],
            "TeamColor": frame["team_colour"],
            "GridPosition": pd.NA,
            "Q1": pd.NA,
            "Q2": pd.NA,
            "Q3": pd.NA,
            "Time": optional("duration"),
            "Status": status,
            "Points": optional("points"),
            "Laps": optional("number_of_laps"),
            "source_label": SOURCE_LABEL,
        }
    )


def integrated_distance(speed: pd.Series, timestamps: pd.Series) -> pd.Series:
    seconds = timestamps.diff().dt.total_seconds().clip(lower=0, upper=1).fillna(0)
    metres_per_second = pd.to_numeric(speed, errors="coerce").fillna(0).clip(lower=0) / 3.6
    incremental = ((metres_per_second + metres_per_second.shift(fill_value=metres_per_second.iloc[0])) / 2) * seconds
    return incremental.cumsum()


def fastest_lap_traces(
    car_data: pd.DataFrame,
    location: pd.DataFrame,
    laps: pd.DataFrame,
    drivers: pd.DataFrame,
    *,
    season: int,
    round_number: int,
    event_name: str,
    session_code: str,
    session_start: pd.Timestamp,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    if car_data.empty or laps.empty:
        return pd.DataFrame(), pd.DataFrame()
    mapping = driver_map(drivers).set_index("driver_number")
    lap_meta = laps.copy()
    lap_meta["lap_time_s"] = pd.to_numeric(lap_meta["lap_time_s"], errors="coerce")
    lap_meta["lap_start_time"] = pd.to_datetime(lap_meta["lap_start_time"], utc=True, errors="coerce")
    candidates = lap_meta[
        lap_meta["lap_time_s"].gt(0)
        & lap_meta["lap_start_time"].notna()
        & lap_meta["is_accurate"].fillna(False).astype(bool)
    ].sort_values(["driver", "lap_time_s"]).drop_duplicates("driver")
    car = car_data.copy()
    car["date"] = pd.to_datetime(car["date"], utc=True, errors="coerce")
    loc = location.copy()
    if not loc.empty:
        loc["date"] = pd.to_datetime(loc["date"], utc=True, errors="coerce")
    telemetry_frames: list[pd.DataFrame] = []
    position_frames: list[pd.DataFrame] = []
    for _, lap in candidates.iterrows():
        driver_number = int(mapping.index[mapping["driver"].eq(lap["driver"])][0])
        start = lap["lap_start_time"]
        end = start + pd.to_timedelta(float(lap["lap_time_s"]), unit="s")
        trace = car[
            car["driver_number"].eq(driver_number)
            & car["date"].between(start, end, inclusive="both")
            & car["throttle"].between(0, 100, inclusive="both")
            & car["brake"].between(0, 100, inclusive="both")
        ].sort_values("date").drop_duplicates("date")
        trace_gap = trace["date"].diff().dt.total_seconds().max()
        trace_coverage = (trace["date"].max() - trace["date"].min()).total_seconds() / float(lap["lap_time_s"])
        if len(trace) < 100 or trace_coverage < 0.8 or pd.isna(trace_gap) or trace_gap > 2:
            continue
        elapsed = trace["date"] - start
        distance = integrated_distance(trace["speed"], trace["date"])
        meta = {
            "driver": lap["driver"],
            "session_code": session_code,
            "race_name": event_name,
            "round": round_number,
            "season": season,
            "lap_number": int(lap["lap_number"]),
            "compound": lap.get("compound") or "",
            "tyre_life": int(lap["tyre_life"]) if pd.notna(lap.get("tyre_life")) else 0,
        }
        telemetry_frames.append(
            pd.DataFrame(
                {
                    **meta,
                    "Date": trace["date"].astype(str),
                    "SessionTime": trace["date"] - session_start,
                    "Time": elapsed,
                    "Distance": distance,
                    "Speed": trace["speed"],
                    "RPM": trace["rpm"],
                    "nGear": trace["n_gear"],
                    "Throttle": trace["throttle"],
                    "Brake": trace["brake"].gt(0),
                    "DRS": pd.to_numeric(trace["drs"], errors="coerce").fillna(0),
                    "source_valid": True,
                    "analytically_eligible": True,
                    "exclusion_reason": "",
                    "Source": "openf1_post_session",
                }
            )
        )
        driver_location = loc[
            loc["driver_number"].eq(driver_number)
            & loc["date"].between(start, end, inclusive="both")
            & ~((loc["x"] == 0) & (loc["y"] == 0) & (loc["z"] == 0))
        ].sort_values("date").drop_duplicates("date")
        location_gap = driver_location["date"].diff().dt.total_seconds().max()
        location_coverage = (
            (driver_location["date"].max() - driver_location["date"].min()).total_seconds()
            / float(lap["lap_time_s"])
            if not driver_location.empty else 0
        )
        if len(driver_location) < 50 or location_coverage < 0.7 or pd.isna(location_gap) or location_gap > 2:
            continue
        position_frames.append(
            pd.DataFrame(
                {
                    **{key: value for key, value in meta.items() if key != "compound" and key != "tyre_life"},
                    "Date": driver_location["date"].astype(str),
                    "SessionTime": driver_location["date"] - session_start,
                    "Time": driver_location["date"] - start,
                    "X": driver_location["x"],
                    "Y": driver_location["y"],
                    "Z": driver_location["z"],
                    "Status": "OnTrack",
                    "source_valid": True,
                    "analytically_eligible": True,
                    "exclusion_reason": "",
                    "Source": "openf1_post_session",
                }
            )
        )
    telemetry = pd.concat(telemetry_frames, ignore_index=True) if telemetry_frames else pd.DataFrame()
    position = pd.concat(position_frames, ignore_index=True) if position_frames else pd.DataFrame()
    if not telemetry.empty and not position.empty:
        merged: list[pd.DataFrame] = []
        for (driver, lap_number), trace in telemetry.groupby(["driver", "lap_number"], sort=False):
            locations = position[
                position["driver"].eq(driver) & position["lap_number"].eq(lap_number)
            ][["Date", "X", "Y", "Z"]].copy()
            left = trace.copy()
            left["_date"] = pd.to_datetime(left["Date"], utc=True, format="mixed")
            locations["_date"] = pd.to_datetime(locations["Date"], utc=True, format="mixed")
            merged.append(pd.merge_asof(
                left.sort_values("_date"), locations.drop(columns="Date").sort_values("_date"),
                on="_date", direction="nearest", tolerance=pd.Timedelta(milliseconds=500),
            ).drop(columns="_date"))
        telemetry = pd.concat(merged, ignore_index=True)
    return telemetry, position


def session_dirs(staged_openf1: Path, season: int, meeting_key: int) -> list[Path]:
    root = staged_openf1 / str(season) / str(meeting_key)
    return sorted(path for path in root.iterdir() if path.is_dir()) if root.exists() else []


def main() -> None:
    args = parse_args()
    settings = load_settings()
    meetings = read_csv(settings.staged_openf1_dir / str(args.season) / "meetings.csv")
    races = read_csv(settings.curated_dir / "races.csv")
    summary_rows: list[dict[str, Any]] = []

    meeting_keys = args.meeting_key or []
    if args.round is not None:
        race = races[(races["season"].eq(args.season)) & (races["round"].eq(args.round))]
        if race.empty:
            raise RuntimeError(f"No curated race matches {args.season} round {args.round}")
        race_name = str(race.iloc[0]["race_name"])
        match = meetings[meetings["meeting_name"].eq(race_name)]
        if match.empty:
            circuit_slug = slugify(str(race.iloc[0]["circuit_id"])).replace("-", "_")
            meeting_circuits = meetings["circuit_short_name"].astype(str).map(
                lambda value: slugify(value).replace("-", "_")
            )
            match = meetings[meeting_circuits.eq(circuit_slug)]
        if match.empty:
            race_date = pd.to_datetime(race.iloc[0]["scheduled_at"], utc=True, errors="coerce")
            meeting_dates = pd.to_datetime(meetings["date_end"], utc=True, errors="coerce")
            if pd.notna(race_date):
                match = meetings[meeting_dates.dt.date.eq(race_date.date())]
        if match.empty:
            raise RuntimeError(f"No OpenF1 meeting matches curated race {race_name}")
        meeting_keys = [int(match.iloc[0]["meeting_key"])]

    for meeting_key in meeting_keys:
        meeting = meetings[meetings["meeting_key"].eq(meeting_key)]
        if meeting.empty:
            raise RuntimeError(f"OpenF1 meeting {meeting_key} is unavailable")
        openf1_event_name = str(meeting.iloc[0]["meeting_name"])
        race = match_curated_race(races, meeting.iloc[0], args.season)
        if race.empty:
            raise RuntimeError(f"No curated race matches OpenF1 meeting {openf1_event_name}")
        event_name = str(race.iloc[0]["race_name"])
        round_number = int(race.iloc[0]["round"])
        round_slug = f"{round_number:02d}_{slugify(event_name)}"

        for source_dir in session_dirs(settings.staged_openf1_dir, args.season, meeting_key):
            session = json.loads((settings.raw_openf1_dir / str(args.season) / str(meeting_key) / source_dir.name / "session.json").read_text(encoding="utf-8"))
            session_code = SESSION_CODES.get(str(session["session_name"]))
            if not session_code:
                continue
            raw_dir = settings.raw_fastf1_dir / str(args.season) / round_slug / session_code
            staged_dir = settings.staged_fastf1_dir / str(args.season) / round_slug / session_code.lower()
            drivers = read_csv(source_dir / "drivers.csv")
            laps_source = read_csv(source_dir / "laps.csv")
            stints_source = read_csv(source_dir / "stints.csv")
            weather_source = read_csv(source_dir / "weather.csv")
            results_source = read_csv(source_dir / "session_result.csv")
            car_data = read_csv(source_dir / "car_data.csv")
            location = read_csv(source_dir / "location.csv")
            session_start = pd.Timestamp(session["date_start"])

            laps = normalize_laps(
                laps_source,
                stints_source,
                drivers,
                weather_source,
                season=args.season,
                round_number=round_number,
                event_name=event_name,
                session_code=session_code,
            )
            stints = build_stint_frame(laps.drop(columns=["source_label"], errors="ignore"))
            stints["source_label"] = SOURCE_LABEL
            session_summary = session_summary_from_laps(laps.drop(columns=["source_label"], errors="ignore"))
            session_summary["source_label"] = SOURCE_LABEL
            weather = normalize_weather(weather_source, session_start)
            results = normalize_results(results_source, drivers)
            telemetry, position = fastest_lap_traces(
                car_data,
                location,
                laps,
                drivers,
                season=args.season,
                round_number=round_number,
                event_name=event_name,
                session_code=session_code,
                session_start=session_start,
            )
            if laps.empty or telemetry.empty:
                raise RuntimeError(f"{event_name} {session_code} did not produce canonical laps and telemetry")

            for frame, filename in ((laps, "laps.csv"), (weather, "weather.csv"), (results, "results.csv")):
                write_csv(frame, raw_dir / filename)
                write_csv(frame, staged_dir / filename)
            write_csv(stints, staged_dir / "stints.csv")
            write_csv(session_summary, staged_dir / "session_summary.csv")
            telemetry.to_parquet(raw_dir / "telemetry.parquet", index=False)
            if not position.empty:
                position.to_parquet(raw_dir / "position.parquet", index=False)

            manifest = {
                "season": args.season,
                "round": round_number,
                "event_name": event_name,
                "event_format": "conventional",
                "session_code": session_code,
                "session_name": session["session_name"],
                "event_date": str(pd.Timestamp(session["date_start"]).date()),
                "country": session.get("country_name"),
                "location": session.get("location"),
                "status": "complete",
                "error": None,
                "telemetry_requested": True,
                "telemetry_available": True,
                "position_available": not position.empty,
                "source": SOURCE_LABEL,
                "row_counts": {
                    "results": len(results),
                    "laps": len(laps),
                    "weather": len(weather),
                    "stints": len(stints),
                    "telemetry_rows": len(telemetry),
                    "position_rows": len(position),
                },
            }
            write_json(manifest, raw_dir / "session_manifest.json")
            write_json(manifest, staged_dir / "session_manifest.json")
            summary_rows.append({"meeting_key": meeting_key, **manifest["row_counts"], "session_code": session_code})

    report = {
        "source": SOURCE_LABEL,
        "season": args.season,
        "meeting_keys": meeting_keys,
        "sessions": summary_rows,
        "sessions_processed": len(summary_rows),
        "validation_errors": [],
    }
    write_json(report, settings.raw_openf1_dir.parent.parent / "reports" / "openf1_telemetry_bridge_quality.json")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
