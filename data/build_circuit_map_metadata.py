from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from build_fastf1_track_paths import (
    PADDING_X,
    PADDING_Y,
    VIEWBOX_HEIGHT,
    VIEWBOX_WIDTH,
    find_raw_round_dir,
    select_representative_position_lap,
    simplify_points,
)
from f1_insightx_data.fastf1_pipeline import enable_fastf1_cache
from f1_insightx_data.settings import load_settings


SECTOR_COLORS = ("#ff3f76", "#38bdf8", "#f6d84a")
MIN_METADATA_CORNERS = 3


def fit_transform(points: list[tuple[float, float]]) -> dict[str, float]:
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
    return {
        "min_x": min_x,
        "min_y": min_y,
        "scale": scale,
        "offset_x": offset_x,
        "offset_y": offset_y,
    }


def project_point(x: float, y: float, transform: dict[str, float]) -> tuple[float, float]:
    projected_x = transform["offset_x"] + (x - transform["min_x"]) * transform["scale"]
    projected_y = VIEWBOX_HEIGHT - transform["offset_y"] - (y - transform["min_y"]) * transform["scale"]
    return round(projected_x, 1), round(projected_y, 1)


def default_sectors() -> list[dict[str, Any]]:
    return [
        {"id": "sector-1", "label": "Sector 1", "startPercent": 0, "endPercent": 33.3, "color": SECTOR_COLORS[0]},
        {"id": "sector-2", "label": "Sector 2", "startPercent": 33.3, "endPercent": 66.6, "color": SECTOR_COLORS[1]},
        {"id": "sector-3", "label": "Sector 3", "startPercent": 66.6, "endPercent": 100, "color": SECTOR_COLORS[2]},
    ]


def find_position_path(settings: Any, artifact: dict[str, Any]) -> Path | None:
    round_dir = find_raw_round_dir(settings.raw_fastf1_dir, int(artifact["season"]), int(artifact["round"]))
    if round_dir is None:
        return None
    position_path = round_dir / str(artifact["sessionCode"]) / "position.parquet"
    return position_path if position_path.exists() else None


def build_metadata_for_artifact(settings: Any, fastf1: Any, artifact: dict[str, Any]) -> dict[str, Any] | None:
    position_path = find_position_path(settings, artifact)
    if position_path is None:
        return None

    position = pd.read_parquet(position_path, columns=["driver", "lap_number", "X", "Y"])
    coordinates = select_representative_position_lap(position)
    if coordinates is None:
        return None

    simplified = simplify_points(coordinates, minimum_distance=18.0)
    if len(simplified) < 12:
        return None

    transform = fit_transform(simplified)

    try:
        event = fastf1.get_event(int(artifact["season"]), int(artifact["round"]))
        session = event.get_session(str(artifact["sessionCode"]))
        session.load(laps=True, telemetry=False, weather=False, messages=False)
        circuit_info = session.get_circuit_info()
        corners = circuit_info.corners.copy()
    except Exception:
        return None

    if corners.empty or not {"X", "Y", "Number"}.issubset(corners.columns):
        return None

    markers: list[dict[str, Any]] = []
    for _, row in corners.sort_values(["Number", "Letter"]).iterrows():
        try:
            number = int(row["Number"])
            x, y = project_point(float(row["X"]), float(row["Y"]), transform)
        except Exception:
            continue
        if not (0 <= x <= VIEWBOX_WIDTH and 0 <= y <= VIEWBOX_HEIGHT):
            continue
        letter = str(row.get("Letter") or "").strip()
        display_number = f"{number}{letter}" if letter else number
        label = f"Turn {display_number}"
        markers.append({"number": display_number, "x": x, "y": y, "label": label})

    if len(markers) < MIN_METADATA_CORNERS:
        return None

    start_x, start_y = project_point(simplified[0][0], simplified[0][1], transform)
    return {
        "circuitId": artifact["circuitId"],
        "viewBox": "0 0 960 620",
        "corners": markers,
        "sectors": default_sectors(),
        "drsZones": [],
        "speedTraps": [],
        "startFinish": {"x": start_x, "y": start_y},
        "source": f"FastF1 circuit_info corners aligned to {artifact['source']} track path",
        "verified": False,
        "note": "Corner numbers are FastF1-supported visual annotations. Public exact corner names are withheld until manually verified.",
    }


def main() -> None:
    settings = load_settings()
    enable_fastf1_cache(settings)

    import fastf1

    races = pd.read_csv(settings.curated_dir / "races.csv")
    season_2026 = races[races["season"] == 2026].copy()
    track_paths = json.loads((settings.race_week_dir / "circuit_track_paths.json").read_text(encoding="utf-8"))
    output_path = Path("apps/web/src/lib/ui/circuit-map-metadata.json")

    payload: dict[str, Any] = {}
    for _, race in season_2026.sort_values("round").iterrows():
        circuit_id = str(race["circuit_id"])
        artifact = track_paths.get(circuit_id)
        if artifact is None:
            payload[circuit_id] = {
                "circuitId": circuit_id,
                "geometryPending": True,
                "source": "No FastF1-derived track path artifact available",
                "verified": False,
                "note": "Track geometry unavailable; do not render a fake circuit.",
            }
            continue

        metadata = build_metadata_for_artifact(settings, fastf1, artifact)
        if metadata is not None:
            payload[circuit_id] = metadata
        else:
            payload[circuit_id] = {
                "circuitId": circuit_id,
                "viewBox": "0 0 960 620",
                "corners": [],
                "sectors": default_sectors(),
                "drsZones": [],
                "speedTraps": [],
                "startFinish": {"x": 480, "y": 310},
                "source": f"{artifact['source']} track path; corner metadata pending",
                "verified": False,
                "note": "Real geometry is available, but corner markers are withheld until metadata can be aligned safely.",
            }

    output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
