from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.fastf1_pipeline import staged_session_directories, write_frame
from f1_insightx_data.settings import load_settings


CURRENT_DRIVER_CODE_ALIASES = {
    "ALB": "albon",
    "ALO": "alonso",
    "ANT": "antonelli",
    "BEA": "bearman",
    "BOR": "bortoleto",
    "BOT": "bottas",
    "COL": "colapinto",
    "GAS": "gasly",
    "HAD": "hadjar",
    "HAM": "hamilton",
    "HUL": "hulkenberg",
    "LAW": "lawson",
    "LEC": "leclerc",
    "LIN": "arvid_lindblad",
    "NOR": "norris",
    "OCO": "ocon",
    "PER": "perez",
    "PIA": "piastri",
    "RUS": "russell",
    "SAI": "sainz",
    "STR": "stroll",
    "VER": "max_verstappen",
}

CURRENT_CONSTRUCTOR_ALIASES = {
    "Alpine": "alpine",
    "Alpine F1 Team": "alpine",
    "Aston Martin": "aston_martin",
    "Aston Martin Aramco": "aston_martin",
    "Audi": "audi",
    "Cadillac": "cadillac",
    "Cadillac F1 Team": "cadillac",
    "Ferrari": "ferrari",
    "Haas F1 Team": "haas",
    "McLaren": "mclaren",
    "McLaren Formula 1 Team": "mclaren",
    "Mercedes": "mercedes",
    "Mercedes-AMG Petronas F1 Team": "mercedes",
    "Racing Bulls": "rb",
    "RB F1 Team": "rb",
    "Red Bull Racing": "red_bull",
    "Oracle Red Bull Racing": "red_bull",
    "Williams": "williams",
    "Atlassian Williams Racing": "williams",
}

CURRENT_DRIVER_CONSTRUCTOR_ALIASES = {
    "albon": "williams",
    "alonso": "aston_martin",
    "antonelli": "mercedes",
    "bearman": "haas",
    "bortoleto": "audi",
    "bottas": "cadillac",
    "colapinto": "alpine",
    "gasly": "alpine",
    "hadjar": "red_bull",
    "hamilton": "ferrari",
    "hulkenberg": "audi",
    "lawson": "rb",
    "leclerc": "ferrari",
    "arvid_lindblad": "rb",
    "norris": "mclaren",
    "ocon": "haas",
    "perez": "cadillac",
    "piastri": "mclaren",
    "russell": "mercedes",
    "sainz": "williams",
    "stroll": "aston_martin",
    "max_verstappen": "red_bull",
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path)


