"""Build lap-checkpoint order where the existing analysis timeline is absent.

Prefer OpenF1 position events at each leader lap-completion time. Fall back to
timing-based estimates only when the event feed is incomplete. The output serves
Section 02, never official classification or pass-by-pass overtake claims.
"""

from bisect import bisect_right
import csv
import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path


DATA = Path(__file__).resolve().parent
OUTPUT = DATA / "reports" / "position_story_backfill.json"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def aware(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def position_history(slug: str, race_date: str) -> dict[str, list[tuple[datetime, int]]]:
    base = DATA / "raw" / "openf1" / "2026"
    sessions = json.loads((base / "sessions.json").read_text(encoding="utf-8"))
    nearby = [session for session in sessions if session.get("session_name") == "Race"
              and abs((aware(session["date_start"]) - aware(race_date)).total_seconds()) < 12 * 3600]
    if not nearby:
        return {}
    session = min(nearby, key=lambda item: abs((aware(item["date_start"]) - aware(race_date)).total_seconds()))
    folder = base / str(session["meeting_key"]) / f"{session['session_key']}_R"
    if not (folder / "position.json").exists() or not (folder / "drivers.json").exists():
        return {}
    drivers = {int(row["driver_number"]): row["name_acronym"].upper()
               for row in json.loads((folder / "drivers.json").read_text(encoding="utf-8"))
               if row.get("driver_number") is not None and row.get("name_acronym")}
    history: dict[str, list[tuple[datetime, int]]] = defaultdict(list)
    for event in json.loads((folder / "position.json").read_text(encoding="utf-8")):
        code = drivers.get(event.get("driver_number"))
        position = event.get("position")
        if code and isinstance(position, int) and position > 0 and event.get("date"):
            history[code].append((aware(event["date"]), position))
    for events in history.values():
        events.sort()
    return history


def build() -> dict[str, list[dict[str, object]]]:
    analyzed = {row["race_analysis_id"] for row in read_csv(DATA / "race_analysis" / "race_analysis_position_timeline.csv")}
    races = {
        int(row["round"]): (row["race_analysis_id"], row["race_date"])
        for row in read_csv(DATA / "race_analysis" / "race_analysis_index.csv")
        if row["season"] == "2026" and row["race_analysis_id"] not in analyzed
    }
    candidates: dict[str, dict[int, dict[str, datetime]]] = defaultdict(lambda: defaultdict(dict))
    for row in read_csv(DATA / "canonical_fastf1" / "laps_canonical.csv"):
        if row["season"] != "2026" or row["session_code"] != "R":
            continue
        race = races.get(int(row["round"]))
        if not race or not row["lap_start_time"] or not row["lap_time_s"]:
            continue
        slug = race[0]
        try:
            lap = int(row["lap_number"])
            ended = aware(row["lap_start_time"]) + timedelta(seconds=float(row["lap_time_s"]))
        except (ValueError, OverflowError):
            continue
        code = row["driver"].upper()
        if lap < 1 or len(code) != 3:
            continue
        current = candidates[slug][lap].get(code)
        if current is None or ended < current:
            candidates[slug][lap][code] = ended

    result: dict[str, list[dict[str, object]]] = {}
    for slug, laps in sorted(candidates.items()):
        race_date = next(date for candidate_slug, date in races.values() if candidate_slug == slug)
        history = position_history(slug, race_date)
        estimated_rows: list[dict[str, object]] = []
        feed_rows: list[dict[str, object]] = []
        for lap, drivers in sorted(laps.items()):
            for position, (code, _) in enumerate(sorted(drivers.items(), key=lambda item: (item[1], item[0])), 1):
                estimated_rows.append({"code": code, "lap": lap, "position": position, "status": None, "source": "lap-timing-estimate"})
            checkpoint = min(drivers.values())
            for code in drivers:
                events = history.get(code, [])
                index = bisect_right(events, (checkpoint, 999)) - 1
                if index >= 0:
                    feed_rows.append({"code": code, "lap": lap, "position": events[index][1], "status": None, "source": "openf1-position"})
        feed_positions_by_lap: dict[int, list[int]] = defaultdict(list)
        for row in feed_rows:
            feed_positions_by_lap[int(row["lap"])].append(int(row["position"]))
        unique_positions = all(len(positions) == len(set(positions)) for positions in feed_positions_by_lap.values())
        rows = feed_rows if history and len(feed_rows) >= len(estimated_rows) * 0.95 and unique_positions else estimated_rows
        if len(rows) < 100:
            raise ValueError(f"Insufficient timed laps for {slug}: {len(rows)}")
        result[slug] = rows
    return result


if __name__ == "__main__":
    result = build()
    OUTPUT.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    for slug, rows in result.items():
        print(f"{slug}: {len(rows)} lap positions ({rows[0]['source']})")
