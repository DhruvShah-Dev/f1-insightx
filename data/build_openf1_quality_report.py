from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.io import read_csv_or_empty, write_csv
from f1_insightx_data.settings import load_settings


REPORT_COLUMNS = [
    "id",
    "season",
    "round",
    "race_id",
    "race_name",
    "openf1_meeting_key",
    "openf1_meeting_name",
    "openf1_session_count",
    "openf1_q_session_key",
    "openf1_r_session_key",
    "curated_has_results",
    "curated_has_qualifying",
    "openf1_has_results",
    "openf1_has_grid",
    "openf1_has_laps",
    "openf1_has_weather",
    "coverage_score",
    "source_agreement_score",
    "recommended_use",
    "source_label",
]


def normalize_text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return (
        str(value)
        .lower()
        .replace("grand prix", "")
        .replace("&", "and")
        .replace("-", " ")
        .replace("_", " ")
        .strip()
    )


def load_openf1_sessions(staged_openf1_dir: Path) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for sessions_path in sorted(staged_openf1_dir.glob("*/sessions.csv")):
        sessions = read_csv_or_empty(sessions_path)
        meetings = read_csv_or_empty(sessions_path.parent / "meetings.csv")
        if sessions.empty:
            continue
        if not meetings.empty and "meeting_key" in sessions.columns and "meeting_key" in meetings.columns:
            meeting_columns = [
                column
                for column in [
                    "meeting_key",
                    "meeting_name",
                    "meeting_official_name",
                    "circuit_type",
                    "circuit_info_url",
                    "circuit_image",
                ]
                if column in meetings.columns
            ]
            sessions = sessions.merge(
                meetings[meeting_columns].drop_duplicates("meeting_key"),
                on="meeting_key",
                how="left",
            )
        frames.append(sessions)
    frames = [frame for frame in frames if not frame.empty]
    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True).drop_duplicates("session_key")