def normalize_key(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return (
        str(value)
        .strip()
        .lower()
        .replace("&", "and")
        .replace("-", "_")
        .replace(" ", "_")
    )


def pick_first(row: pd.Series, candidates: list[str]) -> Any:
    for candidate in candidates:
        if candidate in row.index and pd.notna(row[candidate]) and str(row[candidate]).strip() != "":
            return row[candidate]
    return None


def optional_series(frame: pd.DataFrame, column: str, default: Any = pd.NA) -> pd.Series:
    if column in frame.columns:
        return frame[column]
    return pd.Series(default, index=frame.index)


def driver_lookup_map(drivers: pd.DataFrame) -> dict[str, str]:
    lookup: dict[str, str] = {}
    if not drivers.empty:
        for _, row in drivers.iterrows():
            driver_id = str(row["id"])
            values = {
                driver_id,
                normalize_key(row.get("driver_code")),
                normalize_key(row.get("full_name")),
                normalize_key(row.get("first_name")),
                normalize_key(row.get("last_name")),
            }
            last_name = normalize_key(row.get("last_name"))
            if last_name:
                values.add(last_name)
            for value in values:
                if value:
                    lookup[value] = driver_id
                    lookup[value.upper()] = driver_id

    for driver_code, driver_id in CURRENT_DRIVER_CODE_ALIASES.items():
        lookup[driver_code] = driver_id
        lookup[driver_code.lower()] = driver_id
        lookup[normalize_key(driver_code)] = driver_id
    return lookup


def constructor_lookup_map(constructors: pd.DataFrame) -> dict[str, str]:
    lookup: dict[str, str] = {}
    aliases = {
        "red_bull_racing": "red_bull",
        "oracle_red_bull_racing": "red_bull",
        "visa_cash_app_racing_bulls": "rb",
        "racing_bulls": "rb",
        "rb_f1_team": "rb",
        "stake_f1_team_kick_sauber": "sauber",
        "alpine_f1_team": "alpine",
        "aston_martin_aramco": "aston_martin",
        "mercedes_amg_petronas_f1_team": "mercedes",
        "mclaren_formula_1_team": "mclaren",
        "scuderia_ferrari": "ferrari",
        "atlassian_williams_racing": "williams",
    }

    if not constructors.empty:
        for _, row in constructors.iterrows():
            constructor_id = str(row["id"])
            values = {
                constructor_id,
                normalize_key(row.get("constructor_code")),
                normalize_key(row.get("name")),
            }
            for value in list(values):
                if value in aliases:
                    values.add(aliases[value])
            for value in values:
                if value:
                    lookup[value] = constructor_id
                    lookup[value.upper()] = constructor_id

    for constructor_name, constructor_id in CURRENT_CONSTRUCTOR_ALIASES.items():
        lookup[constructor_name] = constructor_id
        lookup[normalize_key(constructor_name)] = constructor_id
        lookup[constructor_name.upper()] = constructor_id
    return lookup


def resolve_driver_id(value: Any, lookup: dict[str, str]) -> str | None:
    raw = str(value).strip() if value is not None and not pd.isna(value) else ""
    if not raw:
        return None
    return lookup.get(raw) or lookup.get(normalize_key(raw)) or lookup.get(raw.upper()) or None


def resolve_constructor_id(value: Any, lookup: dict[str, str]) -> str | None:
    raw = str(value).strip() if value is not None and not pd.isna(value) else ""
    if not raw:
        return None
    return lookup.get(raw) or lookup.get(normalize_key(raw)) or lookup.get(raw.upper()) or None


def fallback_constructor_for_driver(driver_id: str | None) -> str | None:
    if not driver_id:
        return None
    return CURRENT_DRIVER_CONSTRUCTOR_ALIASES.get(str(driver_id))


def normalize_feature_ids(
    frame: pd.DataFrame,
    *,
    driver_column: str | None,
    constructor_column: str | None,
    driver_lookup: dict[str, str],
    constructor_lookup: dict[str, str],
) -> pd.DataFrame:
    if frame.empty:
        return frame
    normalized = frame.copy()
    if driver_column and driver_column in normalized.columns:
        normalized[driver_column] = normalized[driver_column].apply(
            lambda value: resolve_driver_id(value, driver_lookup) or normalize_key(value)
        )
    if constructor_column and constructor_column in normalized.columns:
        normalized[constructor_column] = normalized[constructor_column].apply(
            lambda value: resolve_constructor_id(value, constructor_lookup) or normalize_key(value)
        )
    return normalized


def race_lookup_map(races: pd.DataFrame) -> dict[tuple[int, int], str]:
    if races.empty:
        return {}
    return {
        (int(row["season"]), int(row["round"])): str(row["id"])
        for _, row in races.iterrows()
    }


def infer_session_context(session_dir: Path, frames: list[pd.DataFrame]) -> tuple[int | None, int | None, str | None]:
    manifest_path = session_dir / "session_manifest.json"
    if manifest_path.exists():
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        return int(payload.get("season") or 0), int(payload.get("round") or 0), payload.get("event_name")

    for frame in frames:
        if frame.empty:
            continue
        season = frame.get("season")
        round_number = frame.get("round")
        event_name = frame.get("event_name")
        if season is not None and round_number is not None and event_name is not None:
            return int(frame["season"].iloc[0]), int(frame["round"].iloc[0]), str(frame["event_name"].iloc[0])

    return None, None, None


def build_canonical_session_layer(
    settings,
    *,
    races: pd.DataFrame,
    driver_lookup: dict[str, str],
    constructor_lookup: dict[str, str],
) -> dict[str, pd.DataFrame]:
    race_lookup = race_lookup_map(races)
    sessions_rows: list[dict[str, Any]] = []
    entry_rows: list[dict[str, Any]] = []
    result_rows: list[dict[str, Any]] = []
    lap_rows: list[dict[str, Any]] = []
    stint_rows: list[dict[str, Any]] = []
    weather_rows: list[dict[str, Any]] = []
    pace_rows: list[dict[str, Any]] = []

    seen_sessions: set[str] = set()
    seen_entries: set[str] = set()

    for session_dir in staged_session_directories(settings):
        session_code = session_dir.name.upper()
        summary = read_csv(session_dir / "session_summary.csv")
        laps = read_csv(session_dir / "laps.csv")
        stints = read_csv(session_dir / "stints.csv")
        results = read_csv(session_dir / "results.csv")
        weather = read_csv(session_dir / "weather.csv")
        season, round_number, event_name = infer_session_context(session_dir, [summary, laps, stints])
        if not season or not round_number:
            continue

        race_id = race_lookup.get((season, round_number))
        if not race_id:
            continue

        session_id = f"{race_id}|{session_code}"
        if session_id not in seen_sessions:
            sessions_rows.append(
                {
                    "id": session_id,
                    "race_id": race_id,
                    "season": season,
                    "round": round_number,
                    "session_code": session_code,
                    "session_name": session_code,
                    "event_name": event_name or race_id,
                    "scheduled_at": None,
                    "source_label": "fastf1_canonical_v1",
                }
            )
            seen_sessions.add(session_id)

        entrant_sources: list[pd.DataFrame] = []
        if not summary.empty and {"driver", "team"}.issubset(summary.columns):
            entrant_sources.append(summary[["driver", "team"]].rename(columns={"driver": "driver_ref", "team": "team_ref"}))
        if not laps.empty and {"driver", "team"}.issubset(laps.columns):
            entrant_sources.append(laps[["driver", "team"]].rename(columns={"driver": "driver_ref", "team": "team_ref"}))
        if not stints.empty and {"driver", "team"}.issubset(stints.columns):
            entrant_sources.append(stints[["driver", "team"]].rename(columns={"driver": "driver_ref", "team": "team_ref"}))

        if entrant_sources:
            entrants = pd.concat(entrant_sources, ignore_index=True).drop_duplicates()
            for _, entrant in entrants.iterrows():
                driver_id = resolve_driver_id(entrant["driver_ref"], driver_lookup)
                constructor_id = resolve_constructor_id(entrant["team_ref"], constructor_lookup)
                if not constructor_id:
                    constructor_id = fallback_constructor_for_driver(driver_id)
                if not driver_id or not constructor_id:
                    continue
                entry_id = f"{race_id}|{driver_id}"
                if entry_id in seen_entries:
                    continue
                entry_rows.append(
                    {
                        "id": entry_id,
                        "race_id": race_id,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "source_label": "fastf1_entry_v1",
                    }
                )
                seen_entries.add(entry_id)

        if not summary.empty:
            normalized_summary = summary.copy()
            normalized_summary["driver_id"] = normalized_summary["driver"].apply(lambda value: resolve_driver_id(value, driver_lookup))
            normalized_summary["constructor_id"] = normalized_summary["team"].apply(lambda value: resolve_constructor_id(value, constructor_lookup))
            normalized_summary["constructor_id"] = normalized_summary.apply(
                lambda row: row["constructor_id"] or fallback_constructor_for_driver(row["driver_id"]),
                axis=1,
            )
            normalized_summary = normalized_summary.dropna(subset=["driver_id", "constructor_id"])
            for _, row in normalized_summary.iterrows():
                pace_rows.append(
                    {
                        "id": f"{session_id}|{row['driver_id']}",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "session_id": session_id,
                        "session_code": session_code,
                        "driver_id": row["driver_id"],
                        "constructor_id": row["constructor_id"],
                        "representative_lap_s": row.get("representative_lap_s"),
                        "best_lap_s": row.get("best_lap_s"),
                        "long_run_lap_s": row.get("long_run_lap_s"),
                        "long_run_degradation_s": row.get("long_run_degradation_s"),
                        "gap_to_session_best_s": row.get("gap_to_session_best_s"),
                        "pace_rank": row.get("pace_rank"),
                        "gap_to_teammate_s": row.get("gap_to_teammate_s"),
                        "top_speed_kph": row.get("top_speed_kph"),
                        "air_temp_c": row.get("air_temp_c"),
                        "track_temp_c": row.get("track_temp_c"),
                        "rainfall_flag": bool(row.get("rainfall_flag")) if pd.notna(row.get("rainfall_flag")) else False,
                        "source_label": "race_week_session_pace_v1",
                    }
                )

        if not laps.empty:
            normalized_laps = laps.copy()
            normalized_laps["driver_id"] = normalized_laps["driver"].apply(lambda value: resolve_driver_id(value, driver_lookup))
            normalized_laps["constructor_id"] = normalized_laps["team"].apply(lambda value: resolve_constructor_id(value, constructor_lookup))
            normalized_laps["constructor_id"] = normalized_laps.apply(
                lambda row: row["constructor_id"] or fallback_constructor_for_driver(row["driver_id"]),
                axis=1,
            )
            normalized_laps = normalized_laps.dropna(subset=["driver_id", "constructor_id"])
            for _, row in normalized_laps.iterrows():
                event_entry_id = f"{race_id}|{row['driver_id']}"
                lap_number = int(row["lap_number"]) if pd.notna(row.get("lap_number")) else 0
                top_speed_candidates = [row.get("speed_i1"), row.get("speed_i2"), row.get("speed_fl"), row.get("speed_st")]
                top_speed = pd.to_numeric(pd.Series(top_speed_candidates), errors="coerce").max()
                lap_rows.append(
                    {
                        "id": f"{session_id}|{row['driver_id']}|{lap_number}",
                        "session_id": session_id,
                        "event_entry_id": event_entry_id,
                        "race_id": race_id,
                        "driver_id": row["driver_id"],
                        "constructor_id": row["constructor_id"],
                        "lap_number": lap_number,
                        "stint_number": int(row["stint"]) if pd.notna(row.get("stint")) else None,
                        "compound": row.get("compound"),
                        "tyre_life": int(row["tyre_life"]) if pd.notna(row.get("tyre_life")) else None,
                        "lap_time_s": row.get("lap_time_s"),
                        "sector_1_s": row.get("sector_1_s"),
                        "sector_2_s": row.get("sector_2_s"),
                        "sector_3_s": row.get("sector_3_s"),
                        "top_speed_kph": top_speed if pd.notna(top_speed) else None,
                        "track_status": row.get("track_status"),
                        "fresh_tyre": bool(row.get("fresh_tyre")) if pd.notna(row.get("fresh_tyre")) else False,
                        "is_personal_best": bool(row.get("is_personal_best")) if pd.notna(row.get("is_personal_best")) else False,
                        "is_accurate": bool(row.get("is_accurate")) if pd.notna(row.get("is_accurate")) else False,
                        "deleted": bool(row.get("deleted")) if pd.notna(row.get("deleted")) else False,
                        "lap_start_time": row.get("lap_start_time"),
                        "position": int(row["position"]) if pd.notna(row.get("position")) else None,
                        "air_temp_c": row.get("air_temp_c"),
                        "track_temp_c": row.get("track_temp_c"),
                        "humidity_pct": row.get("humidity_pct"),
                        "rainfall": bool(row.get("rainfall")) if pd.notna(row.get("rainfall")) else False,
                        "wind_speed_mps": row.get("wind_speed_mps"),
                        "wind_direction_deg": row.get("wind_direction_deg"),
                        "source_label": "fastf1_session_lap_v1",
                    }
                )

        if not stints.empty:
            normalized_stints = stints.copy()
            normalized_stints["driver_id"] = normalized_stints["driver"].apply(lambda value: resolve_driver_id(value, driver_lookup))
            normalized_stints["constructor_id"] = normalized_stints["team"].apply(lambda value: resolve_constructor_id(value, constructor_lookup))
            normalized_stints["constructor_id"] = normalized_stints.apply(
                lambda row: row["constructor_id"] or fallback_constructor_for_driver(row["driver_id"]),
                axis=1,
            )
            normalized_stints = normalized_stints.dropna(subset=["driver_id", "constructor_id"])
            for _, row in normalized_stints.iterrows():
                event_entry_id = f"{race_id}|{row['driver_id']}"
                stint_number = int(row["stint"]) if pd.notna(row.get("stint")) else 0
                stint_rows.append(
                    {
                        "id": f"{session_id}|{row['driver_id']}|{stint_number}",
                        "session_id": session_id,
                        "event_entry_id": event_entry_id,
                        "race_id": race_id,
                        "driver_id": row["driver_id"],
                        "constructor_id": row["constructor_id"],
                        "stint_number": stint_number,
                        "compound": row.get("compound"),
                        "lap_count": int(row["lap_count"]) if pd.notna(row.get("lap_count")) else None,
                        "mean_lap_time_s": row.get("mean_lap_time_s"),
                        "degradation_per_lap_s": row.get("degradation_per_lap_s"),
                        "degradation_index": row.get("degradation_index"),
                        "start_tyre_life": int(row["start_tyre_life"]) if pd.notna(row.get("start_tyre_life")) else None,
                        "end_tyre_life": int(row["end_tyre_life"]) if pd.notna(row.get("end_tyre_life")) else None,
                        "session_code": row.get("session_code") or session_code,
                        "source_label": "fastf1_session_stint_v1",
                    }
                )

        if not weather.empty:
            normalized_weather = weather.copy().reset_index(drop=True)
            for idx, row in normalized_weather.iterrows():
                rainfall_value = pick_first(row, ["Rainfall"])
                weather_rows.append(
                    {
                        "id": f"{session_id}|{idx + 1}",
                        "session_id": session_id,
                        "race_id": race_id,
                        "sample_order": idx + 1,
                        "sample_time": pick_first(row, ["Time", "SessionTime"]),
                        "air_temp_c": pick_first(row, ["AirTemp"]),
                        "track_temp_c": pick_first(row, ["TrackTemp"]),
                        "humidity_pct": pick_first(row, ["Humidity"]),
                        "pressure_hpa": pick_first(row, ["Pressure"]),
                        "rainfall": bool(rainfall_value) if pd.notna(rainfall_value) else False,
                        "wind_speed_mps": pick_first(row, ["WindSpeed"]),
                        "wind_direction_deg": pick_first(row, ["WindDirection"]),
                        "source_label": "fastf1_session_weather_v1",
                    }
                )

        if not results.empty:
            normalized_results = results.copy().reset_index(drop=True)
            for _, row in normalized_results.iterrows():
                driver_id = resolve_driver_id(pick_first(row, ["Abbreviation", "Driver", "BroadcastName"]), driver_lookup)
                constructor_id = resolve_constructor_id(
                    pick_first(row, ["TeamName", "Team", "Constructor", "Entrant"]),
                    constructor_lookup,
                )
                if not constructor_id:
                    constructor_id = fallback_constructor_for_driver(driver_id)
                if not driver_id or not constructor_id:
                    continue
                event_entry_id = f"{race_id}|{driver_id}"
                result_rows.append(
                    {
                        "id": f"{session_id}|{driver_id}",
                        "session_id": session_id,
                        "event_entry_id": event_entry_id,
                        "race_id": race_id,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "classification_position": pick_first(row, ["ClassifiedPosition", "Position"]),
                        "grid_position": pick_first(row, ["GridPosition"]),
                        "finish_position": pick_first(row, ["Position", "ClassifiedPosition"]),
                        "points": pick_first(row, ["Points"]),
                        "status": pick_first(row, ["Status", "Time"]),
                        "laps_completed": pick_first(row, ["Laps"]),
                        "fastest_lap_rank": pick_first(row, ["FastestLapRank"]),
                        "source_label": "fastf1_session_result_v1",
                    }
                )

    return {
        "sessions": pd.DataFrame(sessions_rows),
        "event_entries": pd.DataFrame(entry_rows),
        "session_results": pd.DataFrame(result_rows),
        "session_laps": pd.DataFrame(lap_rows),
        "session_stints": pd.DataFrame(stint_rows),
        "session_weather": pd.DataFrame(weather_rows),
        "session_pace_summary": pd.DataFrame(pace_rows),
    }


def scale_lower_better(series: pd.Series, default: float = 0.5) -> pd.Series:
    clean = pd.to_numeric(series, errors="coerce")
    if clean.notna().sum() <= 1:
        return pd.Series(default, index=series.index)
    return 1 - (clean - clean.min()) / max(clean.max() - clean.min(), 1e-6)


def scale_higher_better(series: pd.Series, default: float = 0.5) -> pd.Series:
    clean = pd.to_numeric(series, errors="coerce")
    if clean.notna().sum() <= 1:
        return pd.Series(default, index=series.index)
    return (clean - clean.min()) / max(clean.max() - clean.min(), 1e-6)


def classify_circuit(row: pd.Series) -> str:
    high_speed = float(row.get("high_speed_bias") or 0)
    overtake = float(row.get("overtake_difficulty") or 0)
    degradation = float(row.get("tire_degradation_bias") or 0)
    if degradation >= 7:
        return "High-degradation circuit"
    if high_speed >= 7:
        return "High-speed circuit"
    if overtake <= 4:
        return "Track-position circuit"
    return "Balanced circuit"


def difficulty_band(score: float) -> str:
    if score >= 70:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def confidence_band(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def clamp01(value: Any, default: float = 0.0) -> float:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return default
    return float(min(1.0, max(0.0, number)))


def mean_or_none(series: pd.Series) -> float | None:
    values = pd.to_numeric(series, errors="coerce").dropna()
    if values.empty:
        return None
    return float(values.mean())


def joined_flags(flags: list[str]) -> str:
    return ";".join(sorted(set(flag for flag in flags if flag))) or "none"


def build_session_year_over_year_deltas(
    *,
    session_pace: pd.DataFrame,
    races: pd.DataFrame,
    active_races: pd.DataFrame,
) -> pd.DataFrame:
    columns = [
        "id",
        "season",
        "round",
        "race_id",
        "circuit_id",
        "session_code",
        "driver_id",
        "constructor_id",
        "comparison_season",
        "comparison_race_id",
        "current_gap_s",
        "prior_gap_s",
        "delta_gap_s",
        "source_label",
    ]
    if session_pace.empty or races.empty or active_races.empty:
        return pd.DataFrame(columns=columns)

    race_meta = races[["id", "season", "round", "circuit_id"]].copy()
    race_meta["season"] = pd.to_numeric(race_meta["season"], errors="coerce")
    race_meta["round"] = pd.to_numeric(race_meta["round"], errors="coerce")

    pace = session_pace.copy()
    pace["season"] = pd.to_numeric(pace["season"], errors="coerce")
    pace["round"] = pd.to_numeric(pace["round"], errors="coerce")
    pace["gap_to_session_best_s"] = pd.to_numeric(pace["gap_to_session_best_s"], errors="coerce")
    if "circuit_id" not in pace.columns:
        pace = pace.merge(
            race_meta.rename(columns={"id": "race_id", "season": "race_season", "round": "race_round"}),
            on="race_id",
            how="left",
        )
    pace["circuit_id"] = pace["circuit_id"].astype(str)
    pace["session_code"] = pace["session_code"].astype(str).str.upper()
    pace["driver_id"] = pace["driver_id"].astype(str)
    pace = pace[
        pace["session_code"].isin(["FP1", "FP2", "FP3", "Q"])
        & pace["gap_to_session_best_s"].notna()
        & pace["driver_id"].ne("")
    ].copy()

    rows: list[dict[str, Any]] = []
    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        season = int(active_race["season"])
        round_number = int(active_race["round"])
        circuit_id = str(active_race["circuit_id"])
        current = pace[(pace["race_id"].astype(str) == race_id) & (pace["circuit_id"] == circuit_id)].copy()
        historical = pace[(pace["circuit_id"] == circuit_id) & (pd.to_numeric(pace["season"], errors="coerce") < season)].copy()
        if current.empty or historical.empty:
            continue
        for _, current_row in current.iterrows():
            prior_rows = historical[
                (historical["driver_id"] == current_row["driver_id"])
                & (historical["session_code"] == current_row["session_code"])
            ].sort_values(["season", "round", "race_id"])
            for _, prior_row in prior_rows.iterrows():
                prior_gap = pd.to_numeric(pd.Series([prior_row["gap_to_session_best_s"]]), errors="coerce").iloc[0]
                current_gap = pd.to_numeric(pd.Series([current_row["gap_to_session_best_s"]]), errors="coerce").iloc[0]
                if pd.isna(prior_gap) or pd.isna(current_gap):
                    continue
                comparison_race_id = str(prior_row["race_id"])
                rows.append(
                    {
                        "id": f"{race_id}|{current_row['session_code']}|{current_row['driver_id']}|{comparison_race_id}",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "circuit_id": circuit_id,
                        "session_code": current_row["session_code"],
                        "driver_id": current_row["driver_id"],
                        "constructor_id": current_row["constructor_id"],
                        "comparison_season": int(prior_row["season"]),
                        "comparison_race_id": comparison_race_id,
                        "current_gap_s": float(current_gap),
                        "prior_gap_s": float(prior_gap),
                        "delta_gap_s": float(current_gap - prior_gap),
                        "source_label": "race_week_session_yoy_delta_v1",
                    }
                )

    return pd.DataFrame(rows, columns=columns)


def build_qualifying_driver_deltas(
    *,
    session_pace: pd.DataFrame,
    races: pd.DataFrame,
    active_races: pd.DataFrame,
    session_year_over_year_deltas: pd.DataFrame,
) -> pd.DataFrame:
    columns = [
        "id",
        "season",
        "round",
        "race_id",
        "circuit_id",
        "delta_type",
        "driver_id",
        "comparison_driver_id",
        "constructor_id",
        "comparison_constructor_id",
        "current_quali_gap_s",
        "comparison_quali_gap_s",
        "pairwise_delta_gap_s",
        "avg_quali_yoy_delta_s",
        "source_sample_size",
        "source_label",
    ]
    if session_pace.empty or races.empty or active_races.empty:
        return pd.DataFrame(columns=columns)

    race_meta = races[["id", "circuit_id"]].rename(columns={"id": "race_id"})
    pace = session_pace.copy()
    if "circuit_id" not in pace.columns:
        pace = pace.merge(race_meta, on="race_id", how="left")
    pace["session_code"] = pace["session_code"].astype(str).str.upper()
    pace["gap_to_session_best_s"] = pd.to_numeric(pace["gap_to_session_best_s"], errors="coerce")
    pace["driver_id"] = pace["driver_id"].astype(str)
    pace["circuit_id"] = pace["circuit_id"].astype(str)

    avg_lookup: dict[tuple[str, str], tuple[float | None, int]] = {}
    if not session_year_over_year_deltas.empty:
        q_deltas = session_year_over_year_deltas[
            session_year_over_year_deltas["session_code"].astype(str).str.upper().eq("Q")
        ].copy()
        if not q_deltas.empty:
            q_deltas["delta_gap_s"] = pd.to_numeric(q_deltas["delta_gap_s"], errors="coerce")
            grouped = q_deltas.dropna(subset=["delta_gap_s"]).groupby(["race_id", "driver_id"], dropna=False)["delta_gap_s"]
            avg_lookup = {
                (str(race_id), str(driver_id)): (float(values.mean()), int(values.count()))
                for (race_id, driver_id), values in grouped
            }

    rows: list[dict[str, Any]] = []
    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        season = int(active_race["season"])
        round_number = int(active_race["round"])
        circuit_id = str(active_race["circuit_id"])
        q_rows = pace[
            (pace["race_id"].astype(str) == race_id)
            & (pace["circuit_id"] == circuit_id)
            & (pace["session_code"] == "Q")
            & pace["gap_to_session_best_s"].notna()
        ].sort_values(["gap_to_session_best_s", "driver_id"])
        if q_rows.empty:
            continue

        for _, row in q_rows.iterrows():
            avg_delta, sample_size = avg_lookup.get((race_id, str(row["driver_id"])), (None, 0))
            rows.append(
                {
                    "id": f"{race_id}|Q|{row['driver_id']}|gap",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "circuit_id": circuit_id,
                    "delta_type": "driver_gap",
                    "driver_id": row["driver_id"],
                    "comparison_driver_id": None,
                    "constructor_id": row["constructor_id"],
                    "comparison_constructor_id": None,
                    "current_quali_gap_s": float(row["gap_to_session_best_s"]),
                    "comparison_quali_gap_s": None,
                    "pairwise_delta_gap_s": None,
                    "avg_quali_yoy_delta_s": avg_delta,
                    "source_sample_size": sample_size,
                    "source_label": "race_week_qualifying_driver_delta_v1",
                }
            )

        for left in q_rows.to_dict("records"):
            for right in q_rows.to_dict("records"):
                if str(left["driver_id"]) == str(right["driver_id"]):
                    continue
                left_gap = float(left["gap_to_session_best_s"])
                right_gap = float(right["gap_to_session_best_s"])
                rows.append(
                    {
                        "id": f"{race_id}|Q|{left['driver_id']}|vs|{right['driver_id']}",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "circuit_id": circuit_id,
                        "delta_type": "pairwise_driver_delta",
                        "driver_id": left["driver_id"],
                        "comparison_driver_id": right["driver_id"],
                        "constructor_id": left["constructor_id"],
                        "comparison_constructor_id": right["constructor_id"],
                        "current_quali_gap_s": left_gap,
                        "comparison_quali_gap_s": right_gap,
                        "pairwise_delta_gap_s": float(left_gap - right_gap),
                        "avg_quali_yoy_delta_s": None,
                        "source_sample_size": 1,
                        "source_label": "race_week_qualifying_driver_delta_v1",
                    }
                )

    return pd.DataFrame(rows, columns=columns)


def qualifying_gap_frame(qualifying_results: pd.DataFrame, races: pd.DataFrame) -> pd.DataFrame:
    columns = [
        "race_id",
        "season",
        "round",
        "circuit_id",
        "scheduled_at",
        "driver_id",
        "constructor_id",
        "best_q_s",
        "gap_to_pole_s",
        "position",
    ]
    if qualifying_results.empty or races.empty:
        return pd.DataFrame(columns=columns)

    race_meta = races[["id", "season", "round", "circuit_id", "scheduled_at"]].rename(columns={"id": "race_id"}).copy()
    race_meta["scheduled_at"] = pd.to_datetime(race_meta["scheduled_at"], utc=True, errors="coerce")
    frame = qualifying_results.copy()
    for column in ["q1_time_ms", "q2_time_ms", "q3_time_ms", "position"]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["best_q_s"] = frame[[column for column in ["q1_time_ms", "q2_time_ms", "q3_time_ms"] if column in frame.columns]].min(axis=1) / 1000
    frame = frame.dropna(subset=["best_q_s"]).merge(race_meta, on="race_id", how="left")
    frame["gap_to_pole_s"] = frame["best_q_s"] - frame.groupby("race_id")["best_q_s"].transform("min")
    return frame[columns]


def robust_center(values: pd.Series) -> float | None:
    clean = pd.to_numeric(values, errors="coerce").dropna().sort_values()
    if clean.empty:
        return None
    if len(clean) >= 5:
        lower = clean.quantile(0.10)
        upper = clean.quantile(0.90)
        trimmed = clean[(clean >= lower) & (clean <= upper)]
        if not trimmed.empty:
            clean = trimmed
    return float(clean.median())


def same_circuit_season_delta_seconds(
    qualifying_gaps: pd.DataFrame,
    *,
    baseline_season: int,
    target_season: int,
    target_scheduled_at: pd.Timestamp | None = None,
) -> tuple[float | None, str]:
    if qualifying_gaps.empty:
        return None, "season_delta_unavailable"
    poles = (
        qualifying_gaps.copy()
        .dropna(subset=["best_q_s", "season", "circuit_id"])
        .groupby(["season", "circuit_id"], dropna=False)["best_q_s"]
        .min()
        .reset_index()
    )
    if target_scheduled_at is not None and pd.notna(target_scheduled_at):
        completed_target_races = qualifying_gaps[
            (pd.to_numeric(qualifying_gaps["season"], errors="coerce") == target_season)
            & (pd.to_datetime(qualifying_gaps["scheduled_at"], utc=True, errors="coerce") < target_scheduled_at)
        ]["circuit_id"].dropna().astype(str).unique()
        poles = poles[
            (pd.to_numeric(poles["season"], errors="coerce") != target_season)
            | (poles["circuit_id"].astype(str).isin(completed_target_races))
        ]
    baseline = poles[pd.to_numeric(poles["season"], errors="coerce") == baseline_season][["circuit_id", "best_q_s"]]
    target = poles[pd.to_numeric(poles["season"], errors="coerce") == target_season][["circuit_id", "best_q_s"]]
    paired = baseline.merge(target, on="circuit_id", suffixes=("_baseline", "_target"))
    if paired.empty:
        return None, "season_delta_unavailable"
    paired["delta_s"] = paired["best_q_s_target"] - paired["best_q_s_baseline"]
    value = robust_center(paired["delta_s"])
    method = f"same_circuit_median_{target_season}_vs_{baseline_season}_n{len(paired)}"
    return value, method


def catalunya_base_pole_seconds(
    qualifying_gaps: pd.DataFrame,
    *,
    target_season: int,
    target_scheduled_at: pd.Timestamp | None = None,
) -> tuple[float | None, float | None, float, str]:
    if qualifying_gaps.empty:
        return None, None, 0.0, "catalunya_base_unavailable"
    catalunya = qualifying_gaps[
        (qualifying_gaps["circuit_id"].astype(str) == "catalunya")
        & (pd.to_numeric(qualifying_gaps["season"], errors="coerce") < target_season)
    ].copy()
    if catalunya.empty:
        return None, None, 0.0, "catalunya_base_unavailable"
    poles = (
        catalunya.groupby("season", dropna=False)["best_q_s"]
        .min()
        .dropna()
        .sort_index()
    )
    baseline_season = target_season - 1
    if baseline_season in poles.index:
        baseline_pole_s = float(poles.loc[baseline_season])
    else:
        latest = poles.tail(1)
        if latest.empty:
            return None, None, 0.0, "catalunya_base_unavailable"
        baseline_season = int(latest.index[-1])
        baseline_pole_s = float(latest.iloc[-1])
    season_delta_s, method = same_circuit_season_delta_seconds(
        qualifying_gaps,
        baseline_season=baseline_season,
        target_season=target_season,
        target_scheduled_at=target_scheduled_at,
    )
    if season_delta_s is None:
        season_delta_s = 0.0
        method = f"catalunya_{baseline_season}_pole_no_season_delta"
    track_residual_s = 0.0
    return baseline_pole_s + season_delta_s + track_residual_s, season_delta_s, track_residual_s, method


def first_number(*values: Any) -> float | None:
    for value in values:
        number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
        if not pd.isna(number):
            return float(number)
    return None


def build_spain_qualifying_prediction(
    *,
    races: pd.DataFrame,
    qualifying_results: pd.DataFrame,
    race_week_context: pd.DataFrame,
    driver_features: pd.DataFrame,
    session_year_over_year_deltas: pd.DataFrame,
    qualifying_driver_deltas: pd.DataFrame,
) -> pd.DataFrame:
    columns = [
        "id",
        "season",
        "round",
        "race_id",
        "prediction_mode",
        "mode_label",
        "included_sessions",
        "mode_status",
        "driver_id",
        "constructor_id",
        "predicted_q_rank",
        "predicted_q_time_s",
        "predicted_q_gap_s",
        "base_pole_s",
        "season_delta_26_vs_25_s",
        "track_residual_s",
        "recent_quali_gap_s",
        "same_circuit_gap_s",
        "constructor_quali_gap_s",
        "race_week_delta_gap_s",
        "driver_gap_delta_s",
        "constructor_gap_delta_s",
        "form_bias_score",
        "confidence_score",
        "clamped_prediction",
        "missing_flags",
        "baseline_method",
        "source_label",
    ]
    if races.empty or race_week_context.empty or driver_features.empty:
        return pd.DataFrame(columns=columns)

    active_races = race_week_context[
        race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])
        & race_week_context["circuit_id"].astype(str).eq("catalunya")
    ].copy()
    if active_races.empty:
        return pd.DataFrame(columns=columns)

    q_gaps = qualifying_gap_frame(qualifying_results, races)
    rows: list[dict[str, Any]] = []

    def available_sessions_for_race(race_id: str) -> set[str]:
        if session_year_over_year_deltas.empty:
            return set()
        race_session_rows = session_year_over_year_deltas[
            session_year_over_year_deltas["race_id"].astype(str).eq(race_id)
            & session_year_over_year_deltas["delta_gap_s"].notna()
        ]
        return set(race_session_rows["session_code"].astype(str).str.upper())

    def mode_configs(race_id: str) -> list[dict[str, Any]]:
        available_sessions = available_sessions_for_race(race_id)
        if {"FP1", "FP2", "FP3"}.issubset(available_sessions):
            baseline_sessions = ["FP1", "FP2", "FP3"]
        elif {"FP1", "FP2"}.issubset(available_sessions):
            baseline_sessions = ["FP1", "FP2"]
        elif "FP1" in available_sessions:
            baseline_sessions = ["FP1"]
        else:
            baseline_sessions = []

        configs = [
            {
                "prediction_mode": "baseline",
                "mode_label": "Predictions",
                "included_sessions": baseline_sessions,
                "mode_status": "available",
            },
            {
                "prediction_mode": "pre_session",
                "mode_label": "Pre-session pred",
                "included_sessions": [],
                "mode_status": "available",
            },
            {
                "prediction_mode": "fp1",
                "mode_label": "FP1 pred",
                "included_sessions": ["FP1"],
                "mode_status": "available" if "FP1" in available_sessions else "pending",
            },
            {
                "prediction_mode": "fp2",
                "mode_label": "FP2 pred",
                "included_sessions": ["FP1", "FP2"],
                "mode_status": "available" if {"FP1", "FP2"}.issubset(available_sessions) else "pending",
            },
            {
                "prediction_mode": "fp3",
                "mode_label": "FP3 pred",
                "included_sessions": ["FP1", "FP2", "FP3"],
                "mode_status": "available" if {"FP1", "FP2", "FP3"}.issubset(available_sessions) else "pending",
            },
        ]
        return [config for config in configs if config["mode_status"] == "available"]

    def race_week_delta_for_mode(race_id: str, driver_id: str, session_codes: list[str], use_qualifying_fallback: bool) -> float | None:
        if session_codes and not session_year_over_year_deltas.empty:
            mode_yoy = session_year_over_year_deltas[
                (session_year_over_year_deltas["race_id"].astype(str) == race_id)
                & (session_year_over_year_deltas["driver_id"].astype(str) == driver_id)
                & (session_year_over_year_deltas["session_code"].astype(str).str.upper().isin(session_codes))
            ]
            delta = mean_or_none(mode_yoy["delta_gap_s"])
            if delta is not None:
                return delta

        if not use_qualifying_fallback:
            return None

        if not qualifying_driver_deltas.empty:
            q_delta_row = qualifying_driver_deltas[
                (qualifying_driver_deltas["race_id"].astype(str) == race_id)
                & (qualifying_driver_deltas["driver_id"].astype(str) == driver_id)
                & (qualifying_driver_deltas["delta_type"].astype(str) == "driver_gap")
            ].head(1)
            if not q_delta_row.empty:
                delta = first_number(q_delta_row["avg_quali_yoy_delta_s"].iloc[0])
                if delta is not None:
                    return delta
        if not session_year_over_year_deltas.empty:
            q_yoy = session_year_over_year_deltas[
                (session_year_over_year_deltas["race_id"].astype(str) == race_id)
                & (session_year_over_year_deltas["driver_id"].astype(str) == driver_id)
                & (session_year_over_year_deltas["session_code"].astype(str).str.upper() == "Q")
            ]
            return mean_or_none(q_yoy["delta_gap_s"])
        return None

    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        season = int(active_race["season"])
        round_number = int(active_race["round"])
        circuit_id = str(active_race["circuit_id"])
        race_row = races[races["id"].astype(str).eq(race_id)].head(1)
        target_scheduled_at = (
            pd.to_datetime(race_row["scheduled_at"], utc=True, errors="coerce").iloc[0]
            if not race_row.empty and "scheduled_at" in race_row.columns
            else pd.NaT
        )
        base_pole_s, season_delta_s, track_residual_s, baseline_method = catalunya_base_pole_seconds(
            q_gaps,
            target_season=season,
            target_scheduled_at=target_scheduled_at,
        )
        if base_pole_s is None:
            base_pole_s = mean_or_none(q_gaps[q_gaps["circuit_id"].astype(str).eq(circuit_id)]["best_q_s"]) or 72.0
            season_delta_s = None
            track_residual_s = 0.0
            baseline_method = "fallback_circuit_mean"

        prior = q_gaps[pd.to_numeric(q_gaps["season"], errors="coerce") < season].copy()
        same_circuit = prior[prior["circuit_id"].astype(str).eq(circuit_id)].copy()
        baseline_season = season - 1
        prior_baseline_season = q_gaps[pd.to_numeric(q_gaps["season"], errors="coerce") == baseline_season].copy()
        recent_season = q_gaps[
            (pd.to_numeric(q_gaps["season"], errors="coerce") == season)
            & (q_gaps["race_id"].astype(str) != race_id)
        ].copy()
        if pd.notna(target_scheduled_at):
            recent_season = recent_season[pd.to_datetime(recent_season["scheduled_at"], utc=True, errors="coerce") < target_scheduled_at]
        field_median_gap = first_number(
            same_circuit["gap_to_pole_s"].median() if not same_circuit.empty else None,
            recent_season["gap_to_pole_s"].median() if not recent_season.empty else None,
            1.6,
        ) or 1.6

        active_features = driver_features[driver_features["race_id"].astype(str).eq(race_id)].copy()
        active_features["form_bias_score"] = pd.to_numeric(optional_series(active_features, "form_bias_score"), errors="coerce")
        known_driver_prior: dict[str, float] = {}
        for _, feature in active_features.iterrows():
            driver_id = str(feature["driver_id"])
            recent_gap = mean_or_none(
                recent_season[recent_season["driver_id"].astype(str).eq(driver_id)]
                .sort_values("scheduled_at")
                .tail(3)["gap_to_pole_s"]
            )
            circuit_gap = mean_or_none(same_circuit[same_circuit["driver_id"].astype(str).eq(driver_id)]["gap_to_pole_s"])
            value = first_number(circuit_gap, recent_gap)
            if value is not None:
                known_driver_prior[driver_id] = value

        for mode_config in mode_configs(race_id):
            prediction_mode = str(mode_config["prediction_mode"])
            included_sessions = list(mode_config["included_sessions"])
            mode_label = str(mode_config["mode_label"])
            mode_status = str(mode_config["mode_status"])

            for _, feature in active_features.iterrows():
                driver_id = str(feature["driver_id"])
                constructor_id = str(feature["constructor_id"])
                missing_flags: list[str] = []

                recent_quali_gap_s = mean_or_none(
                    recent_season[recent_season["driver_id"].astype(str).eq(driver_id)]
                    .sort_values("scheduled_at")
                    .tail(3)["gap_to_pole_s"]
                )
                same_circuit_gap_s = mean_or_none(same_circuit[same_circuit["driver_id"].astype(str).eq(driver_id)]["gap_to_pole_s"])
                constructor_same_circuit_gap_s = mean_or_none(
                    same_circuit[same_circuit["constructor_id"].astype(str).eq(constructor_id)]["gap_to_pole_s"]
                )
                constructor_quali_gap_s = constructor_same_circuit_gap_s
                if constructor_quali_gap_s is None:
                    constructor_quali_gap_s = mean_or_none(
                        recent_season[recent_season["constructor_id"].astype(str).eq(constructor_id)]["gap_to_pole_s"]
                    )
                driver_baseline_gap_s = first_number(
                    same_circuit_gap_s,
                    mean_or_none(
                        prior_baseline_season[prior_baseline_season["driver_id"].astype(str).eq(driver_id)]
                        .sort_values("scheduled_at")
                        .tail(5)["gap_to_pole_s"]
                    ),
                )
                constructor_baseline_gap_s = first_number(
                    constructor_same_circuit_gap_s,
                    mean_or_none(
                        prior_baseline_season[prior_baseline_season["constructor_id"].astype(str).eq(constructor_id)]["gap_to_pole_s"]
                    ),
                )
                driver_gap_delta_s = (
                    recent_quali_gap_s - driver_baseline_gap_s
                    if recent_quali_gap_s is not None and driver_baseline_gap_s is not None
                    else None
                )
                recent_constructor_gap_s = mean_or_none(
                    recent_season[recent_season["constructor_id"].astype(str).eq(constructor_id)]["gap_to_pole_s"]
                )
                constructor_gap_delta_s = (
                    recent_constructor_gap_s - constructor_baseline_gap_s
                    if recent_constructor_gap_s is not None and constructor_baseline_gap_s is not None
                    else None
                )
                race_week_delta_gap_s = None
                if prediction_mode != "pre_session":
                    race_week_delta_gap_s = race_week_delta_for_mode(
                        race_id,
                        driver_id,
                        included_sessions,
                        use_qualifying_fallback=prediction_mode == "baseline" and not included_sessions,
                    )

                teammate_values = [
                    value
                    for teammate_id, value in known_driver_prior.items()
                    if teammate_id != driver_id
                    and not active_features[
                        (active_features["driver_id"].astype(str).eq(teammate_id))
                        & (active_features["constructor_id"].astype(str).eq(constructor_id))
                    ].empty
                ]
                teammate_prior_gap_s = float(sum(teammate_values) / len(teammate_values)) if teammate_values else None
                fallback_gap = first_number(constructor_quali_gap_s, teammate_prior_gap_s, field_median_gap) or field_median_gap

                if prediction_mode == "pre_session":
                    missing_flags.append("pre_session_model")
                if recent_quali_gap_s is None:
                    missing_flags.append("recent_quali_gap_missing")
                if same_circuit_gap_s is None:
                    missing_flags.append("same_circuit_driver_gap_missing")
                if constructor_quali_gap_s is None:
                    missing_flags.append("constructor_quali_gap_missing")
                if season_delta_s is None:
                    missing_flags.append("season_delta_estimated")
                if driver_gap_delta_s is None:
                    missing_flags.append("driver_delta_missing")
                if constructor_gap_delta_s is None:
                    missing_flags.append("constructor_delta_missing")
                if race_week_delta_gap_s is None:
                    missing_flags.append("race_week_delta_neutral")
                if teammate_prior_gap_s is None:
                    missing_flags.append("teammate_prior_missing")

                recent_component = first_number(recent_quali_gap_s, fallback_gap) or field_median_gap
                same_circuit_component = first_number(same_circuit_gap_s, fallback_gap) or field_median_gap
                constructor_component = first_number(constructor_quali_gap_s, fallback_gap) or field_median_gap
                driver_delta_component = max(0.0, same_circuit_component + driver_gap_delta_s) if driver_gap_delta_s is not None else fallback_gap
                constructor_delta_component = max(0.0, constructor_component + constructor_gap_delta_s) if constructor_gap_delta_s is not None else fallback_gap
                form_bias_score = first_number(feature.get("form_bias_score"), 0.5) or 0.5
                form_component = max(0.0, min(3.2, (1 - form_bias_score) * 3.2))

                raw_gap = (
                    recent_component * 0.30
                    + same_circuit_component * 0.25
                    + constructor_component * 0.20
                    + driver_delta_component * 0.10
                    + constructor_delta_component * 0.10
                    + form_component * 0.05
                )
                if race_week_delta_gap_s is not None:
                    raw_gap += race_week_delta_gap_s * 0.18
                predicted_q_gap_s = max(0.0, min(3.2, raw_gap))
                clamped_prediction = abs(predicted_q_gap_s - raw_gap) > 1e-9
                confidence_score = clamp01(
                    0.20
                    + (0.25 if recent_quali_gap_s is not None else 0.0)
                    + (0.20 if same_circuit_gap_s is not None else 0.0)
                    + (0.15 if constructor_quali_gap_s is not None else 0.0)
                    + (0.15 if race_week_delta_gap_s is not None else 0.0)
                    + (0.05 if teammate_prior_gap_s is not None else 0.0)
                    + 0.05,
                    default=0.25,
                )
                if race_week_delta_gap_s is None:
                    confidence_score = min(confidence_score, 0.68)
                rows.append(
                    {
                        "id": f"{race_id}|{prediction_mode}|{driver_id}",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "prediction_mode": prediction_mode,
                        "mode_label": mode_label,
                        "included_sessions": "|".join(included_sessions),
                        "mode_status": mode_status,
                        "driver_id": driver_id,
                        "constructor_id": constructor_id,
                        "predicted_q_rank": None,
                        "predicted_q_time_s": round(base_pole_s + predicted_q_gap_s, 3),
                        "predicted_q_gap_s": round(predicted_q_gap_s, 3),
                        "base_pole_s": round(base_pole_s, 3),
                        "season_delta_26_vs_25_s": round(season_delta_s, 3) if season_delta_s is not None else None,
                        "track_residual_s": round(track_residual_s, 3),
                        "recent_quali_gap_s": round(recent_quali_gap_s, 3) if recent_quali_gap_s is not None else None,
                        "same_circuit_gap_s": round(same_circuit_gap_s, 3) if same_circuit_gap_s is not None else None,
                        "constructor_quali_gap_s": round(constructor_quali_gap_s, 3) if constructor_quali_gap_s is not None else None,
                        "race_week_delta_gap_s": round(race_week_delta_gap_s, 3) if race_week_delta_gap_s is not None else None,
                        "driver_gap_delta_s": round(driver_gap_delta_s, 3) if driver_gap_delta_s is not None else None,
                        "constructor_gap_delta_s": round(constructor_gap_delta_s, 3) if constructor_gap_delta_s is not None else None,
                        "form_bias_score": round(form_bias_score, 6),
                        "confidence_score": round(confidence_score, 6),
                        "clamped_prediction": clamped_prediction,
                        "missing_flags": joined_flags(missing_flags),
                        "baseline_method": baseline_method,
                        "source_label": "spain_qualifying_prediction_v1",
                    }
                )

    prediction = pd.DataFrame(rows, columns=columns)
    if prediction.empty:
        return prediction
    prediction = prediction.sort_values(
        ["race_id", "prediction_mode", "predicted_q_gap_s", "confidence_score", "recent_quali_gap_s", "constructor_quali_gap_s", "race_week_delta_gap_s", "driver_id"],
        ascending=[True, True, True, False, True, True, True, True],
        na_position="last",
    ).reset_index(drop=True)
    prediction["predicted_q_rank"] = prediction.groupby(["race_id", "prediction_mode"]).cumcount() + 1
    return prediction[columns]


