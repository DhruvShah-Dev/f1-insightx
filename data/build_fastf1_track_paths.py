from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import pandas as pd

from f1_insightx_data.fastf1_pipeline import enable_fastf1_cache
from f1_insightx_data.settings import load_settings


SESSION_PRIORITY = ("Q", "R", "S", "FP2", "FP3", "FP1")
VIEWBOX_WIDTH = 960
VIEWBOX_HEIGHT = 620
PADDING_X = 42
PADDING_Y = 34
MIN_POINT_DISTANCE = 18.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build reusable FastF1-based circuit track paths for web rendering.",
    )
    parser.add_argument(
        "--season-from",
        type=int,
        default=2024,
        help="Only consider races from this season onward when choosing representative events.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild the track path artifact even if it already exists.",
    )
    parser.add_argument(
        "--circuit-id",
        nargs="*",
        default=[],
        help="Optional list of circuit ids to update incrementally.",
    )
    return parser.parse_args()


def main() -> None:
    import fastf1

    args = parse_args()
    settings = load_settings()
    output_path = settings.race_week_dir / "circuit_track_paths.json"
    if output_path.exists() and not args.force and not args.circuit_id:
        return

    enable_fastf1_cache(settings)
    races = pd.read_csv(settings.curated_dir / "races.csv")
    races["scheduled_at"] = pd.to_datetime(races["scheduled_at"], utc=True, errors="coerce")
    races = races[races["season"] >= args.season_from].copy()
    races = races[races["scheduled_at"].isna() | (races["scheduled_at"] <= pd.Timestamp.utcnow())].copy()
    if args.circuit_id:
        races = races[races["circuit_id"].isin(args.circuit_id)].copy()
    races["round"] = pd.to_numeric(races["round"], errors="coerce")
    races = races.dropna(subset=["season", "round", "circuit_id"])
    races = races.sort_values(["season", "round"], ascending=[False, False])

    payload: dict[str, Any] = {}
    if output_path.exists():
        payload = json.loads(output_path.read_text(encoding="utf-8"))
    schedule_cache: dict[int, Any] = {}
    for circuit_id, circuit_rows in races.groupby("circuit_id", sort=False):
        artifact = build_circuit_artifact(
            fastf1_module=fastf1,
            circuit_rows=circuit_rows.reset_index(drop=True),
            schedule_cache=schedule_cache,
        )
        if artifact:
            payload[circuit_id] = artifact

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def build_circuit_artifact(
    *,
    fastf1_module: Any,
    circuit_rows: pd.DataFrame,
    schedule_cache: dict[int, Any],
) -> dict[str, Any] | None:
    for _, row in circuit_rows.iterrows():
        season = int(row["season"])
        round_number = int(row["round"])
        race_name = str(row.get("race_name") or f"Round {round_number}")
        event = get_cached_event(
            fastf1_module=fastf1_module,
            schedule_cache=schedule_cache,
            season=season,
            round_number=round_number,
        )
        if event is None:
            continue

        for session_code in SESSION_PRIORITY:
            try:
                session = event.get_session(session_code)
                session.load(laps=True, telemetry=True, weather=False, messages=False)
                fastest_lap = session.laps.pick_fastest()
                if fastest_lap is None or fastest_lap.empty:
                    continue

                pos_data = fastest_lap.get_pos_data()
                coordinates = pos_data.loc[:, ["X", "Y"]].dropna()
                if coordinates.empty:
                    continue

                rotation = float(getattr(session.get_circuit_info(), "rotation", 0.0) or 0.0)
                rotated_points = rotate_points(coordinates.to_numpy().tolist(), math.radians(rotation))
                simplified_points = simplify_points(rotated_points, minimum_distance=MIN_POINT_DISTANCE)
                if len(simplified_points) < 12:
                    continue

                return {
                    "circuitId": str(row["circuit_id"]),
                    "season": season,
                    "round": round_number,
                    "raceName": race_name,
                    "sessionCode": session_code,
                    "source": "fastf1_position_data",
                    "rotationDegrees": rotation,
                    "pathData": fit_points_to_path(simplified_points),
                }
            except Exception:
                continue

    return None


def get_cached_event(
    *,
    fastf1_module: Any,
    schedule_cache: dict[int, Any],
    season: int,
    round_number: int,
) -> Any | None:
    if season not in schedule_cache:
        schedule_cache[season] = fastf1_module.get_event_schedule(season, include_testing=False)

    schedule = schedule_cache[season]
    matching = schedule[schedule["RoundNumber"] == round_number]
    if matching.empty:
        return None
    return matching.iloc[0]


def rotate_points(points: list[list[float]], angle_radians: float) -> list[tuple[float, float]]:
    cos_angle = math.cos(angle_radians)
    sin_angle = math.sin(angle_radians)
    rotated: list[tuple[float, float]] = []
    for x, y in points:
        rotated_x = x * cos_angle + y * sin_angle
        rotated_y = -x * sin_angle + y * cos_angle
        rotated.append((rotated_x, rotated_y))
    return rotated


def simplify_points(points: list[tuple[float, float]], *, minimum_distance: float) -> list[tuple[float, float]]:
    if not points:
        return []

    simplified = [points[0]]
    last_x, last_y = points[0]
    for x, y in points[1:]:
        distance = math.hypot(x - last_x, y - last_y)
        if distance < minimum_distance:
            continue
        simplified.append((x, y))
        last_x, last_y = x, y

    if simplified[-1] != points[-1]:
        simplified.append(points[-1])
    return simplified


def fit_points_to_path(points: list[tuple[float, float]]) -> str:
    min_x = min(x for x, _ in points)
    max_x = max(x for x, _ in points)
    min_y = min(y for _, y in points)
    max_y = max(y for _, y in points)
    width = max(max_x - min_x, 1.0)
    height = max(max_y - min_y, 1.0)
    usable_width = VIEWBOX_WIDTH - PADDING_X * 2
    usable_height = VIEWBOX_HEIGHT - PADDING_Y * 2
    scale = min(usable_width / width, usable_height / height)
    offset_x = (VIEWBOX_WIDTH - width * scale) / 2
    offset_y = (VIEWBOX_HEIGHT - height * scale) / 2

    commands: list[str] = []
    for index, (x, y) in enumerate(points):
        projected_x = offset_x + (x - min_x) * scale
        projected_y = VIEWBOX_HEIGHT - offset_y - (y - min_y) * scale
        command = "M" if index == 0 else "L"
        commands.append(f"{command} {projected_x:.2f} {projected_y:.2f}")
    return " ".join(commands)


if __name__ == "__main__":
    main()
