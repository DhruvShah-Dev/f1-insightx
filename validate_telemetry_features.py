from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
sys.path.insert(0, str(DATA_DIR))


REQUIRED = {
    "telemetry_lap_summary.csv": ["season", "round", "event", "session", "driver", "lap_number", "max_speed_kph", "telemetry_quality_score"],
    "corner_speed_profile.csv": ["season", "round", "event", "session", "driver", "corner_id", "apex_speed_kph", "segmentation_confidence"],
    "corner_braking_profile.csv": ["season", "round", "event", "session", "driver", "corner_id", "brake_intensity_proxy"],
    "corner_throttle_profile.csv": ["season", "round", "event", "session", "driver", "corner_id", "traction_exit_score"],
    "straight_speed_profile.csv": ["season", "round", "event", "session", "driver", "segment_id", "terminal_speed_kph", "clipping_proxy_score"],
    "energy_deployment_proxy.csv": ["season", "round", "event", "session", "driver", "segment_id", "deployment_proxy_score", "confidence", "label"],
    "driver_corner_delta.csv": ["season", "round", "event", "session", "corner_id", "driver", "reference_driver", "apex_speed_delta_kph"],
}


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def main() -> None:
    feature_dir = DATA_DIR / "telemetry_features"
    report_path = DATA_DIR / "reports" / "telemetry_feature_quality.json"
    errors: list[str] = []
    summary: dict[str, object] = {"feature_dir": str(feature_dir), "files": {}, "row_counts": {}, "errors": errors}

    for filename, columns in REQUIRED.items():
        path = feature_dir / filename
        frame = read_csv(path)
        summary["files"][filename] = {"exists": path.exists(), "bytes": path.stat().st_size if path.exists() else 0}  # type: ignore[index]
        summary["row_counts"][filename] = int(len(frame))  # type: ignore[index]
        if frame.empty:
            errors.append(f"{filename} has zero rows")
            continue
        for column in columns:
            if column not in frame.columns:
                errors.append(f"{filename} missing {column}")
            elif frame[column].isna().all():
                errors.append(f"{filename}.{column} is entirely null")

    energy = read_csv(feature_dir / "energy_deployment_proxy.csv")
    if not energy.empty and "label" in energy.columns:
        labels = " ".join(energy["label"].dropna().astype(str).unique().tolist()).lower()
        if "not true ers" not in labels and "not true" not in labels:
            errors.append("energy_deployment_proxy label does not state proxy/not true ERS")

    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
        summary["quality_report"] = {
            "exists": True,
            "sessions_processed": report.get("sessions_processed"),
            "sessions_missing_telemetry": report.get("sessions_missing_telemetry"),
            "validation_errors": report.get("validation_errors"),
        }
        if report.get("validation_errors"):
            errors.extend(str(error) for error in report["validation_errors"])
    else:
        errors.append("data/reports/telemetry_feature_quality.json is missing")

    summary["status"] = "failed" if errors else "passed"
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