def load_endpoint_counts(staged_openf1_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for path in sorted(staged_openf1_dir.glob("*/*/*/*.csv")):
        endpoint = path.stem
        if endpoint == "session":
            continue
        frame = read_csv_or_empty(path)
        session_dir = path.parent.name
        session_key = session_dir.split("_", 1)[0]
        rows.append(
            {
                "session_key": int(session_key) if session_key.isdigit() else session_key,
                "endpoint": endpoint,
                "row_count": int(len(frame)),
            }
        )
    return pd.DataFrame(rows)


def match_race_sessions(race: pd.Series, sessions: pd.DataFrame) -> pd.DataFrame:
    if sessions.empty:
        return pd.DataFrame()
    season_sessions = sessions[sessions["year"].astype("Int64") == int(race["season"])].copy()
    if season_sessions.empty:
        return pd.DataFrame()

    race_name = normalize_text(race.get("race_name"))
    event_name = season_sessions.get("meeting_name", pd.Series("", index=season_sessions.index)).apply(normalize_text)
    exact = season_sessions[event_name == race_name]
    if not exact.empty:
        return exact

    tokens = {token for token in race_name.split() if len(token) > 3}
    if not tokens:
        return pd.DataFrame()
    mask = event_name.apply(lambda value: bool(tokens.intersection(value.split())))
    return season_sessions[mask]


def endpoint_available(endpoint_counts: pd.DataFrame, session_key: Any, endpoint: str) -> bool:
    if endpoint_counts.empty or pd.isna(session_key):
        return False
    rows = endpoint_counts[
        (endpoint_counts["session_key"].astype(str) == str(session_key))
        & (endpoint_counts["endpoint"] == endpoint)
    ]
    return bool(not rows.empty and rows["row_count"].fillna(0).astype(int).max() > 0)


def column_or_default(frame: pd.DataFrame, column: str, default: Any = "") -> pd.Series:
    if column in frame.columns:
        return frame[column]
    return pd.Series(default, index=frame.index)


def build_openf1_quality_report(
    *,
    races: pd.DataFrame,
    race_results: pd.DataFrame,
    qualifying_results: pd.DataFrame,
    openf1_sessions: pd.DataFrame,
    endpoint_counts: pd.DataFrame,
) -> pd.DataFrame:
    if races.empty:
        return pd.DataFrame(columns=REPORT_COLUMNS)

    rows: list[dict[str, Any]] = []
    for _, race in races.sort_values(["season", "round"]).iterrows():
        race_id = str(race["id"])
        matched_sessions = match_race_sessions(race, openf1_sessions)
        session_names = column_or_default(matched_sessions, "session_name")
        q_sessions = matched_sessions[session_names.astype(str).eq("Qualifying")]
        r_sessions = matched_sessions[session_names.astype(str).eq("Race")]
        q_session_key = q_sessions["session_key"].iloc[0] if not q_sessions.empty else None
        r_session_key = r_sessions["session_key"].iloc[0] if not r_sessions.empty else None

        curated_has_results = bool(not race_results.empty and (race_results["race_id"].astype(str) == race_id).any())
        curated_has_qualifying = bool(
            not qualifying_results.empty and (qualifying_results["race_id"].astype(str) == race_id).any()
        )
        openf1_has_results = endpoint_available(endpoint_counts, r_session_key, "session_result")
        openf1_has_grid = endpoint_available(endpoint_counts, r_session_key, "starting_grid")
        openf1_has_laps = endpoint_available(endpoint_counts, r_session_key, "laps") or endpoint_available(
            endpoint_counts,
            q_session_key,
            "laps",
        )
        openf1_has_weather = endpoint_available(endpoint_counts, r_session_key, "weather") or endpoint_available(
            endpoint_counts,
            q_session_key,
            "weather",
        )

        coverage_inputs = [
            not matched_sessions.empty,
            pd.notna(q_session_key),
            pd.notna(r_session_key),
            openf1_has_results,
            openf1_has_grid,
            openf1_has_laps,
            openf1_has_weather,
        ]
        agreement_inputs = [
            (not curated_has_results) or openf1_has_results,
            (not curated_has_qualifying) or pd.notna(q_session_key),
            bool(not matched_sessions.empty),
        ]
        coverage_score = round(sum(coverage_inputs) / len(coverage_inputs), 3)
        source_agreement_score = round(sum(agreement_inputs) / len(agreement_inputs), 3)
        recommended_use = "primary_cross_check" if coverage_score >= 0.7 else "supplemental_only"
        if int(race["season"]) < 2023:
            recommended_use = "not_available_pre_2023"

        rows.append(
            {
                "id": f"{race_id}|openf1_quality",
                "season": int(race["season"]),
                "round": int(race["round"]),
                "race_id": race_id,
                "race_name": race.get("race_name"),
                "openf1_meeting_key": matched_sessions["meeting_key"].iloc[0] if not matched_sessions.empty else None,
                "openf1_meeting_name": matched_sessions["meeting_name"].iloc[0] if not matched_sessions.empty else None,
                "openf1_session_count": int(matched_sessions["session_key"].nunique()) if not matched_sessions.empty else 0,
                "openf1_q_session_key": q_session_key,
                "openf1_r_session_key": r_session_key,
                "curated_has_results": curated_has_results,
                "curated_has_qualifying": curated_has_qualifying,
                "openf1_has_results": openf1_has_results,
                "openf1_has_grid": openf1_has_grid,
                "openf1_has_laps": openf1_has_laps,
                "openf1_has_weather": openf1_has_weather,
                "coverage_score": coverage_score,
                "source_agreement_score": source_agreement_score,
                "recommended_use": recommended_use,
                "source_label": "openf1_quality_v1",
            }
        )

    return pd.DataFrame(rows, columns=REPORT_COLUMNS)


def main() -> None:
    settings = load_settings()
    report_dir = settings.staged_openf1_dir / "reports"
    races = read_csv_or_empty(settings.curated_dir / "races.csv")
    race_results = read_csv_or_empty(settings.curated_dir / "race_results.csv")
    qualifying_results = read_csv_or_empty(settings.curated_dir / "qualifying_results.csv")
    openf1_sessions = load_openf1_sessions(settings.staged_openf1_dir)
    endpoint_counts = load_endpoint_counts(settings.staged_openf1_dir)

    report = build_openf1_quality_report(
        races=races,
        race_results=race_results,
        qualifying_results=qualifying_results,
        openf1_sessions=openf1_sessions,
        endpoint_counts=endpoint_counts,
    )
    write_csv(report, report_dir / "openf1_race_quality.csv")

    summary = {
        "generated_at": datetime.now(tz=UTC).isoformat(),
        "rows": int(len(report)),
        "openf1_primary_cross_check_rows": int((report["recommended_use"] == "primary_cross_check").sum())
        if not report.empty
        else 0,
        "openf1_available_races": int((report["openf1_session_count"].fillna(0) > 0).sum()) if not report.empty else 0,
        "mean_coverage_score": float(report["coverage_score"].mean()) if not report.empty else 0,
        "source_label": "openf1_quality_v1",
    }
    report_dir.mkdir(parents=True, exist_ok=True)
    (report_dir / "openf1_quality_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