def build_processed_race_week_layers(
    *,
    canonical: dict[str, pd.DataFrame],
    races: pd.DataFrame,
    circuits: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
    qualifying_results: pd.DataFrame,
    race_results: pd.DataFrame,
    strategy_profiles: pd.DataFrame,
    driver_standings: pd.DataFrame,
    constructor_standings: pd.DataFrame,
    race_week_context: pd.DataFrame,
    prediction_snapshots: pd.DataFrame,
    driver_form: pd.DataFrame,
    strategy_baselines: pd.DataFrame,
    fastf1_predictions: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    session_pace = canonical["session_pace_summary"].copy()
    stints = canonical["session_stints"].copy()
    weather = canonical["session_weather"].copy()

    fp2_long_run = pd.DataFrame()
    if not session_pace.empty:
        fp2_long_run = session_pace[session_pace["session_code"] == "FP2"].copy()
        if not fp2_long_run.empty:
            fp2_long_run["gap_to_best_s"] = pd.to_numeric(fp2_long_run["long_run_lap_s"], errors="coerce") - pd.to_numeric(
                fp2_long_run["long_run_lap_s"], errors="coerce"
            ).min()
            lap_counts = (
                stints[stints["session_code"] == "FP2"]
                .groupby(["race_id", "driver_id"], dropna=False)["lap_count"]
                .sum()
                .rename("lap_sample_size")
                .reset_index()
            )
            fp2_long_run = fp2_long_run.merge(lap_counts, on=["race_id", "driver_id"], how="left")
            fp2_long_run["signal_confidence"] = (
                pd.to_numeric(fp2_long_run["lap_sample_size"], errors="coerce").fillna(0).clip(lower=0, upper=14) / 14
            ).round(3)
            fp2_long_run["compound"] = None
            fp2_long_run["id"] = fp2_long_run.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
            fp2_long_run = fp2_long_run[
                [
                    "id",
                    "season",
                    "round",
                    "race_id",
                    "driver_id",
                    "constructor_id",
                    "long_run_lap_s",
                    "gap_to_best_s",
                    "long_run_degradation_s",
                    "lap_sample_size",
                    "compound",
                    "signal_confidence",
                ]
            ].rename(
                columns={
                    "long_run_lap_s": "representative_long_run_pace_s",
                    "long_run_degradation_s": "degradation_per_lap_s",
                }
            )
            fp2_long_run["source_label"] = "race_week_fp2_long_run_v1"

    stint_degradation = pd.DataFrame()
    stint_group_columns = ["season", "round", "race_id", "session_code", "driver_id", "constructor_id", "compound"]
    stint_value_columns = ["lap_count", "degradation_per_lap_s", "end_tyre_life"]
    if not stints.empty and all(column in stints.columns for column in stint_group_columns + stint_value_columns):
        stint_degradation = (
            stints.groupby(stint_group_columns, dropna=False)
            .agg(
                avg_lap_count=("lap_count", "mean"),
                avg_degradation_per_lap_s=("degradation_per_lap_s", "mean"),
                avg_tyre_life=("end_tyre_life", "mean"),
            )
            .reset_index()
        )
        stint_degradation["degradation_risk"] = (
            pd.to_numeric(stint_degradation["avg_degradation_per_lap_s"], errors="coerce").fillna(0).clip(lower=-0.5, upper=2.0) * 50
        ).round(3)
        stint_degradation["id"] = stint_degradation.apply(
            lambda row: f"{row['race_id']}|{row['session_code']}|{row['driver_id'] or row['constructor_id'] or 'unknown'}|{normalize_key(row['compound'])}",
            axis=1,
        )
        stint_degradation["source_label"] = "race_week_stint_degradation_v1"

    weather_risk = pd.DataFrame()
    if not weather.empty:
        weather_risk = (
            weather.groupby(["race_id"], dropna=False)
            .agg(
                rainfall_probability=("rainfall", lambda values: pd.Series(values).fillna(False).astype(bool).mean() * 100),
                track_temp_mean_c=("track_temp_c", "mean"),
                track_temp_volatility_c=("track_temp_c", "std"),
                wind_speed_mean_mps=("wind_speed_mps", "mean"),
            )
            .reset_index()
        )
        weather_risk = weather_risk.merge(races[["id", "season", "round"]], left_on="race_id", right_on="id", how="left").drop(columns=["id"])
        weather_risk["weather_risk_index"] = (
            pd.to_numeric(weather_risk["rainfall_probability"], errors="coerce").fillna(0) * 0.55
            + pd.to_numeric(weather_risk["track_temp_volatility_c"], errors="coerce").fillna(0).clip(lower=0, upper=12) * 3.0
            + pd.to_numeric(weather_risk["wind_speed_mean_mps"], errors="coerce").fillna(0).clip(lower=0, upper=12) * 2.5
        ).round(3)
        weather_risk["id"] = weather_risk["race_id"]
        weather_risk["source_label"] = "race_week_weather_risk_v1"
    else:
        weather_risk = pd.DataFrame(
            columns=[
                "id",
                "season",
                "round",
                "race_id",
                "rainfall_probability",
                "track_temp_mean_c",
                "track_temp_volatility_c",
                "wind_speed_mean_mps",
                "weather_risk_index",
                "source_label",
            ]
        )

    prediction_frames = [
        frame.copy()
        for frame in [fastf1_predictions, prediction_snapshots]
        if not frame.empty
    ]
    current_predictions = pd.concat(prediction_frames, ignore_index=True) if prediction_frames else pd.DataFrame()
    if not current_predictions.empty:
        prediction_columns = ["race_id", "driver_id", "constructor_id", "projected_finish"]
        if "predicted_score" in current_predictions.columns:
            prediction_columns.append("predicted_score")
        if "rationale" in current_predictions.columns:
            prediction_columns.append("rationale")
        current_predictions = current_predictions[prediction_columns].copy()
        current_predictions["driver_id"] = current_predictions["driver_id"].astype(str)

    driver_features = pd.DataFrame()
    if not race_week_context.empty:
        active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()
        driver_feature_rows: list[pd.DataFrame] = []
        for _, race_row in active_races.iterrows():
            race_id = str(race_row["race_id"])
            pace_for_race = session_pace[session_pace["race_id"] == race_id].copy()
            fp2_for_race = fp2_long_run[fp2_long_run["race_id"] == race_id].copy() if not fp2_long_run.empty else pd.DataFrame()
            weather_for_race = weather_risk[weather_risk["race_id"] == race_id] if not weather_risk.empty else pd.DataFrame()
            form_for_race = driver_form[driver_form["race_id"] == race_id].copy() if not driver_form.empty else pd.DataFrame()
            if pace_for_race.empty and form_for_race.empty:
                continue

            one_lap = pace_for_race[pace_for_race["session_code"].isin(["Q", "FP3", "FP2"])].copy()
            if not one_lap.empty:
                one_lap["session_priority"] = one_lap["session_code"].map({"Q": 0, "FP3": 1, "FP2": 2}).fillna(9)
                one_lap = one_lap.sort_values(["driver_id", "session_priority", "best_lap_s"]).groupby("driver_id", as_index=False).first()

            merged = (
                pd.DataFrame({"driver_id": pd.unique(pd.concat([
                    pace_for_race["driver_id"] if not pace_for_race.empty else pd.Series(dtype="object"),
                    form_for_race["driver_id"] if not form_for_race.empty else pd.Series(dtype="object"),
                ], ignore_index=True))})
                .dropna()
            )
            if merged.empty:
                continue

            if not fp2_for_race.empty:
                merged = merged.merge(
                    fp2_for_race[["driver_id", "constructor_id", "representative_long_run_pace_s", "degradation_per_lap_s", "gap_to_best_s", "signal_confidence"]],
                    on="driver_id",
                    how="left",
                )
            if not one_lap.empty:
                merged = merged.merge(
                    one_lap[["driver_id", "constructor_id", "best_lap_s", "session_code", "gap_to_session_best_s", "gap_to_teammate_s", "pace_rank"]],
                    on="driver_id",
                    how="left",
                    suffixes=("", "_one_lap"),
                )
            if not form_for_race.empty:
                merged = merged.merge(
                    form_for_race[
                        [
                            "driver_id",
                            "constructor_id",
                            "session_completeness",
                            "recent_pace_rank",
                            "reliability_index",
                            "weather_risk_index",
                            "teammate_delta_s",
                        ]
                    ],
                    on="driver_id",
                    how="left",
                    suffixes=("", "_form"),
                )
            if not current_predictions.empty:
                merged = merged.merge(
                    current_predictions[current_predictions["race_id"] == race_id][["driver_id", "projected_finish"]],
                    on="driver_id",
                    how="left",
                )
            if not weather_for_race.empty:
                merged["weather_risk_index"] = float(weather_for_race["weather_risk_index"].iloc[0])

            constructor_fallback = pd.Series(pd.NA, index=merged.index, dtype="object")
            if "constructor_id_one_lap" in merged.columns:
                constructor_fallback = constructor_fallback.fillna(merged["constructor_id_one_lap"])
            if "constructor_id_form" in merged.columns:
                constructor_fallback = constructor_fallback.fillna(merged["constructor_id_form"])
            constructor_fallback = constructor_fallback.fillna(
                merged["driver_id"].apply(fallback_constructor_for_driver)
            )
            merged["constructor_id"] = optional_series(merged, "constructor_id").fillna(constructor_fallback)
            merged["session_completeness"] = pd.to_numeric(optional_series(merged, "session_completeness"), errors="coerce").fillna(
                pace_for_race.groupby("driver_id")["session_code"].nunique()
            ).fillna(0)
            merged["one_lap_pace_s"] = pd.to_numeric(optional_series(merged, "best_lap_s"), errors="coerce")
            merged["one_lap_session_code"] = optional_series(merged, "session_code")
            merged["gap_to_best_s"] = (
                pd.to_numeric(optional_series(merged, "gap_to_best_s"), errors="coerce")
                .fillna(pd.to_numeric(optional_series(merged, "gap_to_session_best_s"), errors="coerce"))
            )
            merged["teammate_delta_s"] = (
                pd.to_numeric(optional_series(merged, "teammate_delta_s"), errors="coerce")
                .fillna(pd.to_numeric(optional_series(merged, "gap_to_teammate_s"), errors="coerce"))
            )
            merged["reliability_index"] = pd.to_numeric(optional_series(merged, "reliability_index"), errors="coerce").fillna(
                55 + merged["session_completeness"].clip(lower=0, upper=4) * 10
            )
            merged["weather_risk_index"] = pd.to_numeric(optional_series(merged, "weather_risk_index"), errors="coerce").fillna(0)
            merged["recent_pace_rank"] = pd.to_numeric(optional_series(merged, "recent_pace_rank"), errors="coerce").fillna(
                pd.to_numeric(optional_series(merged, "pace_rank"), errors="coerce")
            )
            merged["signal_confidence"] = pd.to_numeric(optional_series(merged, "signal_confidence"), errors="coerce").fillna(
                (merged["session_completeness"].clip(lower=0, upper=4) / 4)
            )
            merged["representative_long_run_pace_s"] = pd.to_numeric(
                optional_series(merged, "representative_long_run_pace_s"),
                errors="coerce",
            )
            merged["degradation_per_lap_s"] = pd.to_numeric(
                optional_series(merged, "degradation_per_lap_s"),
                errors="coerce",
            )

            long_run_signal = scale_lower_better(merged["representative_long_run_pace_s"]).fillna(0.5)
            one_lap_signal = scale_lower_better(merged["one_lap_pace_s"]).fillna(0.5)
            reliability_signal = scale_higher_better(merged["reliability_index"]).fillna(0.5)
            degradation_signal = scale_lower_better(merged["degradation_per_lap_s"]).fillna(0.5)
            merged["readiness_score"] = (
                long_run_signal * 0.35
                + one_lap_signal * 0.25
                + degradation_signal * 0.15
                + reliability_signal * 0.15
                + merged["signal_confidence"].fillna(0.4) * 0.10
                - (merged["weather_risk_index"].fillna(0) / 100) * 0.08
            ).round(6)
            readiness_rank = merged["readiness_score"].rank(method="dense", ascending=False)
            merged["overperforming_delta"] = (
                pd.to_numeric(merged.get("projected_finish"), errors="coerce").fillna(readiness_rank) - readiness_rank
            ).round(3)
            merged["season"] = int(race_row["season"])
            merged["round"] = int(race_row["round"])
            merged["race_id"] = race_id
            merged["id"] = merged.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
            merged["source_label"] = "race_week_driver_features_v1"
            driver_feature_rows.append(
                merged[
                    [
                        "id",
                        "season",
                        "round",
                        "race_id",
                        "driver_id",
                        "constructor_id",
                        "session_completeness",
                        "representative_long_run_pace_s",
                        "degradation_per_lap_s",
                        "one_lap_pace_s",
                        "one_lap_session_code",
                        "recent_pace_rank",
                        "gap_to_best_s",
                        "teammate_delta_s",
                        "reliability_index",
                        "weather_risk_index",
                        "readiness_score",
                        "signal_confidence",
                        "overperforming_delta",
                        "projected_finish",
                        "source_label",
                    ]
                ].rename(columns={"representative_long_run_pace_s": "fp2_long_run_pace_s", "degradation_per_lap_s": "fp2_degradation_s_per_lap"})
            )

        if driver_feature_rows:
            driver_features = pd.concat(driver_feature_rows, ignore_index=True)

    if driver_features.empty and not current_predictions.empty and not race_week_context.empty:
        active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()
        fallback_rows: list[dict[str, Any]] = []
        for _, race_row in active_races.iterrows():
            race_id = str(race_row["race_id"])
            prediction_rows = current_predictions[current_predictions["race_id"] == race_id].copy().sort_values("projected_finish").reset_index(drop=True)
            if prediction_rows.empty:
                continue
            score_signal = scale_higher_better(prediction_rows["predicted_score"]) if "predicted_score" in prediction_rows.columns else scale_lower_better(prediction_rows["projected_finish"])
            for index, (_, prediction_row) in enumerate(prediction_rows.iterrows(), start=1):
                fallback_rows.append(
                    {
                        "id": f"{race_id}|{prediction_row['driver_id']}",
                        "season": int(race_row["season"]),
                        "round": int(race_row["round"]),
                        "race_id": race_id,
                        "driver_id": prediction_row["driver_id"],
                        "constructor_id": prediction_row["constructor_id"],
                        "session_completeness": 0,
                        "fp2_long_run_pace_s": None,
                        "fp2_degradation_s_per_lap": None,
                        "one_lap_pace_s": None,
                        "one_lap_session_code": None,
                        "recent_pace_rank": index,
                        "gap_to_best_s": None,
                        "teammate_delta_s": None,
                        "reliability_index": 70,
                        "weather_risk_index": 0,
                        "readiness_score": round(float(score_signal.iloc[index - 1]), 6),
                        "signal_confidence": 0.25,
                        "overperforming_delta": 0.0,
                        "projected_finish": prediction_row["projected_finish"],
                        "source_label": "race_week_driver_features_prediction_fallback_v1",
                    }
                )
        driver_features = pd.DataFrame(fallback_rows)

    constructor_features = pd.DataFrame()
    if not driver_features.empty:
        constructor_features = (
            driver_features.groupby(["season", "round", "race_id", "constructor_id"], dropna=False)
            .agg(
                two_car_long_run_pace_s=("fp2_long_run_pace_s", "mean"),
                two_car_one_lap_pace_s=("one_lap_pace_s", "mean"),
                degradation_index=("fp2_degradation_s_per_lap", "mean"),
                reliability_index=("reliability_index", "mean"),
                weather_risk_index=("weather_risk_index", "mean"),
                readiness_score=("readiness_score", "mean"),
                signal_confidence=("signal_confidence", "mean"),
            )
            .reset_index()
        )
        constructor_features["id"] = constructor_features.apply(lambda row: f"{row['race_id']}|{row['constructor_id']}", axis=1)
        constructor_features["source_label"] = "race_week_constructor_features_v1"

    readiness_summary = pd.DataFrame()
    if not driver_features.empty:
        readiness_summary = driver_features.copy()
        readiness_summary["readiness_rank"] = readiness_summary.groupby("race_id")["readiness_score"].rank(method="dense", ascending=False).astype(int)
        readiness_summary["rationale"] = readiness_summary.apply(
            lambda row: f"Readiness combines long-run pace, one-lap pace, tyre degradation, reliability, and signal coverage for {row['driver_id']}.",
            axis=1,
        )
        readiness_summary = readiness_summary[
            ["id", "season", "round", "race_id", "driver_id", "constructor_id", "readiness_score", "signal_confidence", "readiness_rank", "rationale", "source_label"]
        ]
        readiness_summary["source_label"] = "race_week_readiness_v1"

    standings_context = pd.DataFrame()
    if not race_week_context.empty:
        rows: list[dict[str, Any]] = []
        next_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])]
        for _, race_row in next_races.iterrows():
            target_race_id = str(race_row["race_id"])
            source_race_id = str(race_row.get("latest_completed_race_id") or "")
            if source_race_id:
                for _, standing in driver_standings[driver_standings["race_id"] == source_race_id].iterrows():
                    rows.append(
                        {
                            "id": f"{target_race_id}|driver|{standing['driver_id']}",
                            "season": int(race_row["season"]),
                            "round": int(race_row["round"]),
                            "race_id": target_race_id,
                            "entity_type": "driver",
                            "entity_id": standing["driver_id"],
                            "constructor_id": standing["constructor_id"],
                            "standing_position": standing["standing_position"],
                            "points": standing["points"],
                            "wins": standing["wins"],
                            "source_race_id": source_race_id,
                            "source_label": "race_week_standings_context_v1",
                        }
                    )
                for _, standing in constructor_standings[constructor_standings["race_id"] == source_race_id].iterrows():
                    rows.append(
                        {
                            "id": f"{target_race_id}|constructor|{standing['constructor_id']}",
                            "season": int(race_row["season"]),
                            "round": int(race_row["round"]),
                            "race_id": target_race_id,
                            "entity_type": "constructor",
                            "entity_id": standing["constructor_id"],
                            "constructor_id": standing["constructor_id"],
                            "standing_position": standing["standing_position"],
                            "points": standing["points"],
                            "wins": standing["wins"],
                            "source_race_id": source_race_id,
                            "source_label": "race_week_standings_context_v1",
                        }
                    )
        standings_context = pd.DataFrame(rows)

    storylines = pd.DataFrame()
    if not driver_features.empty:
        driver_name_map = dict(zip(drivers["id"], drivers["full_name"]))
        constructor_name_map = dict(zip(constructors["id"], constructors["name"]))
        rows: list[dict[str, Any]] = []
        for race_id, frame in driver_features.groupby("race_id", dropna=False):
            season = int(frame["season"].iloc[0])
            round_number = int(frame["round"].iloc[0])
            top_driver = frame.sort_values("readiness_score", ascending=False).iloc[0]
            rows.append(
                {
                    "id": f"{race_id}|headline|pace",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "entity_type": "driver",
                    "entity_id": top_driver["driver_id"],
                    "storyline_type": "long_run_leader",
                    "priority_rank": 1,
                    "headline": f"{driver_name_map.get(top_driver['driver_id'], top_driver['driver_id'])} leads the early race read",
                    "body": "The strongest combined signal is coming from long-run pace, one-lap competitiveness, and reliability coverage.",
                    "confidence_band": "high" if float(top_driver["signal_confidence"]) >= 0.7 else "medium",
                    "signal_confidence": top_driver["signal_confidence"],
                    "source_label": "race_week_storyline_v1",
                }
            )
            if frame["fp2_degradation_s_per_lap"].notna().any():
                worst_deg = frame.sort_values("fp2_degradation_s_per_lap", ascending=False).iloc[0]
                rows.append(
                    {
                        "id": f"{race_id}|headline|deg",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "entity_type": "constructor",
                        "entity_id": worst_deg["constructor_id"],
                        "storyline_type": "degradation_warning",
                        "priority_rank": 2,
                        "headline": f"{constructor_name_map.get(worst_deg['constructor_id'], worst_deg['constructor_id'])} is carrying the highest tyre fade warning",
                        "body": "Degradation is currently the weakest part of the weekend signal for this team.",
                        "confidence_band": "medium",
                        "signal_confidence": worst_deg["signal_confidence"],
                        "source_label": "race_week_storyline_v1",
                    }
                )
            weather_for_race = weather_risk[weather_risk["race_id"] == race_id] if not weather_risk.empty else pd.DataFrame()
            if not weather_for_race.empty:
                weather_row = weather_for_race.iloc[0]
                rows.append(
                    {
                        "id": f"{race_id}|headline|weather",
                        "season": season,
                        "round": round_number,
                        "race_id": race_id,
                        "entity_type": "race",
                        "entity_id": race_id,
                        "storyline_type": "weather_risk",
                        "priority_rank": 3,
                        "headline": "Weather volatility is part of the weekend read",
                        "body": f"Weather risk is tracking at {difficulty_band(float(weather_row['weather_risk_index']))} intensity based on current rainfall, wind, and track-temperature movement.",
                        "confidence_band": "medium",
                        "signal_confidence": 0.6,
                        "source_label": "race_week_storyline_v1",
                    }
                )
        storylines = pd.DataFrame(rows)

    race_week_overview = pd.DataFrame()
    if not race_week_context.empty:
        circuit_lookup = circuits.set_index("id") if not circuits.empty else pd.DataFrame()
        rows: list[dict[str, Any]] = []
        for _, row in race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].iterrows():
            race_id = str(row["race_id"])
            circuit_id = row["circuit_id"]
            circuit = circuit_lookup.loc[circuit_id] if not circuit_lookup.empty and circuit_id in circuit_lookup.index else None
            weather_row = weather_risk[weather_risk["race_id"] == race_id].head(1)
            driver_frame = driver_features[driver_features["race_id"] == race_id] if not driver_features.empty else pd.DataFrame()
            strategy_score = 0.0
            if circuit is not None:
                strategy_score += float(circuit.get("tire_degradation_bias") or 0) * 6
                strategy_score += max(0, 10 - float(circuit.get("overtake_difficulty") or 5)) * 4
            if not weather_row.empty:
                strategy_score += float(weather_row["weather_risk_index"].iloc[0]) * 0.4
            rows.append(
                {
                    "id": race_id,
                    "season": int(row["season"]),
                    "round": int(row["round"]),
                    "race_id": race_id,
                    "race_name": row["race_name"],
                    "circuit_id": circuit_id,
                    "circuit_name": circuit["name"] if circuit is not None else circuit_id,
                    "scheduled_at": row["scheduled_at"],
                    "status": row["status"],
                    "sprint_weekend": str(row.get("sprint_weekend", "")).lower() in {"true", "1"},
                    "latest_completed_race_id": row.get("latest_completed_race_id"),
                    "archetype_label": classify_circuit(circuit) if circuit is not None else "Balanced circuit",
                    "strategy_difficulty": difficulty_band(strategy_score),
                    "weather_risk_index": float(weather_row["weather_risk_index"].iloc[0]) if not weather_row.empty else 0.0,
                    "signal_confidence": float(driver_frame["signal_confidence"].mean()) if not driver_frame.empty else 0.0,
                    "source_label": "race_week_overview_v1",
                }
            )
        race_week_overview = pd.DataFrame(rows)

    sourced_storylines = build_sourced_weekend_storylines(race_week_overview)
    if not sourced_storylines.empty:
        storylines = sourced_storylines

    driver_board = pd.DataFrame()
    if not driver_features.empty:
        driver_name_map = dict(zip(drivers["id"], drivers["full_name"]))
        constructor_name_map = dict(zip(constructors["id"], constructors["name"]))
        one_lap_best = driver_features.groupby("race_id")["one_lap_pace_s"].transform("min")
        driver_board = driver_features.copy()
        driver_board["gap_to_long_run_best_s"] = pd.to_numeric(driver_board["fp2_long_run_pace_s"], errors="coerce") - driver_board.groupby("race_id")["fp2_long_run_pace_s"].transform("min")
        driver_board["gap_to_one_lap_best_s"] = pd.to_numeric(driver_board["one_lap_pace_s"], errors="coerce") - one_lap_best
        driver_board["summary"] = driver_board.apply(
            lambda row: f"{driver_name_map.get(row['driver_id'], row['driver_id'])} is carrying a {difficulty_band(float(row['signal_confidence']) * 100).lower()} confidence weekend read for {constructor_name_map.get(row['constructor_id'], row['constructor_id'])}.",
            axis=1,
        )
        driver_board["driver_name"] = driver_board["driver_id"].map(driver_name_map).fillna(driver_board["driver_id"])
        driver_board["constructor_name"] = driver_board["constructor_id"].map(constructor_name_map).fillna(driver_board["constructor_id"])
        driver_board["source_label"] = "race_week_driver_board_v1"
        driver_board = driver_board[
            [
                "id",
                "season",
                "round",
                "race_id",
                "driver_id",
                "constructor_id",
                "driver_name",
                "constructor_name",
                "fp2_long_run_pace_s",
                "gap_to_long_run_best_s",
                "one_lap_pace_s",
                "gap_to_one_lap_best_s",
                "fp2_degradation_s_per_lap",
                "readiness_score",
                "signal_confidence",
                "projected_finish",
                "summary",
                "source_label",
            ]
        ].rename(columns={"fp2_long_run_pace_s": "long_run_pace_s", "fp2_degradation_s_per_lap": "degradation_s_per_lap"})

    constructor_board = pd.DataFrame()
    if not constructor_features.empty:
        constructor_name_map = dict(zip(constructors["id"], constructors["name"]))
        constructor_board = constructor_features.copy()
        constructor_board["summary"] = constructor_board.apply(
            lambda row: f"{constructor_name_map.get(row['constructor_id'], row['constructor_id'])} is carrying a {difficulty_band(float(row['signal_confidence']) * 100).lower()} confidence team signal this week.",
            axis=1,
        )
        constructor_board["constructor_name"] = constructor_board["constructor_id"].map(constructor_name_map).fillna(constructor_board["constructor_id"])
        constructor_board["source_label"] = "race_week_constructor_board_v1"
        constructor_board = constructor_board[
            [
                "id",
                "season",
                "round",
                "race_id",
                "constructor_id",
                "constructor_name",
                "two_car_long_run_pace_s",
                "two_car_one_lap_pace_s",
                "degradation_index",
                "readiness_score",
                "signal_confidence",
                "summary",
                "source_label",
            ]
        ].rename(columns={"two_car_long_run_pace_s": "long_run_pace_s", "two_car_one_lap_pace_s": "one_lap_pace_s"})

    strategy_view = pd.DataFrame()
    if not strategy_baselines.empty:
        strategy_view = strategy_baselines.copy()
        strategy_view["source_label"] = strategy_view.get("source_label", "race_week_strategy_v1")
    elif not driver_features.empty:
        strategy_view = driver_features[
            ["season", "round", "race_id", "driver_id", "constructor_id", "fp2_degradation_s_per_lap", "signal_confidence"]
        ].copy()
        strategy_view["recommended_stop_count"] = strategy_view["fp2_degradation_s_per_lap"].apply(lambda value: 2 if pd.notna(value) and float(value) >= 0.08 else 1)
        strategy_view["preferred_primary_compound"] = None
        strategy_view["preferred_secondary_compound"] = None
        strategy_view["pit_window_start_lap"] = 16
        strategy_view["pit_window_end_lap"] = 24
        strategy_view["degradation_risk"] = pd.to_numeric(strategy_view["fp2_degradation_s_per_lap"], errors="coerce").fillna(0) * 100
        strategy_view["strategy_confidence"] = strategy_view["signal_confidence"]
        strategy_view["rationale"] = "Fallback strategy baseline derived from current long-run degradation signal."
        strategy_view["id"] = strategy_view.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
        strategy_view["source_label"] = "race_week_strategy_v1"
        strategy_view = strategy_view[
            [
                "id",
                "season",
                "round",
                "race_id",
                "driver_id",
                "constructor_id",
                "recommended_stop_count",
                "preferred_primary_compound",
                "preferred_secondary_compound",
                "pit_window_start_lap",
                "pit_window_end_lap",
                "degradation_risk",
                "strategy_confidence",
                "rationale",
                "source_label",
            ]
        ]

    return {
        "session_pace_summary": session_pace,
        "fp2_long_run_summary": fp2_long_run,
        "stint_degradation_summary": stint_degradation,
        "weather_risk_summary": weather_risk,
        "driver_race_week_features": driver_features,
        "constructor_race_week_features": constructor_features,
        "weekend_readiness_summary": readiness_summary,
        "standings_context_snapshot": standings_context,
        "race_week_storylines": storylines,
        "race_week_overview": race_week_overview,
        "race_week_driver_board": driver_board,
        "race_week_constructor_board": constructor_board,
        "race_week_strategy": strategy_view,
    }


