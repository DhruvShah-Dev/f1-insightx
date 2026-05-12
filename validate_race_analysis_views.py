from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd


ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
RACE_ANALYSIS_DIR = DATA_DIR / "race_analysis"
REPORT_FILE = DATA_DIR / "reports" / "race_analysis_quality_report.json"


FILES: dict[str, dict[str, Any]] = {
    "race_analysis_index.csv": {
        "required": [
            "race_analysis_id",
            "season",
            "round",
            "event",
            "race_name",
            "session_id",
            "winner",
            "analysis_quality_score",
            "race_control_available",
        ]
    },
    "race_analysis_summary.csv": {
        "required": ["race_analysis_id", "winner", "primary_story", "confidence", "weakest_assumption"]
    },
    "race_analysis_story_points.csv": {
        "required": [
            "race_analysis_id",
            "story_point_id",
            "lap_number",
            "phase",
            "title",
            "summary",
            "evidence_type",
            "impact_score",
            "confidence",
            "data_limit_note",
        ]
    },
    "race_analysis_stints.csv": {
        "required": [
            "race_analysis_id",
            "driver",
            "stint_number",
            "compound",
            "start_lap",
            "end_lap",
            "stint_length",
            "degradation_confidence",
            "stint_quality_score",
        ]
    },
    "race_analysis_pit_strategy.csv": {
        "required": ["race_analysis_id", "driver", "pit_stop_number", "pit_lap", "confidence", "weakest_assumption"]
    },
    "race_analysis_pace_evolution.csv": {
        "required": ["race_analysis_id", "driver", "lap_number", "lap_time_s", "pace_confidence"]
    },
    "race_analysis_position_changes.csv": {
        "required": [
            "race_analysis_id",
            "driver",
            "start_position",
            "finish_position",
            "net_position_change",
            "confidence",
            "note",
        ]
    },
    "race_analysis_weather_context.csv": {
        "required": ["race_analysis_id", "lap_number", "weather_state", "confidence"]
    },
    "race_analysis_links.csv": {
        "required": ["race_analysis_id", "surface", "label", "href", "enabled", "unavailable_reason"]
    },
    "race_analysis_track_status.csv": {
        "required": [
            "race_analysis_id",
            "lap_number",
            "phase",
            "track_status_raw",
            "track_status_label",
            "confidence",
            "source",
            "note",
        ]
    },
    "race_analysis_neutralization_phases.csv": {
        "required": [
            "race_analysis_id",
            "phase_id",
            "start_lap",
            "end_lap",
            "status_label",
            "affected_laps",
            "confidence",
            "evidence_type",
            "cause_available",
            "cause_note",
        ]
    },
    "race_analysis_position_timeline.csv": {
        "required": [
            "race_analysis_id",
            "driver",
            "team",
            "lap_number",
            "position",
            "position_delta_from_start",
            "position_delta_from_previous_lap",
            "phase",
            "track_status_label",
            "confidence",
            "evidence_type",
        ]
    },
    "race_analysis_position_swing_events.csv": {
        "required": [
            "race_analysis_id",
            "event_id",
            "driver",
            "team",
            "start_lap",
            "end_lap",
            "position_delta",
            "phase",
            "event_type",
            "evidence_type",
            "confidence",
            "note",
        ]
    },
    "race_analysis_traffic_proxy.csv": {
        "required": [
            "race_analysis_id",
            "driver",
            "team",
            "lap_number",
            "phase",
            "position",
            "lap_time_s",
            "normalized_pace_delta_s",
            "traffic_proxy_label",
            "dirty_air_proxy_s",
            "drs_window_proxy",
            "confidence",
            "evidence_type",
            "note",
        ]
    },
}


FORBIDDEN_UNSUPPORTED_TERMS = re.compile(
    r"\b(?:penalty|penalties|incident|crash|collision|overtake|overtakes|passed)\b",
    re.IGNORECASE,
)
FORBIDDEN_POWER_TERMS = re.compile(r"\b(ers|battery)\b", re.IGNORECASE)
FORBIDDEN_EXACT_GAP_TERMS = re.compile(
    r"\b(?:exact gap available|exact gap measured|exact gap to|drs pass|drs eligible|within one second|within 1 second|dirty air caused|stuck behind)\b",
    re.IGNORECASE,
)


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False)


