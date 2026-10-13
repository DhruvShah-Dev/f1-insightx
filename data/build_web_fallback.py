"""Refresh the small bundled web fallback from validated local product tables."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SEASON_FILE = ROOT / "src/data/season.ts"
QUALIFYING_FILE = ROOT / "src/data/race-week-qualifying.ts"
TEAM_KEYS = {"red_bull": "red-bull", "aston_martin": "aston-martin", "rb": "racing-bulls"}
EVENT_DETAILS = {"americas": {"laps": 56, "lapKm": 5.513, "timeZone": "America/Chicago"}}
SESSION_CODES = {
    "Practice 1": "FP1",
    "Practice 2": "FP2",
    "Practice 3": "FP3",
    "Qualifying": "Q",
    "Sprint Qualifying": "SQ",
    "Sprint": "S",
    "Race": "R",
}
CURRENT_DRIVER_NAMES = {
    "russell": ("RUS", "George Russell"), "hamilton": ("HAM", "Lewis Hamilton"),
    "max_verstappen": ("VER", "Max Verstappen"), "leclerc": ("LEC", "Charles Leclerc"),
    "norris": ("NOR", "Lando Norris"), "piastri": ("PIA", "Oscar Piastri"),
    "hadjar": ("HAD", "Isack Hadjar"), "lawson": ("LAW", "Liam Lawson"),
    "gasly": ("GAS", "Pierre Gasly"), "arvid_lindblad": ("LIN", "Arvid Lindblad"),
    "colapinto": ("COL", "Franco Colapinto"), "bearman": ("BEA", "Oliver Bearman"),
    "hulkenberg": ("HUL", "Nico Hulkenberg"), "alonso": ("ALO", "Fernando Alonso"),
    "ocon": ("OCO", "Esteban Ocon"), "sainz": ("SAI", "Carlos Sainz"),
    "albon": ("ALB", "Alexander Albon"), "tsunoda": ("TSU", "Yuki Tsunoda"),
    "bottas": ("BOT", "Valtteri Bottas"), "perez": ("PER", "Sergio Perez"),
    "stroll": ("STR", "Lance Stroll"),
}


def records(path: str) -> list[dict]:
    return pd.read_csv(DATA / path).where(lambda frame: frame.notna(), None).to_dict("records")


def clean(value):
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return int(value) if float(value).is_integer() else round(float(value), 6)
    return value


def ts_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)


def main() -> None:
    state = json.loads((DATA / "season_state.json").read_text(encoding="utf-8"))
    completed = state["latest_completed_race"]
    upcoming = state["next_race"]
    season = int(upcoming["season"])
    round_number = int(upcoming["round"])
    race_id = upcoming["id"]
    circuit_id = upcoming["circuit_id"]

    drivers = {row["id"]: row for row in records("curated/drivers.csv")}
    circuits = {row["id"]: row for row in records("curated/circuits.csv")}
    latest_driver_rows = sorted(
        (row for row in records("curated/driver_standings.csv") if row["race_id"] == completed["id"]),
        key=lambda row: int(row["standing_position"]),
    )
    latest_constructor_rows = sorted(
        (row for row in records("curated/constructor_standings.csv") if row["race_id"] == completed["id"]),
        key=lambda row: int(row["standing_position"]),
    )
    code_by_id = {driver_id: str(clean(row.get("driver_code")) or "").upper() for driver_id, row in drivers.items()}
    code_by_id.update({driver_id: code for driver_id, (code, _) in CURRENT_DRIVER_NAMES.items()})
    code_by_id.update({"antonelli": "ANT"})
    name_by_code = {code_by_id[driver_id]: row["full_name"] for driver_id, row in drivers.items() if code_by_id[driver_id]}
    name_by_code.update({code: name for code, name in CURRENT_DRIVER_NAMES.values()})

    def team_key(value: str) -> str:
        return TEAM_KEYS.get(str(value), str(value).replace("_", "-"))

    constructor_standings = [
        {
            "pos": int(row["standing_position"]),
            "team": team_key(row["constructor_id"]),
            "points": clean(row["points"]),
            "wins": int(row["wins"]),
            "form": [int(row["standing_position"])],
        }
        for row in latest_constructor_rows
    ]
    driver_standings = [
        {
            "pos": int(row["standing_position"]),
            "code": code_by_id[row["driver_id"]],
            "name": name_by_code[code_by_id[row["driver_id"]]],
            "team": team_key(row["constructor_id"]),
            "points": clean(row["points"]),
            "wins": int(row["wins"]),
        }
        for row in latest_driver_rows
    ]

    qualifying_rows = sorted(
        (row for row in records("race_week/spain_qualifying_prediction.csv") if row["race_id"] == race_id and row["prediction_mode"] == "baseline"),
        key=lambda row: int(row["predicted_q_rank"]),
    )
    if not qualifying_rows:
        raise RuntimeError(f"No baseline qualifying predictions for {race_id}")
    qualifying = []
    projection = []
    for row in qualifying_rows:
        code = code_by_id[row["driver_id"]]
        name = name_by_code[code]
        team = team_key(row["constructor_id"])
        rank = int(row["predicted_q_rank"])
        time_s = clean(row["predicted_q_time_s"])
        confidence = clean(row["confidence_score"])
        projection.append({"pos": rank, "code": code, "name": name, "team": team, "lap": f"{int(time_s // 60)}:{time_s % 60:06.3f}", "delta": f"+{clean(row['predicted_q_gap_s']):.3f}", "conf": confidence})
        qualifying.append({
            "driverId": row["driver_id"], "code": code, "name": name, "constructorId": row["constructor_id"],
            "rank": rank, "timeS": time_s, "gapS": clean(row["predicted_q_gap_s"]),
            "recentGapS": clean(row["recent_quali_gap_s"]), "sameCircuitGapS": clean(row["same_circuit_gap_s"]),
            "constructorGapS": clean(row["constructor_quali_gap_s"]), "raceWeekDeltaGapS": clean(row["race_week_delta_gap_s"]),
            "driverDeltaS": clean(row["driver_gap_delta_s"]), "constructorDeltaS": clean(row["constructor_gap_delta_s"]),
            "formBiasScore": clean(row["form_bias_score"]), "trackFitGapS": clean(row["track_fit_gap_s"]),
            "sourceUsefulnessScore": clean(row["source_usefulness_score"]), "sourceUsefulnessRank": clean(row["source_usefulness_rank"]),
            "qualityNote": clean(row["quality_note"]), "missingFlags": clean(row["missing_flags"]),
            "mode": row["prediction_mode"], "modeLabel": row["mode_label"], "sourceLabel": row["source_label"],
        })

    schedule = next(row for row in records("raw/fastf1/event_schedule_2026.csv") if int(row["RoundNumber"]) == round_number)
    sessions = []
    for index in range(1, 6):
        label = schedule.get(f"Session{index}")
        start = schedule.get(f"Session{index}DateUtc")
        if label and start:
            sessions.append({"code": SESSION_CODES[label], "label": label, "startISO": f"{start.replace(' ', 'T')}Z", "status": "scheduled"})
    pit_rows = [row for row in records("race_week/race_week_strategy.csv") if row["race_id"] == race_id]
    pit_start = int(pit_rows[0]["pit_window_start_lap"]) if pit_rows else 0
    pit_end = int(pit_rows[0]["pit_window_end_lap"]) if pit_rows else 0
    details = EVENT_DETAILS.get(circuit_id, {})
    next_race = {
        "round": round_number, "totalRounds": len([row for row in records("curated/races.csv") if int(row["season"]) == season]),
        "name": upcoming["race_name"], "shortName": upcoming["race_name"].replace(" Grand Prix", " GP"),
        "circuit": circuits[circuit_id]["name"], "circuitId": circuit_id,
        "location": circuits[circuit_id]["location"], "country": schedule["Country"],
        "timeZone": details.get("timeZone", "UTC"), "raceStartISO": upcoming["scheduled_at"],
        "laps": details.get("laps", 0), "lapKm": details.get("lapKm", 0),
        "pitWindow": f"L{pit_start}-L{pit_end}" if pit_rows else "TBC", "pitWindowStart": pit_start, "pitWindowEnd": pit_end,
        "sessions": sessions, "sprintWeekend": any(session["code"] == "S" for session in sessions),
    }

    summary_by_id = {row["race_analysis_id"]: row for row in records("race_analysis/race_analysis_summary.csv")}
    stints_by_race_driver: dict[tuple[str, str], list[dict]] = {}
    for row in records("race_analysis/race_analysis_stints.csv"):
        stints_by_race_driver.setdefault((row["race_analysis_id"], row["driver"]), []).append(row)
    reports = []
    for row in sorted(records("race_analysis/race_analysis_index.csv"), key=lambda item: int(item["round"]), reverse=True):
        if int(row["season"]) != season:
            continue
        slug = row["race_analysis_id"]
        summary = summary_by_id[slug]
        podium = [code.strip() for code in summary["podium"].split(",") if code.strip()]
        stints = []
        for code in podium[:3]:
            driver_stints = sorted(stints_by_race_driver.get((slug, code), []), key=lambda stint: int(stint["stint_number"]))
            team_name = driver_stints[0]["team"] if driver_stints else row["winner_team"]
            team_id = next((key for key, value in TEAM_NAME_LOOKUP.items() if value.lower() == str(team_name).lower()), "red_bull")
            stints.append({"code": code, "team": team_key(team_id), "plan": " > ".join(str(stint["compound"]) for stint in driver_stints) or "Data pending"})
        factors = [
            ("Pace factor", summary["key_pace_factor"]),
            ("Strategy factor", summary["key_strategy_factor"]),
            ("Position factor", summary["key_position_factor"]),
        ]
        winner_code = row["winner"]
        winner_team = next((key for key, value in TEAM_NAME_LOOKUP.items() if value.lower() == str(row["winner_team"]).lower()), "red_bull")
        reports.append({
            "round": int(row["round"]), "slug": slug, "name": row["race_name"],
            "circuit": circuits.get(row["circuit"], {}).get("name") or row["circuit"], "dateISO": row["race_date"],
            "winner": {"code": winner_code, "name": name_by_code.get(winner_code, winner_code), "team": team_key(winner_team)},
            "margin": "", "strategy": summary["dominant_strategy"], "lede": summary["primary_story"],
            "keyReads": [{"label": label, "value": value, "note": value} for label, value in factors], "stints": stints,
        })

    existing = SEASON_FILE.read_text(encoding="utf-8")
    teams_block = existing[existing.index("export type TeamKey"):existing.index("export const constructorStandings")]
    report_type = existing[existing.index("export type RaceReport"):existing.index("export const raceReports")]
    snapshot_iso = state["generated_at"]
    season_file = (
        "// Generated by data/build_web_fallback.py from validated local product tables.\n"
        "// Keep this snapshot current so public pages work without Supabase.\n\n"
        f"export const seasonState = {ts_json({'season': season, 'resultsThrough': {'round': int(completed['round']), 'name': completed['race_name'], 'date': completed['scheduled_at'][:10]}, 'raceWeekRound': round_number, 'snapshotISO': snapshot_iso, 'pipelineRunISO': snapshot_iso})};\n\n"
        f"export const nextRace = {ts_json(next_race)} as const;\n\n"
        f"{teams_block}"
        f"export const constructorStandings: {{ pos: number; team: TeamKey; points: number; wins: number; form: number[] }}[] = {ts_json(constructor_standings)};\n\n"
        f"export const driverStandings: {{ pos: number; code: string; name: string; team: TeamKey; points: number; wins: number }}[] = {ts_json(driver_standings)};\n\n"
        f"export const qualiProjection: {{ pos: number; code: string; name: string; team: TeamKey; lap: string; delta: string; conf: number }}[] = {ts_json(projection)};\n\n"
        f"{report_type}"
        f"export const raceReports: RaceReport[] = {ts_json(reports)};\n"
    )
    SEASON_FILE.write_text(season_file, encoding="utf-8")

    qualifying_type = QUALIFYING_FILE.read_text(encoding="utf-8").split("export const fallbackQualifyingPredictions")[0]
    QUALIFYING_FILE.write_text(
        qualifying_type + f"export const fallbackQualifyingPredictions: RawQualifyingPrediction[] = {ts_json(qualifying)};\n",
        encoding="utf-8",
    )
    print(f"Updated fallback for {race_id}: {len(driver_standings)} drivers, {len(reports)} reports, {len(qualifying)} qualifying predictions")


TEAM_NAME_LOOKUP = {
    "mercedes": "Mercedes", "ferrari": "Ferrari", "mclaren": "McLaren", "red_bull": "Red Bull Racing",
    "aston_martin": "Aston Martin", "williams": "Williams", "alpine": "Alpine", "rb": "Racing Bulls",
    "audi": "Audi", "haas": "Haas", "cadillac": "Cadillac",
}


if __name__ == "__main__":
    main()