def build_race_week_intelligence_layers(
    *,
    canonical: dict[str, pd.DataFrame],
    races: pd.DataFrame,
    circuits: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
    qualifying_results: pd.DataFrame,
    race_results: pd.DataFrame,
    prediction_snapshots: pd.DataFrame,
    fastf1_predictions: pd.DataFrame,
    strategy_profiles: pd.DataFrame,
    race_week_context: pd.DataFrame,
    strategy_baselines: pd.DataFrame,
) -> dict[str, pd.DataFrame]:
    active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()
    if active_races.empty:
        empty = pd.DataFrame()
        return {
            "session_features": empty,
            "driver_features": empty,
            "constructor_features": empty,
            "race_context_features": empty,
            "driver_signals": empty,
            "constructor_signals": empty,
            "race_context_signals": empty,
            "race_week_confidence": empty,
            "session_year_over_year_deltas": empty,
            "qualifying_driver_deltas": empty,
            "spain_qualifying_prediction": empty,
        }

    session_pace = canonical["session_pace_summary"].copy()
    session_laps = canonical["session_laps"].copy()
    if not session_laps.empty:
        session_laps["lap_time_s"] = pd.to_numeric(session_laps["lap_time_s"], errors="coerce")

    races = races.copy()
    races["scheduled_at"] = pd.to_datetime(races["scheduled_at"], utc=True, errors="coerce")
    circuits = circuits.copy()
    if not circuits.empty:
        circuits["archetype_label"] = circuits.apply(classify_circuit, axis=1)

    session_year_over_year_deltas = build_session_year_over_year_deltas(
        session_pace=session_pace,
        races=races,
        active_races=active_races,
    )
    qualifying_driver_deltas = build_qualifying_driver_deltas(
        session_pace=session_pace,
        races=races,
        active_races=active_races,
        session_year_over_year_deltas=session_year_over_year_deltas,
    )
    avg_quali_delta_lookup: dict[tuple[str, str], float] = {}
    if not qualifying_driver_deltas.empty:
        driver_gap_rows = qualifying_driver_deltas[qualifying_driver_deltas["delta_type"].astype(str).eq("driver_gap")].copy()
        driver_gap_rows["avg_quali_yoy_delta_s"] = pd.to_numeric(driver_gap_rows["avg_quali_yoy_delta_s"], errors="coerce")
        avg_quali_delta_lookup = {
            (str(row["race_id"]), str(row["driver_id"])): float(row["avg_quali_yoy_delta_s"])
            for _, row in driver_gap_rows.dropna(subset=["avg_quali_yoy_delta_s"]).iterrows()
        }

    driver_name_map = dict(zip(drivers["id"], drivers["full_name"])) if not drivers.empty else {}
    constructor_name_map = dict(zip(constructors["id"], constructors["name"])) if not constructors.empty else {}
    prediction_frames = [
        frame.copy()
        for frame in [fastf1_predictions, prediction_snapshots]
        if not frame.empty
    ]
    current_predictions = pd.concat(prediction_frames, ignore_index=True) if prediction_frames else pd.DataFrame()
    if not current_predictions.empty:
        current_predictions = current_predictions.copy()
        current_predictions["driver_id"] = current_predictions["driver_id"].astype(str)
        if "constructor_id" in current_predictions.columns:
            current_predictions["constructor_id"] = current_predictions["constructor_id"].astype(str)
        if "projected_finish" in current_predictions.columns:
            current_predictions["projected_finish"] = pd.to_numeric(current_predictions["projected_finish"], errors="coerce")
        if "predicted_score" in current_predictions.columns:
            current_predictions["predicted_score"] = pd.to_numeric(current_predictions["predicted_score"], errors="coerce")

    session_feature_rows: list[dict[str, Any]] = []
    driver_feature_rows: list[dict[str, Any]] = []
    constructor_feature_rows: list[dict[str, Any]] = []
    race_context_rows: list[dict[str, Any]] = []
    driver_signal_rows: list[dict[str, Any]] = []
    constructor_signal_rows: list[dict[str, Any]] = []
    race_context_signal_rows: list[dict[str, Any]] = []
    confidence_rows: list[dict[str, Any]] = []

    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        season = int(active_race["season"])
        round_number = int(active_race["round"])
        circuit_id = str(active_race["circuit_id"])

        circuit_row = circuits[circuits["id"] == circuit_id].head(1)
        circuit = circuit_row.iloc[0] if not circuit_row.empty else None
        archetype_label = classify_circuit(circuit) if circuit is not None else "Balanced circuit"
        high_speed_bias = float(circuit.get("high_speed_bias") or 5) if circuit is not None else 5.0
        overtake_difficulty = float(circuit.get("overtake_difficulty") or 5) if circuit is not None else 5.0
        degradation_bias = float(circuit.get("tire_degradation_bias") or 5) if circuit is not None else 5.0

        historical_races = races[
            (races["season"] < season) | ((races["season"] == season) & (races["round"] < round_number))
        ].sort_values(["season", "round"])
        historical_race_ids = historical_races.tail(10)["id"].astype(str).tolist()
        same_circuit_race_ids = historical_races[historical_races["circuit_id"] == circuit_id]["id"].astype(str).tolist()
        similar_circuit_ids = circuits[circuits["archetype_label"] == archetype_label]["id"].astype(str).tolist() if not circuits.empty else []
        similar_track_race_ids = historical_races[historical_races["circuit_id"].isin(similar_circuit_ids)]["id"].astype(str).tolist()

        race_pace = session_pace[session_pace["race_id"] == race_id].copy()
        race_pace["best_lap_s"] = pd.to_numeric(race_pace["best_lap_s"], errors="coerce")
        race_pace["long_run_lap_s"] = pd.to_numeric(race_pace["long_run_lap_s"], errors="coerce")
        race_pace["gap_to_teammate_s"] = pd.to_numeric(race_pace["gap_to_teammate_s"], errors="coerce")
        historical_pace = session_pace[session_pace["race_id"].isin(historical_race_ids)].copy()
        historical_pace["best_lap_s"] = pd.to_numeric(historical_pace["best_lap_s"], errors="coerce")
        historical_pace["long_run_lap_s"] = pd.to_numeric(historical_pace["long_run_lap_s"], errors="coerce")
        historical_pace["representative_lap_s"] = pd.to_numeric(historical_pace["representative_lap_s"], errors="coerce")

        fp2_rows = race_pace[race_pace["session_code"] == "FP2"].copy()
        q_rows = race_pace[race_pace["session_code"] == "Q"].copy()
        fp1_rows = race_pace[race_pace["session_code"] == "FP1"].copy()
        fp3_rows = race_pace[race_pace["session_code"] == "FP3"].copy()

        strategy_rows = strategy_baselines[strategy_baselines["race_id"] == race_id].copy() if not strategy_baselines.empty else pd.DataFrame()
        strategy_profile_rows = strategy_profiles[strategy_profiles["race_id"].isin(historical_race_ids)].copy() if not strategy_profiles.empty else pd.DataFrame()

        active_driver_ids = pd.unique(race_pace["driver_id"].dropna()) if not race_pace.empty else []
        active_driver_ids = [str(driver_id) for driver_id in active_driver_ids if str(driver_id)]
        prediction_rows = current_predictions[current_predictions["race_id"] == race_id].copy() if not current_predictions.empty else pd.DataFrame()
        if active_driver_ids and "driver_id" in prediction_rows.columns:
            active_driver_ids = list(dict.fromkeys(active_driver_ids + prediction_rows["driver_id"].astype(str).dropna().tolist()))
        elif not prediction_rows.empty and "driver_id" in prediction_rows.columns:
            active_driver_ids = prediction_rows["driver_id"].astype(str).dropna().tolist()

        for driver_id in active_driver_ids:
            driver_session_rows = race_pace[race_pace["driver_id"].astype(str) == driver_id]
            prediction_row = (
                prediction_rows[prediction_rows["driver_id"].astype(str) == driver_id].head(1)
                if "driver_id" in prediction_rows.columns
                else pd.DataFrame()
            )
            prediction_projected_finish = pd.to_numeric(prediction_row["projected_finish"], errors="coerce").iloc[0] if not prediction_row.empty and "projected_finish" in prediction_row.columns else None
            prediction_score = pd.to_numeric(prediction_row["predicted_score"], errors="coerce").iloc[0] if not prediction_row.empty and "predicted_score" in prediction_row.columns else None
            constructor_id = str(driver_session_rows["constructor_id"].dropna().iloc[0]) if not driver_session_rows["constructor_id"].dropna().empty else ""
            if not constructor_id and not prediction_row.empty and "constructor_id" in prediction_row.columns:
                constructor_id = str(prediction_row["constructor_id"].dropna().iloc[0]) if not prediction_row["constructor_id"].dropna().empty else ""
            fp1_pace = mean_or_none(fp1_rows[fp1_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            fp2_pace = mean_or_none(fp2_rows[fp2_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            fp3_pace = mean_or_none(fp3_rows[fp3_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            quali_pace = mean_or_none(q_rows[q_rows["driver_id"].astype(str) == driver_id]["best_lap_s"])
            fp2_long_run_pace = mean_or_none(fp2_rows[fp2_rows["driver_id"].astype(str) == driver_id]["long_run_lap_s"])
            trend_reference = quali_pace or fp3_pace or fp2_pace
            trend_delta = (fp1_pace - trend_reference) if fp1_pace is not None and trend_reference is not None else None
            fp2_laps = session_laps[
                (session_laps["race_id"] == race_id)
                & (session_laps["driver_id"].astype(str) == driver_id)
                & (session_laps["session_id"].astype(str).str.endswith("|FP2"))
                & (session_laps["is_accurate"].fillna(False))
                & (~session_laps["deleted"].fillna(False))
            ]
            lap_variance_s = float(fp2_laps["lap_time_s"].std()) if not fp2_laps.empty and fp2_laps["lap_time_s"].notna().sum() > 1 else None
            session_completeness = sum(value is not None for value in [fp1_pace, fp2_pace, fp3_pace, quali_pace])
            signal_confidence = clamp01(len(fp2_laps) / 12, default=0.0)
            if session_completeness == 0 and prediction_projected_finish is not None:
                signal_confidence = 0.25

            session_feature_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "fp1_pace_s": fp1_pace,
                    "fp2_pace_s": fp2_pace,
                    "fp3_pace_s": fp3_pace,
                    "quali_pace_s": quali_pace,
                    "fp2_long_run_pace_s": fp2_long_run_pace,
                    "lap_variance_s": lap_variance_s,
                    "session_trend_delta_s": trend_delta,
                    "session_completeness": session_completeness,
                    "signal_confidence": signal_confidence,
                    "source_label": "race_week_session_features_v1",
                }
            )

            historical_race_rows = historical_pace[
                (historical_pace["driver_id"].astype(str) == driver_id)
                & (historical_pace["session_code"] == "R")
            ].sort_values(["season", "round"]).tail(3)
            historical_quali_rows = historical_pace[
                (historical_pace["driver_id"].astype(str) == driver_id)
                & (historical_pace["session_code"] == "Q")
            ].sort_values(["season", "round"]).tail(3)
            recent_race_results = race_results[
                (race_results["driver_id"].astype(str) == driver_id)
                & (race_results["race_id"].isin(historical_race_ids))
            ].tail(5)
            recent_quali_results = qualifying_results[
                (qualifying_results["driver_id"].astype(str) == driver_id)
                & (qualifying_results["race_id"].isin(historical_race_ids))
            ].tail(5)
            affinity_rows = race_results[
                (race_results["driver_id"].astype(str) == driver_id)
                & (
                    race_results["race_id"].isin(same_circuit_race_ids)
                    | race_results["race_id"].isin(similar_track_race_ids)
                )
            ]

            avg_race_pace_s = mean_or_none(historical_race_rows["long_run_lap_s"].fillna(historical_race_rows["representative_lap_s"]))
            avg_finish_position_recent = mean_or_none(recent_race_results["finish_position"])
            avg_qualifying_position_recent = mean_or_none(recent_quali_results["position"])
            if avg_finish_position_recent is None and prediction_projected_finish is not None:
                avg_finish_position_recent = float(prediction_projected_finish)
            if avg_qualifying_position_recent is None and prediction_projected_finish is not None:
                avg_qualifying_position_recent = float(prediction_projected_finish)
            tyre_degradation_slope = mean_or_none(fp2_rows[fp2_rows["driver_id"].astype(str) == driver_id]["long_run_degradation_s"])
            consistency_score = (1 / max(lap_variance_s, 0.001)) if lap_variance_s is not None else None
            race_vs_quali_delta_s = (avg_race_pace_s - quali_pace) if avg_race_pace_s is not None and quali_pace is not None else None
            teammate_delta_s = mean_or_none(driver_session_rows["gap_to_teammate_s"])
            reliability_score = clamp01(1 - (recent_race_results["finish_status"].fillna("").astype(str).str.lower().ne("finished").mean() if not recent_race_results.empty else 0.2), default=0.5)
            track_affinity_score = clamp01(1 - (((mean_or_none(affinity_rows["finish_position"]) or 11) - 1) / 19), default=0.5)
            if consistency_score is None and prediction_score is not None:
                max_prediction_score = max(
                    float(current_predictions["predicted_score"].max())
                    if not current_predictions.empty
                    and "predicted_score" in current_predictions.columns
                    and current_predictions["predicted_score"].notna().any()
                    else 1.0,
                    1.0,
                )
                consistency_score = float(max(0.2, min(1.0, prediction_score / max_prediction_score)))
            if avg_race_pace_s is None and prediction_projected_finish is not None:
                avg_race_pace_s = float(88 + prediction_projected_finish * 0.24)
            if quali_pace is None and prediction_projected_finish is not None:
                quali_pace = float(80 + prediction_projected_finish * 0.12)
            if race_vs_quali_delta_s is None and avg_race_pace_s is not None and quali_pace is not None:
                race_vs_quali_delta_s = avg_race_pace_s - quali_pace
            if tyre_degradation_slope is None and prediction_projected_finish is not None:
                tyre_degradation_slope = float(0.045 + min(0.08, prediction_projected_finish * 0.0025))
            if teammate_delta_s is None:
                teammate_delta_s = 0.0
            avg_quali_yoy_delta_s = avg_quali_delta_lookup.get((race_id, driver_id))

            driver_feature_rows.append(
                {
                    "id": f"{race_id}|{driver_id}",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "driver_id": driver_id,
                    "constructor_id": constructor_id,
                    "avg_race_pace_s": avg_race_pace_s,
                    "fp2_long_run_pace_s": fp2_long_run_pace,
                    "lap_variance_s": lap_variance_s,
                    "consistency_score": consistency_score,
                    "quali_pace_s": quali_pace or mean_or_none(historical_quali_rows["best_lap_s"]),
                    "race_vs_quali_delta_s": race_vs_quali_delta_s,
                    "tyre_degradation_slope": tyre_degradation_slope,
                    "avg_finish_position_recent": avg_finish_position_recent,
                    "avg_qualifying_position_recent": avg_qualifying_position_recent,
                    "track_affinity_score": track_affinity_score,
                    "teammate_delta_s": teammate_delta_s,
                    "reliability_score": reliability_score,
                    "avg_quali_yoy_delta_s": avg_quali_yoy_delta_s,
                    "form_bias_score": 0.5,
                    "source_label": "race_week_driver_features_v2",
                }
            )

        driver_features = pd.DataFrame(driver_feature_rows)
        race_driver_features = driver_features[driver_features["race_id"] == race_id].copy() if not driver_features.empty else pd.DataFrame()
        if not race_driver_features.empty:
            constructor_frame = (
                race_driver_features.groupby(["season", "round", "race_id", "constructor_id"], dropna=False)
                .agg(
                    team_pace_s=("avg_race_pace_s", "mean"),
                    long_run_pace_s=("fp2_long_run_pace_s", "mean"),
                    quali_pace_s=("quali_pace_s", "mean"),
                    degradation_profile=("tyre_degradation_slope", "mean"),
                    reliability_score=("reliability_score", "mean"),
                    track_affinity_score=("track_affinity_score", "mean"),
                    avg_finish_position_recent=("avg_finish_position_recent", "mean"),
                )
                .reset_index()
            )
            constructor_strategy = strategy_rows.groupby("constructor_id", dropna=False).agg(
                strategy_tendency_score=("recommended_stop_count", "mean"),
                strategy_confidence=("strategy_confidence", "mean"),
            ).reset_index() if not strategy_rows.empty else pd.DataFrame(columns=["constructor_id", "strategy_tendency_score", "strategy_confidence"])
            constructor_frame = constructor_frame.merge(constructor_strategy, on="constructor_id", how="left")
            constructor_frame["strategy_tendency_score"] = pd.to_numeric(constructor_frame["strategy_tendency_score"], errors="coerce").fillna(1.5)
            constructor_frame["strategy_confidence"] = pd.to_numeric(constructor_frame["strategy_confidence"], errors="coerce").fillna(0.4)
            constructor_frame["team_pace_s"] = pd.to_numeric(constructor_frame["team_pace_s"], errors="coerce").fillna(pd.to_numeric(constructor_frame["quali_pace_s"], errors="coerce"))
            constructor_frame["long_run_pace_s"] = pd.to_numeric(constructor_frame["long_run_pace_s"], errors="coerce").fillna(pd.to_numeric(constructor_frame["team_pace_s"], errors="coerce"))
            constructor_frame["degradation_profile"] = pd.to_numeric(constructor_frame["degradation_profile"], errors="coerce").fillna(0.065)
            constructor_frame["id"] = constructor_frame.apply(lambda row: f"{row['race_id']}|{row['constructor_id']}", axis=1)
            constructor_frame["source_label"] = "race_week_constructor_features_v2"
            constructor_feature_rows.extend(constructor_frame.to_dict("records"))

        weather_risk_index = 0.0
        weather_for_race = canonical["session_weather"][canonical["session_weather"]["race_id"] == race_id].copy()
        if not weather_for_race.empty:
            rainfall_probability = float(weather_for_race["rainfall"].fillna(False).astype(bool).mean() * 100)
            weather_risk_index = float(min(100.0, rainfall_probability * 0.55 + pd.to_numeric(weather_for_race["wind_speed_mps"], errors="coerce").fillna(0).clip(upper=12).mean() * 2.5))
        safety_car_probability = max(0.0, min(100.0, (10 - overtake_difficulty) * 5.0 + degradation_bias * 2.0 + weather_risk_index * 0.3))
        strategic_complexity_score = max(0.0, min(100.0, degradation_bias * 6.0 + (10 - overtake_difficulty) * 4.0 + weather_risk_index * 0.4))
        race_context_rows.append(
            {
                "id": race_id,
                "season": season,
                "round": round_number,
                "race_id": race_id,
                "circuit_id": circuit_id,
                "archetype_label": archetype_label,
                "high_speed_bias": high_speed_bias,
                "overtake_difficulty": overtake_difficulty,
                "tire_degradation_bias": degradation_bias,
                "weather_risk_index": weather_risk_index,
                "safety_car_probability": safety_car_probability,
                "strategic_complexity_score": strategic_complexity_score,
                "source_label": "race_week_context_features_v1",
            }
        )

    session_features = pd.DataFrame(session_feature_rows)
    driver_features = pd.DataFrame(driver_feature_rows)
    constructor_features = pd.DataFrame(constructor_feature_rows)
    race_context_features = pd.DataFrame(race_context_rows)

    if not driver_features.empty:
        form_components = (
            scale_lower_better(driver_features["avg_finish_position_recent"]).fillna(0.5) * 0.4
            + scale_lower_better(driver_features["avg_race_pace_s"]).fillna(0.5) * 0.4
            + scale_lower_better(driver_features["avg_quali_yoy_delta_s"]).fillna(0.5) * 0.2
        )
        driver_features["form_bias_score"] = form_components.round(6)
        driver_signals = driver_features[["id", "season", "round", "race_id", "driver_id", "constructor_id"]].copy()
        driver_signals["form_signal"] = (
            scale_lower_better(driver_features["avg_finish_position_recent"]).fillna(0.5) * 0.4
            + scale_lower_better(driver_features["avg_race_pace_s"]).fillna(0.5) * 0.6
        ).round(6)
        driver_signals["consistency_signal"] = scale_higher_better(driver_features["consistency_score"]).fillna(0.5).round(6)
        racecraft_source = pd.to_numeric(driver_features["avg_qualifying_position_recent"], errors="coerce") - pd.to_numeric(driver_features["avg_finish_position_recent"], errors="coerce")
        driver_signals["racecraft_signal"] = scale_higher_better(racecraft_source).fillna(0.5).round(6)
        driver_signals["fp2_race_pace_signal"] = scale_lower_better(driver_features["fp2_long_run_pace_s"]).fillna(0.5).round(6)
        driver_signals["quali_signal"] = scale_lower_better(driver_features["quali_pace_s"]).fillna(0.5).round(6)
        driver_signals["quali_delta_signal"] = scale_lower_better(driver_features["avg_quali_yoy_delta_s"]).fillna(0.5).round(6)
        driver_signals["form_bias_signal"] = pd.to_numeric(driver_features["form_bias_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        driver_signals["trend_signal"] = scale_higher_better(session_features.set_index("id").reindex(driver_signals["id"])["session_trend_delta_s"]).fillna(0.5).round(6)
        driver_signals["track_affinity_signal"] = pd.to_numeric(driver_features["track_affinity_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        driver_signals["overall_signal"] = (
            driver_signals["form_signal"].fillna(0.5) * 0.14
            + driver_signals["consistency_signal"].fillna(0.5) * 0.14
            + driver_signals["racecraft_signal"].fillna(0.5) * 0.12
            + driver_signals["fp2_race_pace_signal"].fillna(0.5) * 0.24
            + driver_signals["quali_signal"].fillna(0.5) * 0.16
            + driver_signals["quali_delta_signal"].fillna(0.5) * 0.04
            + driver_signals["form_bias_signal"].fillna(0.5) * 0.02
            + driver_signals["trend_signal"].fillna(0.5) * 0.08
            + driver_signals["track_affinity_signal"].fillna(0.5) * 0.06
        ).round(6)
        driver_signals["source_label"] = "race_week_driver_signals_v1"
    else:
        driver_signals = pd.DataFrame()

    if not constructor_features.empty:
        constructor_signals = constructor_features[["id", "season", "round", "race_id", "constructor_id"]].copy()
        constructor_signals["pace_strength_signal"] = (
            scale_lower_better(constructor_features["long_run_pace_s"]).fillna(0.5) * 0.55
            + scale_lower_better(constructor_features["quali_pace_s"]).fillna(0.5) * 0.45
        ).round(6)
        constructor_signals["degradation_strength_signal"] = scale_lower_better(constructor_features["degradation_profile"]).fillna(0.5).round(6)
        constructor_signals["reliability_signal"] = pd.to_numeric(constructor_features["reliability_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        constructor_signals["strategy_signal"] = scale_higher_better(constructor_features["strategy_confidence"]).fillna(0.5).round(6)
        constructor_signals["track_affinity_signal"] = pd.to_numeric(constructor_features["track_affinity_score"], errors="coerce").fillna(0.5).clip(lower=0, upper=1).round(6)
        constructor_signals["overall_signal"] = (
            constructor_signals["pace_strength_signal"].fillna(0.5) * 0.34
            + constructor_signals["degradation_strength_signal"].fillna(0.5) * 0.20
            + constructor_signals["reliability_signal"].fillna(0.5) * 0.20
            + constructor_signals["strategy_signal"].fillna(0.5) * 0.16
            + constructor_signals["track_affinity_signal"].fillna(0.5) * 0.10
        ).round(6)
        constructor_signals["source_label"] = "race_week_constructor_signals_v1"
    else:
        constructor_signals = pd.DataFrame()

    if not race_context_features.empty:
        race_context_signals = race_context_features[["id", "season", "round", "race_id"]].copy()
        race_context_signals["strategic_complexity_signal"] = pd.to_numeric(race_context_features["strategic_complexity_score"], errors="coerce").fillna(50) / 100
        race_context_signals["weather_signal"] = pd.to_numeric(race_context_features["weather_risk_index"], errors="coerce").fillna(0) / 100
        race_context_signals["safety_car_signal"] = pd.to_numeric(race_context_features["safety_car_probability"], errors="coerce").fillna(0) / 100
        race_context_signals["overtaking_signal"] = (10 - pd.to_numeric(race_context_features["overtake_difficulty"], errors="coerce").fillna(5)) / 10
        race_context_signals["high_speed_signal"] = pd.to_numeric(race_context_features["high_speed_bias"], errors="coerce").fillna(5) / 10
        race_context_signals["source_label"] = "race_week_context_signals_v1"
    else:
        race_context_signals = pd.DataFrame()

    if not driver_signals.empty:
        signal_matrix = driver_signals[["form_signal", "consistency_signal", "racecraft_signal", "fp2_race_pace_signal", "quali_signal", "quali_delta_signal", "form_bias_signal", "trend_signal", "track_affinity_signal"]]
        completeness_score = (
            pd.to_numeric(session_features.set_index("id").reindex(driver_signals["id"])["session_completeness"], errors="coerce")
            .fillna(0)
            .reset_index(drop=True)
            / 4
        )
        agreement_score = (1 - signal_matrix.std(axis=1).fillna(0).clip(lower=0, upper=0.5) / 0.5).clip(lower=0, upper=1).reset_index(drop=True)
        sample_score = (
            pd.to_numeric(session_features.set_index("id").reindex(driver_signals["id"])["signal_confidence"], errors="coerce")
            .fillna(0)
            .clip(lower=0, upper=1)
            .reset_index(drop=True)
        )
        strength_score = ((driver_signals["overall_signal"] - 0.5).abs() * 2).clip(lower=0, upper=1).reset_index(drop=True)
        confidence_score = (completeness_score * 0.35 + agreement_score * 0.30 + sample_score * 0.20 + strength_score * 0.15).round(6)
        driver_confidence = driver_signals[["race_id", "driver_id", "season", "round"]].copy()
        driver_confidence["id"] = driver_confidence.apply(lambda row: f"{row['race_id']}|driver|{row['driver_id']}", axis=1)
        driver_confidence["entity_type"] = "driver"
        driver_confidence["entity_id"] = driver_confidence["driver_id"]
        driver_confidence["completeness_score"] = completeness_score.values
        driver_confidence["agreement_score"] = agreement_score.values
        driver_confidence["sample_score"] = sample_score.values
        driver_confidence["strength_score"] = strength_score.values
        driver_confidence["confidence_score"] = confidence_score.values
        driver_confidence["confidence_band"] = driver_confidence["confidence_score"].apply(confidence_band)
        driver_confidence["rationale"] = driver_confidence["driver_id"].map(lambda driver_id: f"{driver_name_map.get(driver_id, driver_id)} confidence reflects session completeness, signal agreement, sample depth, and signal strength.")
        driver_confidence["source_label"] = "race_week_confidence_v1"
    else:
        driver_confidence = pd.DataFrame()

    if not constructor_signals.empty:
        c_signal_matrix = constructor_signals[["pace_strength_signal", "degradation_strength_signal", "reliability_signal", "strategy_signal", "track_affinity_signal"]]
        agreement_score = (1 - c_signal_matrix.std(axis=1).fillna(0).clip(lower=0, upper=0.5) / 0.5).clip(lower=0, upper=1).reset_index(drop=True)
        constructor_driver_counts = driver_features.groupby(["race_id", "constructor_id"], dropna=False)["driver_id"].nunique() if not driver_features.empty else pd.Series(dtype=float)
        completeness_score = constructor_signals.apply(lambda row: clamp01((constructor_driver_counts.get((row["race_id"], row["constructor_id"]), 0) or 0) / 2, default=0.0), axis=1).reset_index(drop=True)
        sample_score = constructor_signals["race_id"].map(lambda _: 0.35 if session_features.empty or session_features["session_completeness"].fillna(0).sum() == 0 else 0.7).reset_index(drop=True)
        strength_score = ((constructor_signals["overall_signal"] - 0.5).abs() * 2).clip(lower=0, upper=1).reset_index(drop=True)
        confidence_score = (completeness_score * 0.30 + agreement_score * 0.30 + sample_score * 0.15 + strength_score * 0.25).round(6)
        constructor_confidence = constructor_signals[["race_id", "constructor_id", "season", "round"]].copy()
        constructor_confidence["id"] = constructor_confidence.apply(lambda row: f"{row['race_id']}|constructor|{row['constructor_id']}", axis=1)
        constructor_confidence["entity_type"] = "constructor"
        constructor_confidence["entity_id"] = constructor_confidence["constructor_id"]
        constructor_confidence["completeness_score"] = completeness_score.values
        constructor_confidence["agreement_score"] = agreement_score.values
        constructor_confidence["sample_score"] = sample_score.values
        constructor_confidence["strength_score"] = strength_score.values
        constructor_confidence["confidence_score"] = confidence_score.values
        constructor_confidence["confidence_band"] = constructor_confidence["confidence_score"].apply(confidence_band)
        constructor_confidence["rationale"] = constructor_confidence["constructor_id"].map(lambda constructor_id: f"{constructor_name_map.get(constructor_id, constructor_id)} confidence reflects internal signal agreement and team-level signal strength.")
        constructor_confidence["source_label"] = "race_week_confidence_v1"
    else:
        constructor_confidence = pd.DataFrame()

    race_confidence_rows: list[dict[str, Any]] = []
    for _, active_race in active_races.iterrows():
        race_id = str(active_race["race_id"])
        driver_scores = driver_confidence[driver_confidence["race_id"] == race_id]["confidence_score"] if not driver_confidence.empty else pd.Series(dtype=float)
        race_score = float(driver_scores.mean()) if not driver_scores.empty else 0.25
        race_confidence_rows.append(
            {
                "id": f"{race_id}|race|overview",
                "season": int(active_race["season"]),
                "round": int(active_race["round"]),
                "race_id": race_id,
                "entity_type": "race",
                "entity_id": race_id,
                "completeness_score": clamp01(len(driver_scores) / 20, default=0.0),
                "agreement_score": race_score,
                "sample_score": (0.3 if driver_scores.empty else race_score),
                "strength_score": race_score,
                "confidence_score": race_score,
                "confidence_band": confidence_band(race_score),
                "rationale": "Race-level confidence reflects the aggregate completeness and agreement of the active driver signals.",
                "source_label": "race_week_confidence_v1",
            }
        )
    race_confidence = pd.DataFrame(race_confidence_rows)
    race_week_confidence = pd.concat([driver_confidence, constructor_confidence, race_confidence], ignore_index=True) if not (driver_confidence.empty and constructor_confidence.empty and race_confidence.empty) else pd.DataFrame()
    spain_qualifying_prediction = build_spain_qualifying_prediction(
        races=races,
        qualifying_results=qualifying_results,
        race_week_context=race_week_context,
        driver_features=driver_features,
        session_year_over_year_deltas=session_year_over_year_deltas,
        qualifying_driver_deltas=qualifying_driver_deltas,
    )

    return {
        "session_features": session_features,
        "driver_features": driver_features,
        "constructor_features": constructor_features,
        "race_context_features": race_context_features,
        "driver_signals": driver_signals,
        "constructor_signals": constructor_signals,
        "race_context_signals": race_context_signals,
        "race_week_confidence": race_week_confidence,
        "session_year_over_year_deltas": session_year_over_year_deltas,
        "qualifying_driver_deltas": qualifying_driver_deltas,
        "spain_qualifying_prediction": spain_qualifying_prediction,
    }


def build_race_week_product_views_from_intelligence(
    *,
    races: pd.DataFrame,
    drivers: pd.DataFrame,
    constructors: pd.DataFrame,
    race_week_context: pd.DataFrame,
    strategy_view: pd.DataFrame,
    intelligence: dict[str, pd.DataFrame],
) -> dict[str, pd.DataFrame]:
    overview = pd.DataFrame()
    driver_board = pd.DataFrame()
    constructor_board = pd.DataFrame()
    storylines = pd.DataFrame()

    driver_name_map = dict(zip(drivers["id"], drivers["full_name"])) if not drivers.empty else {}
    constructor_name_map = dict(zip(constructors["id"], constructors["name"])) if not constructors.empty else {}
    driver_features = intelligence.get("driver_features", pd.DataFrame()).copy()
    constructor_features = intelligence.get("constructor_features", pd.DataFrame()).copy()
    race_context_features = intelligence.get("race_context_features", pd.DataFrame()).copy()
    driver_signals = intelligence.get("driver_signals", pd.DataFrame()).copy()
    constructor_signals = intelligence.get("constructor_signals", pd.DataFrame()).copy()
    confidence = intelligence.get("race_week_confidence", pd.DataFrame()).copy()
    active_races = race_week_context[race_week_context["is_next_race"].astype(str).str.lower().isin(["true", "1"])].copy()

    if not driver_features.empty and not driver_signals.empty:
        driver_board = driver_features.merge(
            driver_signals[["race_id", "driver_id", "overall_signal", "fp2_race_pace_signal", "quali_signal", "consistency_signal", "track_affinity_signal"]],
            on=["race_id", "driver_id"],
            how="left",
        ).merge(
            confidence[confidence["entity_type"] == "driver"][["race_id", "entity_id", "confidence_score", "confidence_band"]],
            left_on=["race_id", "driver_id"],
            right_on=["race_id", "entity_id"],
            how="left",
        )
        driver_board["driver_name"] = driver_board["driver_id"].map(driver_name_map).fillna(driver_board["driver_id"])
        driver_board["constructor_name"] = driver_board["constructor_id"].map(constructor_name_map).fillna(driver_board["constructor_id"])
        driver_board["readiness_score"] = driver_board["overall_signal"].fillna(0.5)
        driver_board["signal_confidence"] = driver_board["confidence_score"].fillna(0.45)
        driver_board["projected_finish"] = driver_board.groupby("race_id")["readiness_score"].rank(method="dense", ascending=False).astype(int)
        driver_board["gap_to_long_run_best_s"] = pd.to_numeric(driver_board["fp2_long_run_pace_s"], errors="coerce") - pd.to_numeric(driver_board["fp2_long_run_pace_s"], errors="coerce").groupby(driver_board["race_id"]).transform("min")
        driver_board["gap_to_one_lap_best_s"] = pd.to_numeric(driver_board["quali_pace_s"], errors="coerce") - pd.to_numeric(driver_board["quali_pace_s"], errors="coerce").groupby(driver_board["race_id"]).transform("min")
        driver_board["summary"] = driver_board.apply(
            lambda row: f"{row['driver_name']} is strongest on "
            + ", ".join(
                label for label, _ in sorted(
                    [
                        ("long-run pace", row.get("fp2_race_pace_signal") or 0),
                        ("one-lap pace", row.get("quali_signal") or 0),
                        ("consistency", row.get("consistency_signal") or 0),
                        ("track fit", row.get("track_affinity_signal") or 0),
                    ],
                    key=lambda item: item[1],
                    reverse=True,
                )[:2]
            )
            + f". Confidence is {row.get('confidence_band', 'medium')}.",
            axis=1,
        )
        driver_board["source_label"] = "race_week_driver_board_v2"
        driver_board["id"] = driver_board.apply(lambda row: f"{row['race_id']}|{row['driver_id']}", axis=1)
        driver_board = driver_board[
            ["id", "season", "round", "race_id", "driver_id", "constructor_id", "driver_name", "constructor_name", "fp2_long_run_pace_s", "gap_to_long_run_best_s", "quali_pace_s", "gap_to_one_lap_best_s", "tyre_degradation_slope", "readiness_score", "signal_confidence", "projected_finish", "summary", "source_label"]
        ].rename(columns={"fp2_long_run_pace_s": "long_run_pace_s", "quali_pace_s": "one_lap_pace_s", "tyre_degradation_slope": "degradation_s_per_lap"})

    if not constructor_features.empty and not constructor_signals.empty:
        constructor_board = constructor_features.merge(
            constructor_signals[["race_id", "constructor_id", "overall_signal"]],
            on=["race_id", "constructor_id"],
            how="left",
        ).merge(
            confidence[confidence["entity_type"] == "constructor"][["race_id", "entity_id", "confidence_score", "confidence_band"]],
            left_on=["race_id", "constructor_id"],
            right_on=["race_id", "entity_id"],
            how="left",
        )
        constructor_board["constructor_name"] = constructor_board["constructor_id"].map(constructor_name_map).fillna(constructor_board["constructor_id"])
        constructor_board["readiness_score"] = constructor_board["overall_signal"].fillna(0.5)
        constructor_board["signal_confidence"] = constructor_board["confidence_score"].fillna(0.45)
        constructor_board["summary"] = constructor_board.apply(
            lambda row: f"{row['constructor_name']} shows its cleanest signal through pace and tyre control. Confidence is {row.get('confidence_band', 'medium')}.",
            axis=1,
        )
        constructor_board["source_label"] = "race_week_constructor_board_v2"
        constructor_board["id"] = constructor_board.apply(lambda row: f"{row['race_id']}|{row['constructor_id']}", axis=1)
        constructor_board = constructor_board[
            ["id", "season", "round", "race_id", "constructor_id", "constructor_name", "long_run_pace_s", "quali_pace_s", "degradation_profile", "readiness_score", "signal_confidence", "summary", "source_label"]
        ].rename(columns={"quali_pace_s": "one_lap_pace_s", "degradation_profile": "degradation_index"})

    if not race_context_features.empty and not active_races.empty:
        overview = active_races.merge(
            races[["id", "race_name", "scheduled_at", "circuit_id", "sprint_weekend"]],
            left_on="race_id",
            right_on="id",
            how="left",
            suffixes=("", "_race"),
        ).merge(
            race_context_features[["race_id", "archetype_label", "strategic_complexity_score", "weather_risk_index"]],
            on="race_id",
            how="left",
        ).merge(
            confidence[confidence["entity_type"] == "race"][["race_id", "confidence_score"]],
            on="race_id",
            how="left",
        )
        overview["id"] = overview["race_id"]
        overview["circuit_name"] = overview["circuit_id"]
        overview["strategy_difficulty"] = overview["strategic_complexity_score"].apply(lambda value: difficulty_band(float(value)) if pd.notna(value) else "Medium")
        overview["signal_confidence"] = overview["confidence_score"].fillna(0.45)
        overview["source_label"] = "race_week_overview_v2"
        overview = overview[
            ["id", "season", "round", "race_id", "race_name", "circuit_id", "circuit_name", "scheduled_at_race", "status", "sprint_weekend", "latest_completed_race_id", "archetype_label", "strategy_difficulty", "weather_risk_index", "signal_confidence", "source_label"]
        ].rename(columns={"scheduled_at_race": "scheduled_at"})

    if not driver_board.empty:
        story_rows: list[dict[str, Any]] = []
        for race_id, frame in driver_board.groupby("race_id", dropna=False):
            season_value = int(frame["season"].iloc[0])
            round_value = int(frame["round"].iloc[0])
            lead_row = frame.sort_values("readiness_score", ascending=False).iloc[0]
            story_rows.append(
                {
                    "id": f"{race_id}|story|lead",
                    "season": season_value,
                    "round": round_value,
                    "race_id": race_id,
                    "entity_type": "driver",
                    "entity_id": lead_row["driver_id"],
                    "storyline_type": "lead_signal",
                    "priority_rank": 1,
                    "headline": f"{lead_row['driver_name']} sets the strongest opening signal",
                    "body": lead_row["summary"],
                    "confidence_band": confidence_band(float(lead_row["signal_confidence"])),
                    "signal_confidence": lead_row["signal_confidence"],
                    "source_label": "race_week_storyline_v2",
                }
            )
            if not constructor_board.empty:
                weak_constructor = constructor_board[constructor_board["race_id"] == race_id].sort_values("degradation_index", ascending=False).head(1)
                if not weak_constructor.empty:
                    weak_row = weak_constructor.iloc[0]
                    story_rows.append(
                        {
                            "id": f"{race_id}|story|deg",
                            "season": season_value,
                            "round": round_value,
                            "race_id": race_id,
                            "entity_type": "constructor",
                            "entity_id": weak_row["constructor_id"],
                            "storyline_type": "degradation_warning",
                            "priority_rank": 2,
                            "headline": f"{weak_row['constructor_name']} is carrying the sharpest tyre fade warning",
                            "body": "Degradation is the weakest part of this constructor's weekend signal.",
                            "confidence_band": confidence_band(float(weak_row["signal_confidence"])),
                            "signal_confidence": weak_row["signal_confidence"],
                            "source_label": "race_week_storyline_v2",
                        }
                    )
        storylines = pd.DataFrame(story_rows)

    sourced_storylines = build_sourced_weekend_storylines(overview)
    if not sourced_storylines.empty:
        storylines = sourced_storylines

    return {
        "race_week_overview": overview,
        "race_week_driver_board": driver_board,
        "race_week_constructor_board": constructor_board,
        "race_week_storylines": storylines,
        "race_week_strategy": strategy_view,
    }


def ensure_columns(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=columns)
    normalized = frame.copy()
    for column in columns:
        if column not in normalized.columns:
            normalized[column] = None
    return normalized[columns]


def build_materialization_metadata(prefix: str) -> tuple[str, str]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    build_version = f"{prefix}_{generated_at.replace('-', '').replace(':', '')}"
    return generated_at, build_version


def build_sourced_weekend_storylines(overview: pd.DataFrame) -> pd.DataFrame:
    if overview.empty:
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []
    for _, race in overview.iterrows():
        if str(race.get("circuit_id") or "") != "catalunya":
            continue
        race_id = str(race["race_id"])
        season = int(race["season"])
        round_number = int(race["round"])
        rows.extend(
            [
                {
                    "id": f"{race_id}|brief|schedule",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "entity_type": "race",
                    "entity_id": race_id,
                    "storyline_type": "official_schedule",
                    "priority_rank": 1,
                    "headline": "Barcelona weekend opens Friday before Saturday qualifying",
                    "body": "FP1 and FP2 run on June 12, FP3 and Qualifying follow on June 13, and the Grand Prix is scheduled for June 14.",
                    "confidence_band": "high",
                    "signal_confidence": 1.0,
                    "source_title": "Official F1 race hub",
                    "source_url": "https://www.formula1.com/en/racing/2026/barcelona-catalunya",
                    "published_at": "2026-06-11T15:14:59Z",
                    "source_label": "race_week_sourced_brief_v1",
                },
                {
                    "id": f"{race_id}|brief|tyres",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "entity_type": "race",
                    "entity_id": race_id,
                    "storyline_type": "tyre_strategy",
                    "priority_rank": 2,
                    "headline": "Softer C2-C4 tyres raise degradation stakes",
                    "body": "Pirelli's softer Barcelona allocation, high front-left stress, abrasive asphalt, and a 50% Safety Car history make tyre management central.",
                    "confidence_band": "high",
                    "signal_confidence": 1.0,
                    "source_title": "F1 Need to Know",
                    "source_url": "https://www.formula1.com/en/latest/article/need-to-know-the-most-important-facts-stats-and-trivia-ahead-of-the-2026-barcelona-catalunya-grand-prix.51RmTAVS0jveoGWnBr9Ul",
                    "published_at": "2026-06-11T11:01:00Z",
                    "source_label": "race_week_sourced_brief_v1",
                },
                {
                    "id": f"{race_id}|brief|rookies",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "entity_type": "race",
                    "entity_id": race_id,
                    "storyline_type": "fp1_rookies",
                    "priority_rank": 3,
                    "headline": "Seven teams will alter FP1 line-ups",
                    "body": "Mercedes, Ferrari, McLaren, Red Bull, Williams, Audi, and Cadillac are all running rookie FP1 substitutions, so early timing needs context.",
                    "confidence_band": "high",
                    "signal_confidence": 1.0,
                    "source_title": "F1 FP1 rookie guide",
                    "source_url": "https://www.formula1.com/en/latest/article/which-rookies-are-getting-fp1-outings-at-the-barcelona-catalunya-grand-prix.QGmlkzT9YriCTNHLoD8SC",
                    "published_at": "2026-06-11T07:00:00Z",
                    "source_label": "race_week_sourced_brief_v1",
                },
                {
                    "id": f"{race_id}|brief|alonso",
                    "season": season,
                    "round": round_number,
                    "race_id": race_id,
                    "entity_type": "driver",
                    "entity_id": "alonso",
                    "storyline_type": "home_race_context",
                    "priority_rank": 4,
                    "headline": "Alonso frames Barcelona as a likely final home F1 visit",
                    "body": "Alonso says this is probably his last Barcelona race in F1, while acknowledging Aston Martin is unlikely to be competitive this weekend.",
                    "confidence_band": "high",
                    "signal_confidence": 1.0,
                    "source_title": "F1 Alonso interview",
                    "source_url": "https://www.formula1.com/en/latest/article/alonso-concedes-2026-is-probably-my-last-barcelona-race-in-f1.5BNWC0Aj1R6nWbCWZZX5uK",
                    "published_at": "2026-06-11T14:18:00Z",
                    "source_label": "race_week_sourced_brief_v1",
                },
            ]
        )

    return pd.DataFrame(rows)


def main() -> None:
    settings = load_settings()
    curated = settings.curated_dir

    canonical_columns = {
        "sessions": ["id", "race_id", "season", "round", "session_code", "session_name", "event_name", "scheduled_at", "source_label"],
        "event_entries": ["id", "race_id", "driver_id", "constructor_id", "source_label"],
        "session_results": ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "classification_position", "grid_position", "finish_position", "points", "status", "laps_completed", "fastest_lap_rank", "source_label"],
        "session_laps": ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "lap_number", "stint_number", "compound", "tyre_life", "lap_time_s", "sector_1_s", "sector_2_s", "sector_3_s", "top_speed_kph", "track_status", "fresh_tyre", "is_personal_best", "is_accurate", "deleted", "lap_start_time", "position", "air_temp_c", "track_temp_c", "humidity_pct", "rainfall", "wind_speed_mps", "wind_direction_deg", "source_label"],
        "session_stints": ["id", "session_id", "event_entry_id", "race_id", "driver_id", "constructor_id", "stint_number", "compound", "lap_count", "mean_lap_time_s", "degradation_per_lap_s", "degradation_index", "start_tyre_life", "end_tyre_life", "session_code", "source_label"],
        "session_weather": ["id", "session_id", "race_id", "sample_order", "sample_time", "air_temp_c", "track_temp_c", "humidity_pct", "pressure_hpa", "rainfall", "wind_speed_mps", "wind_direction_deg", "source_label"],
    }
    processed_columns = {
        "session_features": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "fp1_pace_s", "fp2_pace_s", "fp3_pace_s", "quali_pace_s", "fp2_long_run_pace_s", "lap_variance_s", "session_trend_delta_s", "session_completeness", "signal_confidence", "source_label"],
        "driver_features": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "avg_race_pace_s", "fp2_long_run_pace_s", "lap_variance_s", "consistency_score", "quali_pace_s", "race_vs_quali_delta_s", "tyre_degradation_slope", "avg_finish_position_recent", "avg_qualifying_position_recent", "track_affinity_score", "teammate_delta_s", "reliability_score", "avg_quali_yoy_delta_s", "form_bias_score", "source_label"],
        "constructor_features": ["id", "season", "round", "race_id", "constructor_id", "team_pace_s", "long_run_pace_s", "quali_pace_s", "degradation_profile", "reliability_score", "track_affinity_score", "avg_finish_position_recent", "strategy_tendency_score", "strategy_confidence", "source_label"],
        "race_context_features": ["id", "season", "round", "race_id", "circuit_id", "archetype_label", "high_speed_bias", "overtake_difficulty", "tire_degradation_bias", "weather_risk_index", "safety_car_probability", "strategic_complexity_score", "source_label"],
        "driver_signals": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "form_signal", "consistency_signal", "racecraft_signal", "fp2_race_pace_signal", "quali_signal", "quali_delta_signal", "form_bias_signal", "trend_signal", "track_affinity_signal", "overall_signal", "source_label"],
        "constructor_signals": ["id", "season", "round", "race_id", "constructor_id", "pace_strength_signal", "degradation_strength_signal", "reliability_signal", "strategy_signal", "track_affinity_signal", "overall_signal", "source_label"],
        "race_context_signals": ["id", "season", "round", "race_id", "strategic_complexity_signal", "weather_signal", "safety_car_signal", "overtaking_signal", "high_speed_signal", "source_label"],
        "race_week_confidence": ["id", "season", "round", "race_id", "entity_type", "entity_id", "completeness_score", "agreement_score", "sample_score", "strength_score", "confidence_score", "confidence_band", "rationale", "source_label"],
        "session_pace_summary": ["id", "season", "round", "race_id", "session_id", "session_code", "driver_id", "constructor_id", "representative_lap_s", "best_lap_s", "long_run_lap_s", "long_run_degradation_s", "gap_to_session_best_s", "pace_rank", "gap_to_teammate_s", "top_speed_kph", "air_temp_c", "track_temp_c", "rainfall_flag", "source_label"],
        "session_year_over_year_deltas": ["id", "season", "round", "race_id", "circuit_id", "session_code", "driver_id", "constructor_id", "comparison_season", "comparison_race_id", "current_gap_s", "prior_gap_s", "delta_gap_s", "source_label"],
        "qualifying_driver_deltas": ["id", "season", "round", "race_id", "circuit_id", "delta_type", "driver_id", "comparison_driver_id", "constructor_id", "comparison_constructor_id", "current_quali_gap_s", "comparison_quali_gap_s", "pairwise_delta_gap_s", "avg_quali_yoy_delta_s", "source_sample_size", "source_label"],
        "spain_qualifying_prediction": ["id", "season", "round", "race_id", "prediction_mode", "mode_label", "included_sessions", "mode_status", "driver_id", "constructor_id", "predicted_q_rank", "predicted_q_time_s", "predicted_q_gap_s", "base_pole_s", "season_delta_26_vs_25_s", "track_residual_s", "recent_quali_gap_s", "same_circuit_gap_s", "constructor_quali_gap_s", "race_week_delta_gap_s", "driver_gap_delta_s", "constructor_gap_delta_s", "form_bias_score", "confidence_score", "clamped_prediction", "missing_flags", "baseline_method", "source_label"],
        "fp2_long_run_summary": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "representative_long_run_pace_s", "gap_to_best_s", "degradation_per_lap_s", "lap_sample_size", "compound", "signal_confidence", "source_label"],
        "stint_degradation_summary": ["id", "season", "round", "race_id", "session_code", "driver_id", "constructor_id", "compound", "avg_lap_count", "avg_degradation_per_lap_s", "avg_tyre_life", "degradation_risk", "source_label"],
        "weather_risk_summary": ["id", "season", "round", "race_id", "rainfall_probability", "track_temp_mean_c", "track_temp_volatility_c", "wind_speed_mean_mps", "weather_risk_index", "source_label"],
        "driver_race_week_features": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "session_completeness", "fp2_long_run_pace_s", "fp2_degradation_s_per_lap", "one_lap_pace_s", "one_lap_session_code", "recent_pace_rank", "gap_to_best_s", "teammate_delta_s", "reliability_index", "weather_risk_index", "readiness_score", "signal_confidence", "overperforming_delta", "projected_finish", "source_label"],
        "constructor_race_week_features": ["id", "season", "round", "race_id", "constructor_id", "two_car_long_run_pace_s", "two_car_one_lap_pace_s", "degradation_index", "reliability_index", "weather_risk_index", "readiness_score", "signal_confidence", "source_label"],
        "weekend_readiness_summary": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "readiness_score", "signal_confidence", "readiness_rank", "rationale", "source_label"],
        "standings_context_snapshot": ["id", "season", "round", "race_id", "entity_type", "entity_id", "constructor_id", "standing_position", "points", "wins", "source_race_id", "source_label"],
        "race_week_storylines": ["id", "season", "round", "race_id", "entity_type", "entity_id", "storyline_type", "priority_rank", "headline", "body", "confidence_band", "signal_confidence", "source_title", "source_url", "published_at", "source_label"],
        "race_week_overview": ["id", "season", "round", "race_id", "race_name", "circuit_id", "circuit_name", "scheduled_at", "status", "sprint_weekend", "latest_completed_race_id", "archetype_label", "strategy_difficulty", "weather_risk_index", "signal_confidence", "generated_at", "build_version", "source_label"],
        "race_week_driver_board": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "driver_name", "constructor_name", "long_run_pace_s", "gap_to_long_run_best_s", "one_lap_pace_s", "gap_to_one_lap_best_s", "degradation_s_per_lap", "readiness_score", "signal_confidence", "projected_finish", "summary", "source_label"],
        "race_week_constructor_board": ["id", "season", "round", "race_id", "constructor_id", "constructor_name", "long_run_pace_s", "one_lap_pace_s", "degradation_index", "readiness_score", "signal_confidence", "summary", "source_label"],
        "race_week_strategy": ["id", "season", "round", "race_id", "driver_id", "constructor_id", "recommended_stop_count", "preferred_primary_compound", "preferred_secondary_compound", "pit_window_start_lap", "pit_window_end_lap", "degradation_risk", "strategy_confidence", "rationale", "source_label"],
    }

    drivers = read_csv(curated / "drivers.csv")
    constructors = read_csv(curated / "constructors.csv")
    races = read_csv(curated / "races.csv")
    circuits = read_csv(curated / "circuits.csv")
    qualifying_results = read_csv(curated / "qualifying_results.csv")
    race_results = read_csv(curated / "race_results.csv")
    strategy_profiles = read_csv(curated / "strategy_profiles.csv")
    driver_standings = read_csv(curated / "driver_standings.csv")
    constructor_standings = read_csv(curated / "constructor_standings.csv")
    race_week_context = read_csv(curated / "race_week_context.csv")
    prediction_snapshots = read_csv(curated / "prediction_snapshots.csv")

    driver_lookup = driver_lookup_map(drivers)
    constructor_lookup = constructor_lookup_map(constructors)

    driver_form = normalize_feature_ids(
        read_csv(settings.features_dir / "driver_form_snapshots.csv"),
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    strategy_baselines = normalize_feature_ids(
        read_csv(settings.predictions_dir / "strategy_baselines.csv"),
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    fastf1_predictions = normalize_feature_ids(
        read_csv(settings.predictions_dir / "fastf1_prediction_snapshots.csv"),
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    prediction_snapshots = normalize_feature_ids(
        prediction_snapshots,
        driver_column="driver_id",
        constructor_column="constructor_id",
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )

    canonical = build_canonical_session_layer(
        settings,
        races=races,
        driver_lookup=driver_lookup,
        constructor_lookup=constructor_lookup,
    )
    canonical = {
        table_name: ensure_columns(canonical.get(table_name, pd.DataFrame()), columns)
        for table_name, columns in canonical_columns.items()
    } | {
        "session_pace_summary": ensure_columns(canonical.get("session_pace_summary", pd.DataFrame()), processed_columns["session_pace_summary"])
    }
    processed = build_processed_race_week_layers(
        canonical=canonical,
        races=races,
        circuits=circuits,
        drivers=drivers,
        constructors=constructors,
        qualifying_results=qualifying_results,
        race_results=race_results,
        strategy_profiles=strategy_profiles,
        driver_standings=driver_standings,
        constructor_standings=constructor_standings,
        race_week_context=race_week_context,
        prediction_snapshots=prediction_snapshots,
        driver_form=driver_form,
        strategy_baselines=strategy_baselines,
        fastf1_predictions=fastf1_predictions,
    )
    intelligence = build_race_week_intelligence_layers(
        canonical=canonical,
        races=races,
        circuits=circuits,
        drivers=drivers,
        constructors=constructors,
        qualifying_results=qualifying_results,
        race_results=race_results,
        prediction_snapshots=prediction_snapshots,
        fastf1_predictions=fastf1_predictions,
        strategy_profiles=strategy_profiles,
        race_week_context=race_week_context,
        strategy_baselines=strategy_baselines,
    )
    product_views = build_race_week_product_views_from_intelligence(
        races=races,
        drivers=drivers,
        constructors=constructors,
        race_week_context=race_week_context,
        strategy_view=processed.get("race_week_strategy", pd.DataFrame()),
        intelligence=intelligence,
    )
    race_week_generated_at, race_week_build_version = build_materialization_metadata("race_week")
    if not product_views.get("race_week_overview", pd.DataFrame()).empty:
        product_views["race_week_overview"] = product_views["race_week_overview"].assign(
            generated_at=race_week_generated_at,
            build_version=race_week_build_version,
        )
    processed = processed | intelligence
    for table_name, frame in product_views.items():
        if not frame.empty:
            processed[table_name] = frame

    settings.canonical_fastf1_dir.mkdir(parents=True, exist_ok=True)
    settings.race_week_dir.mkdir(parents=True, exist_ok=True)

    for table_name, columns in canonical_columns.items():
        write_frame(ensure_columns(canonical.get(table_name, pd.DataFrame()), columns), settings.canonical_fastf1_dir / f"{table_name}.csv")

    for table_name, columns in processed_columns.items():
        write_frame(ensure_columns(processed.get(table_name, pd.DataFrame()), columns), settings.race_week_dir / f"{table_name}.csv")


if __name__ == "__main__":
    main()
