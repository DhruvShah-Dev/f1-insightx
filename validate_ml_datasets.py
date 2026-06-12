from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
GENERATED_DIR = DATA_DIR / "ml" / "generated"

FEATURE_FILES = [
    "pre_race_driver_features.csv",
    "pre_race_team_features.csv",
    "pre_race_track_features.csv",
]
LABEL_FILE = "race_outcome_labels.csv"
QUALITY_FILE = "data_quality_labels.csv"
REPORT_FILE = "ml_dataset_build_report.json"

REQUIRED_FEATURE_COLUMNS = {
    "feature_version",
    "source_data_version",
    "generated_at",
    "feature_cutoff_race_id",
    "target_race_id",
    "feature_set_type",
    "source_race_ids",
    "missing_flags",
    "proxy_feature_count",
    "proxy_feature_flags",
    "proxy_heavy_flag",
    "data_quality_score",
}

FORBIDDEN_FEATURE_COLUMNS = {
    "finish_position",
    "finish_band",
    "points_finish",
    "podium_flag",
    "top_five_flag",
    "dnf_flag",
    "teammate_delta",
    "label_cutoff",
    "label_quality_score",
    "position_after_cycle",
    "net_position_change",
    "strategy_success_proxy",
}

REQUIRED_LABEL_COLUMNS = {
    "label_version",
    "source_data_version",
    "generated_at",
    "target_race_id",
    "driver_id",
    "constructor_id",
    "label_cutoff",
    "finish_position",
    "points_finish",
    "points",
    "podium_flag",
    "top_five_flag",
    "dnf_flag",
    "position_delta",
    "teammate_delta",
    "label_quality_score",
    "missing_flags",
}

REQUIRED_QUALITY_COLUMNS = {
    "quality_version",
    "source_data_version",
    "generated_at",
    "target_race_id",
    "entity_type",
    "entity_id",
    "feature_table",
    "feature_completeness",
    "telemetry_coverage_flag",
    "weather_coverage_flag",
    "race_control_available_flag",
    "proxy_feature_count",
    "proxy_feature_flags",
    "proxy_heavy_flag",
    "inferred_position_flag",
    "confidence_score",
    "missing_feature_count",
    "missing_flags",
}


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False)


def race_dates() -> dict[str, pd.Timestamp]:
    races = read_csv(DATA_DIR / "curated" / "races.csv")
    races["scheduled_at"] = pd.to_datetime(races["scheduled_at"], utc=True, errors="coerce")
    return dict(zip(races["id"].astype(str), races["scheduled_at"]))


def check_bounds(frame: pd.DataFrame, file_name: str, errors: list[str]) -> None:
    for column in ["data_quality_score", "feature_completeness", "confidence_score", "label_quality_score"]:
        if column not in frame.columns:
            continue
        values = pd.to_numeric(frame[column], errors="coerce").dropna()
        if ((values < 0) | (values > 1)).any():
            errors.append(f"{file_name}: {column} contains values outside 0-1")


def check_ignored(path: Path, errors: list[str]) -> None:
    result = subprocess.run(["git", "check-ignore", "-q", str(path)], cwd=ROOT, check=False)
    if result.returncode != 0:
        errors.append(f"Generated ML artifact is not ignored by git: {path}")


def source_ids(value: Any) -> list[str]:
    if value is None or pd.isna(value):
        return []
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return []
    return [part for part in text.split(";") if part]


def clean_text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    dates = race_dates()
    frames: dict[str, pd.DataFrame] = {}

    for file_name in [*FEATURE_FILES, LABEL_FILE, QUALITY_FILE, REPORT_FILE]:
        path = GENERATED_DIR / file_name
        if not path.exists():
            errors.append(f"Missing generated ML dataset: {path}")
            continue
        check_ignored(path, errors)
        if path.suffix == ".csv":
            frames[file_name] = read_csv(path)

    for file_name in FEATURE_FILES:
        frame = frames.get(file_name)
        if frame is None:
            continue
        missing = REQUIRED_FEATURE_COLUMNS - set(frame.columns)
        if missing:
            errors.append(f"{file_name}: missing required feature columns {sorted(missing)}")
        forbidden = FORBIDDEN_FEATURE_COLUMNS & set(frame.columns)
        if forbidden:
            errors.append(f"{file_name}: contains label/post-race columns {sorted(forbidden)}")
        if "feature_set_type" in frame.columns and not (frame["feature_set_type"].astype(str) == "pre_race").all():
            errors.append(f"{file_name}: all rows must have feature_set_type=pre_race")
        check_bounds(frame, file_name, errors)

        for row in frame.to_dict("records"):
            target = clean_text(row.get("target_race_id"))
            target_date = dates.get(target)
            if target and target_date is None:
                errors.append(f"{file_name}: target race {target} not found in schedule")
                continue
            cutoff = clean_text(row.get("feature_cutoff_race_id"))
            if cutoff:
                cutoff_date = dates.get(cutoff)
                if cutoff_date is None:
                    errors.append(f"{file_name}: cutoff race {cutoff} not found in schedule")
                elif target_date is not None and cutoff_date >= target_date:
                    errors.append(f"{file_name}: cutoff {cutoff} is not before target {target}")
            for source_id in source_ids(row.get("source_race_ids")):
                source_date = dates.get(source_id)
                if source_date is None:
                    errors.append(f"{file_name}: source race {source_id} not found in schedule")
                elif target_date is not None and source_date >= target_date:
                    errors.append(f"{file_name}: source race {source_id} leaks target/future data for {target}")

    labels = frames.get(LABEL_FILE)
    if labels is not None:
        missing = REQUIRED_LABEL_COLUMNS - set(labels.columns)
        if missing:
            errors.append(f"{LABEL_FILE}: missing required label columns {sorted(missing)}")
        check_bounds(labels, LABEL_FILE, errors)
        if "label_quality_score" in labels.columns:
            label_quality = pd.to_numeric(labels["label_quality_score"], errors="coerce").dropna()
            if label_quality.nunique() <= 1:
                errors.append(f"{LABEL_FILE}: label_quality_score must vary with label completeness")

    quality = frames.get(QUALITY_FILE)
    if quality is not None:
        missing = REQUIRED_QUALITY_COLUMNS - set(quality.columns)
        if missing:
            errors.append(f"{QUALITY_FILE}: missing required quality columns {sorted(missing)}")
        check_bounds(quality, QUALITY_FILE, errors)

    report_path = GENERATED_DIR / REPORT_FILE
    if report_path.exists():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
            if report.get("validation_errors"):
                errors.extend(str(item) for item in report["validation_errors"])
        except json.JSONDecodeError:
            errors.append("ML dataset build report is not valid JSON")

    if frames.get("pre_race_driver_features.csv", pd.DataFrame()).empty:
        errors.append("pre_race_driver_features.csv has zero rows")
    if frames.get(LABEL_FILE, pd.DataFrame()).empty:
        errors.append("race_outcome_labels.csv has zero rows")

    row_counts = {name: int(frame.shape[0]) for name, frame in frames.items()}
    if row_counts.get("pre_race_driver_features.csv") != row_counts.get("race_outcome_labels.csv"):
        warnings.append("Driver feature row count differs from label row count; join must remain explicit and checked")

    result = {
        "status": "passed" if not errors else "failed",
        "errors": errors,
        "warnings": warnings,
        "row_counts": row_counts,
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
