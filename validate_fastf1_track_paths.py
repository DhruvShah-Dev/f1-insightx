from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
TRACK_PATHS = ROOT / "data" / "race_week" / "circuit_track_paths.json"
CURATED_RACES = ROOT / "data" / "curated" / "races.csv"
MAX_ARTIFACT_BYTES = 400_000
MIN_POINTS = 12
COORDINATE_PATTERN = re.compile(r"[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)")


def parse_points(path_data: str) -> list[tuple[float, float]]:
    return [(float(x), float(y)) for x, y in COORDINATE_PATTERN.findall(path_data)]


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []

    if not TRACK_PATHS.exists():
        print(f"ERROR: missing {TRACK_PATHS}")
        return 1

    payload = json.loads(TRACK_PATHS.read_text(encoding="utf-8"))
    curated = pd.read_csv(CURATED_RACES)
    known_circuits = set(curated["circuit_id"].dropna().astype(str))

    artifact_size = TRACK_PATHS.stat().st_size
    if artifact_size > MAX_ARTIFACT_BYTES:
        errors.append(f"artifact too large: {artifact_size} bytes > {MAX_ARTIFACT_BYTES}")

    for circuit_id, item in sorted(payload.items()):
        if circuit_id not in known_circuits:
            errors.append(f"{circuit_id}: not present in curated races")

        if item.get("circuitId") != circuit_id:
            errors.append(f"{circuit_id}: circuitId mismatch ({item.get('circuitId')})")

        source = str(item.get("source") or "")
        if not source.startswith("fastf1_position"):
            errors.append(f"{circuit_id}: non-FastF1 geometry source {source!r}")

        path_data = str(item.get("pathData") or "")
        points = parse_points(path_data)
        if len(points) < MIN_POINTS:
            errors.append(f"{circuit_id}: too few path points ({len(points)})")
            continue

        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        if min(xs) < -1 or max(xs) > 961 or min(ys) < -1 or max(ys) > 621:
            errors.append(
                f"{circuit_id}: path bounds outside expected viewBox "
                f"x=({min(xs):.1f},{max(xs):.1f}) y=({min(ys):.1f},{max(ys):.1f})"
            )

        width = max(xs) - min(xs)
        height = max(ys) - min(ys)
        if width < 80 or height < 80:
            warnings.append(f"{circuit_id}: narrow path bounds width={width:.1f}, height={height:.1f}")

    report = {
        "path": str(TRACK_PATHS),
        "circuits": len(payload),
        "artifact_size_bytes": artifact_size,
        "warnings": warnings,
        "errors": errors,
        "status": "passed" if not errors else "failed",
    }
    print(json.dumps(report, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
