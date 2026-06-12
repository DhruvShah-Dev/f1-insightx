from __future__ import annotations

import argparse
import json
from datetime import timezone, datetime
from pathlib import Path
from typing import Any

import pandas as pd


DATA_DIR = Path(__file__).resolve().parent
REPORT_DIR = DATA_DIR / "reports"
DEFAULT_EVENT_DIR = "2026/07_barcelona-grand-prix"
DEFAULT_RACE_ID = "2026-07-catalunya"
MIN_STINT_LAPS = 3
LONG_RUN_MIN_LAPS = 5
EXPECTED_COMPOUNDS = {"HARD", "MEDIUM", "SOFT"}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False)


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def parse_bool_series(series: pd.Series) -> pd.Series:
    return series.fillna(False).astype(str).str.lower().isin(["true", "1", "yes"])


def numeric(frame: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    result = frame.copy()
    for column in columns:
        if column in result.columns:
            result[column] = pd.to_numeric(result[column], errors="coerce")
    return result


def round_or_none(value: Any, digits: int = 3) -> float | None:
    number = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(number):
        return None
    return round(float(number), digits)


def summarize_weather(weather: pd.DataFrame) -> dict[str, dict[str, float | None]]:
    if weather.empty:
        return {}
    weather = numeric(weather, ["AirTemp", "TrackTemp", "Humidity", "WindSpeed"])
    summary: dict[str, dict[str, float | None]] = {}
    for column in ["AirTemp", "TrackTemp", "Humidity", "WindSpeed"]:
        if column not in weather.columns:
            continue
        values = weather[column].dropna()
        summary[column] = {
            "min": round_or_none(values.min(), 2),
            "mean": round_or_none(values.mean(), 2),
            "max": round_or_none(values.max(), 2),
        }
    return summary


def summarize_laps(laps: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    if laps.empty:
        return laps, {
            "total_laps": 0,
            "clean_laps": 0,
            "lap_time_missing": 0,
            "blank_team_laps": 0,
            "driver_count": 0,
            "clean_driver_count": 0,
            "compounds": [],
        }

    laps = numeric(laps, ["lap_time_s", "tyre_life", "track_temp_c", "air_temp_c"])
    is_accurate = parse_bool_series(laps["is_accurate"]) if "is_accurate" in laps.columns else pd.Series(True, index=laps.index)
    is_deleted = parse_bool_series(laps["deleted"]) if "deleted" in laps.columns else pd.Series(False, index=laps.index)
    clean = laps[laps["lap_time_s"].notna() & is_accurate & ~is_deleted].copy()
    team_series = laps["team"] if "team" in laps.columns else pd.Series("", index=laps.index)
    stats = {
        "total_laps": int(len(laps)),
        "clean_laps": int(len(clean)),
        "lap_time_missing": int(laps["lap_time_s"].isna().sum()) if "lap_time_s" in laps.columns else int(len(laps)),
        "blank_team_laps": int(team_series.fillna("").astype(str).str.strip().eq("").sum()),
        "driver_count": int(laps["driver"].nunique()) if "driver" in laps.columns else 0,
        "clean_driver_count": int(clean["driver"].nunique()) if "driver" in clean.columns else 0,
        "compounds": sorted(str(value) for value in laps.get("compound", pd.Series(dtype=str)).dropna().unique()),
    }
    return clean, stats


def compound_lap_summary(clean_laps: pd.DataFrame) -> list[dict[str, Any]]:
    if clean_laps.empty:
        return []
    rows: list[dict[str, Any]] = []
    grouped = clean_laps.groupby("compound", dropna=True)
    for compound, group in grouped:
        rows.append(
            {
                "compound": str(compound),
                "clean_laps": int(len(group)),
                "drivers": int(group["driver"].nunique()) if "driver" in group.columns else 0,
                "average_lap_time_s": round_or_none(group["lap_time_s"].mean()),
                "median_lap_time_s": round_or_none(group["lap_time_s"].median()),
                "average_track_temp_c": round_or_none(group["track_temp_c"].mean()),
                "average_air_temp_c": round_or_none(group["air_temp_c"].mean()),
            }
        )
    return sorted(rows, key=lambda row: row["compound"])


def compound_stint_summary(stints: pd.DataFrame, *, min_laps: int) -> list[dict[str, Any]]:
    if stints.empty:
        return []
    stints = numeric(
        stints,
        ["lap_count", "degradation_per_lap_s", "mean_lap_time_s", "start_tyre_life", "end_tyre_life"],
    )
    filtered = stints[stints["compound"].notna() & (stints["lap_count"] >= min_laps)].copy()
    rows: list[dict[str, Any]] = []
    for compound, group in filtered.groupby("compound", dropna=True):
        rows.append(
            {
                "compound": str(compound),
                "min_laps": min_laps,
                "stints": int(len(group)),
                "drivers": int(group["driver"].nunique()) if "driver" in group.columns else 0,
                "average_degradation_s_per_lap": round_or_none(group["degradation_per_lap_s"].mean()),
                "median_degradation_s_per_lap": round_or_none(group["degradation_per_lap_s"].median()),
                "minimum_degradation_s_per_lap": round_or_none(group["degradation_per_lap_s"].min()),
                "maximum_degradation_s_per_lap": round_or_none(group["degradation_per_lap_s"].max()),
                "average_lap_count": round_or_none(group["lap_count"].mean()),
            }
        )
    return sorted(rows, key=lambda row: row["compound"])


def interpret_compounds(headline: list[dict[str, Any]], longer_runs: list[dict[str, Any]]) -> dict[str, str]:
    by_compound = {row["compound"]: row for row in headline}
    long_by_compound = {row["compound"]: row for row in longer_runs}
    hard_stints = int(by_compound.get("HARD", {}).get("stints") or 0)
    soft_median = by_compound.get("SOFT", {}).get("median_degradation_s_per_lap")
    medium_median = by_compound.get("MEDIUM", {}).get("median_degradation_s_per_lap")
    soft_long_median = long_by_compound.get("SOFT", {}).get("median_degradation_s_per_lap")

    return {
        "HARD": "Inconclusive: sample is limited in FP1 hot-track data." if hard_stints < 8 else "Usable but still lower-confidence than Medium/Soft.",
        "MEDIUM": "Most robust FP1 race-run tyre in this sample; median degradation is near zero." if medium_median is not None and medium_median <= 0.1 else "Usable, but degradation is not as stable as expected.",
        "SOFT": "Clearly heat-sensitive in FP1; longer runs show the strongest fade signal." if soft_median is not None and soft_median >= 0.75 and (soft_long_median or 0) >= 1.0 else "Higher degradation risk than Medium, but sample needs more confirmation.",
    }


def session_input_status(raw_dir: Path, staged_dir: Path) -> dict[str, Any]:
    manifest = read_json(raw_dir / "session_manifest.json")
    files = {
        "raw_manifest": raw_dir / "session_manifest.json",
        "staged_laps": staged_dir / "laps.csv",
        "staged_stints": staged_dir / "stints.csv",
        "staged_weather": staged_dir / "weather.csv",
        "raw_telemetry": raw_dir / "telemetry.parquet",
        "raw_position": raw_dir / "position.parquet",
    }
    return {
        "manifest_status": manifest.get("status"),
        "manifest_error": manifest.get("error"),
        "row_counts": manifest.get("row_counts", {}),
        "telemetry_available": bool(manifest.get("telemetry_available")),
        "position_available": bool(manifest.get("position_available")),
        "files": {name: {"path": str(path.relative_to(DATA_DIR.parent)), "exists": path.exists()} for name, path in files.items()},
    }


def build_report(event_dir: str, race_id: str) -> dict[str, Any]:
    raw_root = DATA_DIR / "raw" / "fastf1" / event_dir
    staged_root = DATA_DIR / "staged" / "fastf1" / event_dir
    fp1_raw = raw_root / "FP1"
    fp1_staged = staged_root / "fp1"
    fp2_raw = raw_root / "FP2"
    fp2_staged = staged_root / "fp2"

    laps = read_csv(fp1_staged / "laps.csv")
    stints = read_csv(fp1_staged / "stints.csv")
    weather = read_csv(fp1_staged / "weather.csv")
    clean_laps, lap_stats = summarize_laps(laps)
    headline = compound_stint_summary(stints, min_laps=MIN_STINT_LAPS)
    longer_runs = compound_stint_summary(stints, min_laps=LONG_RUN_MIN_LAPS)
    compounds = set(lap_stats["compounds"])
    short_stints = 0
    if not stints.empty and "lap_count" in stints.columns:
        stint_counts = pd.to_numeric(stints["lap_count"], errors="coerce")
        short_stints = int((stint_counts < MIN_STINT_LAPS).sum())

    validation_errors: list[str] = []
    missing_compounds = sorted(EXPECTED_COMPOUNDS.difference(compounds))
    if missing_compounds:
        validation_errors.append(f"missing expected compounds: {', '.join(missing_compounds)}")
    if any(int(row["min_laps"]) < MIN_STINT_LAPS for row in headline):
        validation_errors.append("headline degradation includes stints below minimum lap threshold")
    fp2_status = session_input_status(fp2_raw, fp2_staged)
    if fp2_status["manifest_status"] == "complete":
        validation_errors.append("FP2 is complete; this report must be regenerated with FP2 comparison instead of FP1-only conclusions")

    return {
        "schema_version": 1,
        "generated_at": utc_now(),
        "race_id": race_id,
        "event_dir": event_dir,
        "session_scope": "FP1 only; FP2 unavailable from FastF1 at generation time.",
        "hot_track_context": summarize_weather(weather),
        "fp1": {
            "input_status": session_input_status(fp1_raw, fp1_staged),
            "lap_quality": lap_stats,
            "short_stints_excluded_from_headline": short_stints,
            "clean_lap_compound_summary": compound_lap_summary(clean_laps),
            "headline_degradation_min_3_laps": headline,
            "long_run_degradation_min_5_laps": longer_runs,
            "interpretation": interpret_compounds(headline, longer_runs),
        },
        "fp2": {
            "input_status": fp2_status,
            "included_in_conclusions": False,
        },
        "missing_data_notes": [
            "FP2 has no usable FastF1 data yet and is excluded from compound conclusions.",
            "FP1 team fields are blank in FastF1 lap rows; constructor-level product views require current-driver fallback mapping.",
            "Reserve or unmapped practice-only FastF1 driver codes are not used for current-driver tyre conclusions.",
            f"Stints shorter than {MIN_STINT_LAPS} laps are excluded from headline degradation metrics.",
        ],
        "validation_errors": validation_errors,
    }


def write_compound_csv(report: dict[str, Any], path: Path) -> None:
    rows: list[dict[str, Any]] = []
    for bucket, label in [
        ("headline_degradation_min_3_laps", "stints_min_3_laps"),
        ("long_run_degradation_min_5_laps", "stints_min_5_laps"),
    ]:
        for row in report["fp1"][bucket]:
            rows.append({"scope": label, **row})
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(path, index=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze Spain GP FP1 tyre degradation in hot practice conditions.")
    parser.add_argument("--event-dir", default=DEFAULT_EVENT_DIR)
    parser.add_argument("--race-id", default=DEFAULT_RACE_ID)
    parser.add_argument("--json-output", default=str(REPORT_DIR / "spain_practice_tyre_degradation_report.json"))
    parser.add_argument("--csv-output", default=str(REPORT_DIR / "spain_practice_tyre_degradation_compounds.csv"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = build_report(args.event_dir, args.race_id)
    json_path = Path(args.json_output)
    csv_path = Path(args.csv_output)
    if not json_path.is_absolute():
        json_path = DATA_DIR.parent / json_path
    if not csv_path.is_absolute():
        csv_path = DATA_DIR.parent / csv_path
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    write_compound_csv(report, csv_path)
    print(
        json.dumps(
            {
                "report": str(json_path.relative_to(DATA_DIR.parent)),
                "compound_csv": str(csv_path.relative_to(DATA_DIR.parent)),
                "validation_errors": report["validation_errors"],
                "fp1_compounds": report["fp1"]["lap_quality"]["compounds"],
                "fp2_status": report["fp2"]["input_status"]["manifest_status"],
            },
            indent=2,
        )
    )
    if report["validation_errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