def check_confidence(frame: pd.DataFrame, file_name: str, errors: list[str]) -> None:
    confidence_columns = [
        col
        for col in frame.columns
        if col == "confidence" or col.endswith("_confidence") or col.endswith("_quality_score")
    ]
    for col in confidence_columns:
        values = pd.to_numeric(frame[col], errors="coerce").dropna()
        bad = values[(values < 0) | (values > 1)]
        if not bad.empty:
            errors.append(f"{file_name}: {col} contains values outside 0-1")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    frames: dict[str, pd.DataFrame] = {}

    for file_name, spec in FILES.items():
        path = RACE_ANALYSIS_DIR / file_name
        if not path.exists():
            errors.append(f"Missing output file: {path}")
            continue
        frame = read_csv(path)
        frames[file_name] = frame
        missing_columns = [col for col in spec["required"] if col not in frame.columns]
        if missing_columns:
            errors.append(f"{file_name}: missing required columns {missing_columns}")
        if file_name == "race_analysis_index.csv" and frame.empty:
            errors.append("race_analysis_index.csv has zero rows")
        check_confidence(frame, file_name, errors)

    index = frames.get("race_analysis_index.csv", pd.DataFrame())
    summary = frames.get("race_analysis_summary.csv", pd.DataFrame())
    if not index.empty and not summary.empty:
        missing_summary = set(index["race_analysis_id"].astype(str)) - set(summary["race_analysis_id"].astype(str))
        if missing_summary:
            errors.append(f"Missing summaries for {len(missing_summary)} race analyses")

    stints = frames.get("race_analysis_stints.csv", pd.DataFrame())
    if not stints.empty:
        start = pd.to_numeric(stints["start_lap"], errors="coerce")
        end = pd.to_numeric(stints["end_lap"], errors="coerce")
        length = pd.to_numeric(stints["stint_length"], errors="coerce")
        if ((end < start) | (length < 0)).any():
            errors.append("race_analysis_stints.csv contains impossible stint ranges")
        sparse_degradation = stints[pd.to_numeric(stints["degradation_confidence"], errors="coerce").fillna(0) < 0.5]
        if not sparse_degradation.empty:
            warnings.append(f"{len(sparse_degradation)} stints have limited degradation confidence")

    for file_name, frame in frames.items():
        text = " ".join(frame.astype(str).fillna("").agg(" ".join, axis=1).tolist())
        if FORBIDDEN_POWER_TERMS.search(text):
            errors.append(f"{file_name}: contains unsupported ERS/battery wording")
        if FORBIDDEN_UNSUPPORTED_TERMS.search(text):
            errors.append(f"{file_name}: contains unsupported overtake/incident wording")
        if FORBIDDEN_EXACT_GAP_TERMS.search(text):
            errors.append(f"{file_name}: contains exact gap/DRS wording without exact gap evidence")

    story = frames.get("race_analysis_story_points.csv", pd.DataFrame())
    if not story.empty:
        story_text = (
            story[["title", "summary", "data_limit_note"]]
            .astype(str)
            .fillna("")
            .agg(" ".join, axis=1)
        )
        unsupported = story_text[story_text.str.contains(FORBIDDEN_UNSUPPORTED_TERMS, regex=True, na=False)]
        if not unsupported.empty:
            errors.append("race_analysis_story_points.csv claims unsupported race-control/overtake causes")
        long_titles = story["title"].astype(str).str.len() > 72
        long_summaries = story["summary"].astype(str).str.len() > 170
        if long_titles.any() or long_summaries.any():
            errors.append("race_analysis_story_points.csv contains text too long for cards")
        evidence = set(story["evidence_type"].dropna().astype(str).unique())
        invalid_evidence = evidence - {"observed", "derived", "inferred"}
        if invalid_evidence:
            errors.append(f"Invalid evidence types: {sorted(invalid_evidence)}")

    track_status = frames.get("race_analysis_track_status.csv", pd.DataFrame())
    allowed_status_labels = {"green", "yellow", "safety-car", "virtual-safety-car", "red-flag", "unknown", "mixed"}
    if not track_status.empty:
        labels = set(track_status["track_status_label"].dropna().astype(str))
        invalid_labels = labels - allowed_status_labels
        if invalid_labels:
            errors.append(f"Invalid track-status labels: {sorted(invalid_labels)}")
        unknown_without_note = track_status[
            (track_status["track_status_label"].astype(str) == "unknown")
            & (~track_status["note"].astype(str).str.contains("unknown|unavailable|classified", case=False, na=False))
        ]
        if not unknown_without_note.empty:
            errors.append("Unknown track-status rows are missing uncertainty notes")
        coverage = track_status["track_status_raw"].replace("", pd.NA).notna().mean()
        if coverage < 0.95:
            warnings.append(f"Track-status coverage is incomplete ({coverage:.1%})")
    else:
        warnings.append("Track-status context unavailable")

    neutralization = frames.get("race_analysis_neutralization_phases.csv", pd.DataFrame())
    if not neutralization.empty:
        start = pd.to_numeric(neutralization["start_lap"], errors="coerce")
        end = pd.to_numeric(neutralization["end_lap"], errors="coerce")
        if (end < start).any():
            errors.append("race_analysis_neutralization_phases.csv contains impossible lap ranges")
        cause_available = neutralization["cause_available"].astype(str).str.lower().isin(["true", "1"])
        cause_note = neutralization["cause_note"].astype(str)
        cause_text_without_source = (~cause_available) & (~cause_note.str.contains("cause unavailable", case=False, na=False))
        if cause_text_without_source.any():
            errors.append("Neutralization phases must keep cause unavailable explicit when no message source exists")
        incident_without_source = (~cause_available) & cause_note.str.contains(FORBIDDEN_UNSUPPORTED_TERMS, regex=True, na=False)
        if incident_without_source.any():
            errors.append("Neutralization phases contain incident wording without race-control message source")
        invalid_phase_labels = set(neutralization["status_label"].dropna().astype(str)) - allowed_status_labels
        if invalid_phase_labels:
            errors.append(f"Invalid neutralization status labels: {sorted(invalid_phase_labels)}")
        warnings.append("Neutralization context is track-status-only; causes are unavailable")
    else:
        warnings.append("No neutralization phases generated")

    timeline = frames.get("race_analysis_position_timeline.csv", pd.DataFrame())
    if not timeline.empty:
        positions = pd.to_numeric(timeline["position"], errors="coerce")
        if positions.isna().any() or (positions < 1).any() or (positions > 30).any():
            errors.append("race_analysis_position_timeline.csv contains impossible or missing positions")
        allowed_evidence = {"derived", "inferred", "proxy"}
        invalid_evidence = set(timeline["evidence_type"].dropna().astype(str)) - allowed_evidence
        if invalid_evidence:
            errors.append(f"Invalid position timeline evidence types: {sorted(invalid_evidence)}")
        position_coverage = positions.notna().mean()
        if position_coverage < 0.95:
            warnings.append(f"Position coverage is incomplete ({position_coverage:.1%})")
        warnings.append("Position movement is inferred from lap-position timing data")
    else:
        warnings.append("Position timeline unavailable")

    swings = frames.get("race_analysis_position_swing_events.csv", pd.DataFrame())
    if not swings.empty:
        start = pd.to_numeric(swings["start_lap"], errors="coerce")
        end = pd.to_numeric(swings["end_lap"], errors="coerce")
        if (end < start).any():
            errors.append("race_analysis_position_swing_events.csv contains impossible lap ranges")
        allowed_types = {
            "pit-cycle movement",
            "track-position gain",
            "track-position loss",
            "neutralization-affected movement",
            "unclear",
        }
        invalid_types = set(swings["event_type"].dropna().astype(str)) - allowed_types
        if invalid_types:
            errors.append(f"Invalid position swing event types: {sorted(invalid_types)}")
    else:
        warnings.append("Position swing events unavailable")

    traffic = frames.get("race_analysis_traffic_proxy.csv", pd.DataFrame())
    if not traffic.empty:
        allowed_labels = {"clean-air likely", "traffic likely", "uncertain"}
        invalid_labels = set(traffic["traffic_proxy_label"].dropna().astype(str)) - allowed_labels
        if invalid_labels:
            errors.append(f"Invalid traffic proxy labels: {sorted(invalid_labels)}")
        if not traffic["drs_window_proxy"].astype(str).str.contains("proxy|gap-data-missing", case=False, na=False).all():
            errors.append("DRS window values must remain explicitly proxy/gap-missing labelled")
        if not (traffic["evidence_type"].astype(str) == "proxy").all():
            errors.append("Traffic proxy rows must use evidence_type=proxy")
        warnings.append("Traffic proxy is built without exact gap data")
    else:
        warnings.append("Traffic proxy unavailable")

    pace = frames.get("race_analysis_pace_evolution.csv", pd.DataFrame())
    if not pace.empty:
        lap_numbers = pd.to_numeric(pace["lap_number"], errors="coerce")
        if (lap_numbers <= 0).any():
            errors.append("race_analysis_pace_evolution.csv contains impossible lap numbers")

    weather = frames.get("race_analysis_weather_context.csv", pd.DataFrame())
    if not weather.empty:
        weather_coverage = weather["confidence"].astype(float).mean()
        if weather_coverage < 0.5:
            warnings.append("Weather coverage is low")
    else:
        warnings.append("Weather context unavailable")

    if not index.empty and "race_control_available" in index.columns:
        unavailable_count = (~index["race_control_available"].astype(str).str.lower().isin(["true", "1"])).sum()
        if unavailable_count:
            warnings.append(f"Race-control messages unavailable for {unavailable_count} race analyses")

    if not REPORT_FILE.exists():
        warnings.append("Race analysis quality report is missing")
    else:
        try:
            report = json.loads(REPORT_FILE.read_text(encoding="utf-8"))
            if report.get("validation_errors"):
                errors.extend([f"quality report: {err}" for err in report["validation_errors"]])
        except json.JSONDecodeError:
            errors.append("Race analysis quality report is not valid JSON")

    result = {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "rows": {name: int(frame.shape[0]) for name, frame in frames.items()},
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
