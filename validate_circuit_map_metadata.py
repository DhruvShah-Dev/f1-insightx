from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any


METADATA_PATH = Path("apps/web/src/lib/ui/circuit-map-metadata.json")
TRACK_PATH = Path("data/race_week/circuit_track_paths.json")
RACES_PATH = Path("data/curated/races.csv")


def fail(message: str) -> None:
    raise SystemExit(f"Circuit map metadata validation failed: {message}")


def parse_viewbox(value: str) -> tuple[float, float, float, float]:
    parts = [float(part) for part in value.split()]
    if len(parts) != 4:
        fail(f"invalid viewBox {value!r}")
    return parts[0], parts[1], parts[2], parts[3]


def assert_point_inside(point: dict[str, Any], viewbox: tuple[float, float, float, float], label: str) -> None:
    x0, y0, width, height = viewbox
    x = float(point["x"])
    y = float(point["y"])
    if not (x0 <= x <= x0 + width and y0 <= y <= y0 + height):
        fail(f"{label} point {point} outside viewBox {viewbox}")


def validate_sector_ranges(circuit_id: str, sectors: list[dict[str, Any]]) -> None:
    if len(sectors) != 3:
        fail(f"{circuit_id} must have exactly 3 sectors")
    starts = [float(sector["startPercent"]) for sector in sectors]
    ends = [float(sector["endPercent"]) for sector in sectors]
    if abs(starts[0] - 0) > 0.01 or abs(ends[-1] - 100) > 0.01:
        fail(f"{circuit_id} sector guide must cover 0-100")
    for index in range(1, len(sectors)):
        if abs(starts[index] - ends[index - 1]) > 0.2:
            fail(f"{circuit_id} sector ranges must be contiguous")
    for sector in sectors:
        if float(sector["endPercent"]) <= float(sector["startPercent"]):
            fail(f"{circuit_id} sector has non-positive length: {sector}")


def validate_metadata(circuit_id: str, metadata: dict[str, Any], has_track_path: bool) -> None:
    if metadata.get("circuitId") != circuit_id:
        fail(f"{circuit_id} circuitId mismatch")
    if not metadata.get("source") or not metadata.get("note"):
        fail(f"{circuit_id} requires source and note")

    if metadata.get("geometryPending"):
        if has_track_path:
            fail(f"{circuit_id} cannot be geometryPending when track path exists")
        return

    if not has_track_path:
        fail(f"{circuit_id} has metadata but no real track path")

    viewbox = parse_viewbox(str(metadata.get("viewBox", "")))
    validate_sector_ranges(circuit_id, metadata.get("sectors", []))
    assert_point_inside(metadata["startFinish"], viewbox, f"{circuit_id} startFinish")

    corners = metadata.get("corners", [])
    if len(corners) < 3:
        fail(f"{circuit_id} must have at least 3 corner markers or be geometryPending")
    numbers = [str(corner["number"]) for corner in corners]
    if len(numbers) != len(set(numbers)):
        fail(f"{circuit_id} has duplicate corner numbers")
    for corner in corners:
        if not str(corner.get("label", "")).strip():
            fail(f"{circuit_id} corner {corner.get('number')} missing label")
        assert_point_inside(corner, viewbox, f"{circuit_id} corner {corner.get('number')}")
        if "anchor" in corner:
            assert_point_inside(corner["anchor"], viewbox, f"{circuit_id} corner anchor {corner.get('number')}")

    for callout in [*metadata.get("drsZones", []), *metadata.get("speedTraps", [])]:
        if metadata.get("verified") is not True:
            fail(f"{circuit_id} has callouts but metadata is not verified")
        assert_point_inside(callout["anchor"], viewbox, f"{circuit_id} callout anchor")
        assert_point_inside(callout["labelPosition"], viewbox, f"{circuit_id} callout label")


def main() -> None:
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    track_paths = json.loads(TRACK_PATH.read_text(encoding="utf-8"))
    with RACES_PATH.open(newline="", encoding="utf-8") as handle:
        races_2026 = [row for row in csv.DictReader(handle) if row["season"] == "2026"]

    circuit_ids = [row["circuit_id"] for row in sorted(races_2026, key=lambda row: int(row["round"]))]
    missing = [circuit_id for circuit_id in circuit_ids if circuit_id not in metadata]
    if missing:
        fail(f"missing 2026 metadata entries: {', '.join(missing)}")

    for circuit_id in circuit_ids:
        validate_metadata(circuit_id, metadata[circuit_id], circuit_id in track_paths)

    if not metadata.get("madring", {}).get("geometryPending"):
        fail("madring must be explicitly geometryPending until real geometry exists")

    print(json.dumps({"status": "passed", "circuits": len(circuit_ids), "geometryPending": ["madring"]}, indent=2))


if __name__ == "__main__":
    main()
