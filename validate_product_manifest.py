from __future__ import annotations

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = ROOT / "data" / "reports" / "product_manifest.json"
REQUIRED_SURFACES = {
    "race_week",
    "strategy_lab",
    "telemetry_features",
    "analytics",
    "analytics_index",
    "canonical_fastf1",
}


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)
    except ValueError:
        return None


def load_manifest(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def validate_manifest(path: Path, *, fail_on_stale: bool = False) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not path.exists():
        return [f"missing manifest: {path.relative_to(ROOT).as_posix()}"], warnings

    manifest = load_manifest(path)
    surfaces = manifest.get("surfaces")
    if not isinstance(surfaces, dict):
        return ["manifest is missing surfaces object"], warnings

    missing_surfaces = sorted(REQUIRED_SURFACES.difference(surfaces))
    errors.extend(f"missing required surface: {surface}" for surface in missing_surfaces)

    now = datetime.now(UTC)
    for surface_name in sorted(REQUIRED_SURFACES.intersection(surfaces)):
        surface = surfaces[surface_name]
        if not isinstance(surface, dict):
            errors.append(f"{surface_name}: surface entry is invalid")
            continue

        row_counts = surface.get("row_counts")
        if not isinstance(row_counts, dict) or not row_counts:
            errors.append(f"{surface_name}: row counts are missing")
        else:
            for table, count in row_counts.items():
                if not isinstance(count, int):
                    errors.append(f"{surface_name}: {table} row count is not an integer")
                elif count <= 0:
                    errors.append(f"{surface_name}: {table} has zero rows")

        surface_errors = surface.get("errors")
        if isinstance(surface_errors, list) and surface_errors:
            errors.extend(f"{surface_name}: {item}" for item in surface_errors)

        if surface.get("validation_status") != "passed":
            errors.append(f"{surface_name}: validation status is {surface.get('validation_status')}")

        generated_at = parse_time(surface.get("generated_at"))
        stale_after_hours = surface.get("stale_after_hours")
        if generated_at is None:
            warnings.append(f"{surface_name}: generated_at is missing or invalid")
        elif isinstance(stale_after_hours, int | float):
            age_hours = (now - generated_at).total_seconds() / 3600
            if age_hours > stale_after_hours:
                message = f"{surface_name}: stale by threshold ({age_hours:.1f}h old, threshold {stale_after_hours}h)"
                if fail_on_stale:
                    errors.append(message)
                else:
                    warnings.append(message)

        artifact_paths = surface.get("artifact_paths")
        if isinstance(artifact_paths, list):
            for artifact in artifact_paths:
                artifact_path = ROOT / str(artifact)
                if not artifact_path.exists():
                    errors.append(f"{surface_name}: missing artifact path {artifact}")
        else:
            errors.append(f"{surface_name}: artifact paths are missing")

        surface_warnings = surface.get("warnings")
        if isinstance(surface_warnings, list):
            warnings.extend(f"{surface_name}: {item}" for item in surface_warnings)

    return errors, warnings


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate F1 InsightX product freshness manifest.")
    parser.add_argument("--fail-on-stale", action="store_true", help="Treat stale surfaces as validation errors.")
    parser.add_argument("--manifest", default=str(MANIFEST_PATH), help="Manifest path.")
    args = parser.parse_args()

    path = Path(args.manifest)
    if not path.is_absolute():
        path = ROOT / path

    errors, warnings = validate_manifest(path, fail_on_stale=args.fail_on_stale)

    manifest = load_manifest(path) if path.exists() else {}
    surfaces = manifest.get("surfaces", {})
    summary = {
        "manifest": path.relative_to(ROOT).as_posix() if path.exists() else str(path),
        "surfaces": sorted(surfaces.keys()) if isinstance(surfaces, dict) else [],
        "warnings": warnings,
        "errors": errors,
        "status": "passed" if not errors else "failed",
    }
    print(json.dumps(summary, indent=2))

    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
