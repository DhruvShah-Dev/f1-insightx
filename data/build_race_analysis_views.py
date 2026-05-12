from __future__ import annotations

import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


DATA_DIR = Path(__file__).resolve().parent
ROOT_DIR = DATA_DIR.parent
CANONICAL_DIR = DATA_DIR / "canonical_fastf1"
CURATED_DIR = DATA_DIR / "curated"
STRATEGY_DIR = DATA_DIR / "strategy_lab"
ANALYTICS_DIR = DATA_DIR / "analytics"
OUTPUT_DIR = DATA_DIR / "race_analysis"
REPORT_DIR = DATA_DIR / "reports"
BUILD_VERSION = "race-analysis-v1"


OUTPUT_FILES = {
    "index": OUTPUT_DIR / "race_analysis_index.csv",
    "summary": OUTPUT_DIR / "race_analysis_summary.csv",
    "story_points": OUTPUT_DIR / "race_analysis_story_points.csv",
    "stints": OUTPUT_DIR / "race_analysis_stints.csv",
    "pit_strategy": OUTPUT_DIR / "race_analysis_pit_strategy.csv",
    "pace_evolution": OUTPUT_DIR / "race_analysis_pace_evolution.csv",
    "position_changes": OUTPUT_DIR / "race_analysis_position_changes.csv",
    "weather_context": OUTPUT_DIR / "race_analysis_weather_context.csv",
    "links": OUTPUT_DIR / "race_analysis_links.csv",
    "track_status": OUTPUT_DIR / "race_analysis_track_status.csv",
    "neutralization_phases": OUTPUT_DIR / "race_analysis_neutralization_phases.csv",
    "position_timeline": OUTPUT_DIR / "race_analysis_position_timeline.csv",
    "position_swing_events": OUTPUT_DIR / "race_analysis_position_swing_events.csv",
    "traffic_proxy": OUTPUT_DIR / "race_analysis_traffic_proxy.csv",
}
REPORT_FILE = REPORT_DIR / "race_analysis_quality_report.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_csv(path: Path, **kwargs: Any) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, low_memory=False, **kwargs)


def write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=columns).to_csv(path, index=False)


def to_num(value: Any, default: float | None = None) -> float | None:
    converted = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(converted):
        return default
    return float(converted)


def to_int(value: Any, default: int | None = None) -> int | None:
    number = to_num(value)
    if number is None:
        return default
    return int(number)


def safe_text(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def clamp01(value: Any, default: float = 0.0) -> float:
    number = to_num(value, default)
    if number is None or math.isnan(number):
        return default
    return round(max(0.0, min(1.0, number)), 3)


def seconds_label(value: Any) -> str:
    number = to_num(value)
    if number is None:
        return "unknown pace"
    return f"{number:.2f}s"


def stop_label(stop_count: int) -> str:
    if stop_count <= 0:
        return "no-stop"
    if stop_count == 1:
        return "one-stop"
    if stop_count == 2:
        return "two-stop"
    return f"{stop_count}-stop"


def race_phase(lap_number: Any, max_lap: int) -> str:
    lap = to_num(lap_number, 0) or 0
    if max_lap <= 0:
        return "race"
    ratio = lap / max_lap
    if ratio <= 0.2:
        return "opening"
    if ratio <= 0.75:
        return "middle"
    return "closing"


def weather_state(rainfall: Any, humidity: Any) -> str:
    rain = bool(to_num(rainfall, 0) or 0)
    humid = to_num(humidity, 0) or 0
    if rain and humid >= 85:
        return "wet"
    if rain:
        return "damp"
    return "dry"


def normalize_track_status(value: Any) -> str:
    text = safe_text(value)
    if not text:
        return ""
    if text.endswith(".0"):
        text = text[:-2]
    return "".join(char for char in text if char.isdigit())


def track_status_metadata(raw_status: Any) -> tuple[str, float, str]:
    """Map FastF1 track status codes to conservative product labels.

    FastF1 documents single status codes: 1 clear, 2 yellow, 4 safety car,
    5 red flag, 6 VSC deployed, 7 VSC ending. Race lap rows can contain mixed
    codes when status changes during a lap, so mixed laps stay intentionally
    broad and cause-free.
    """
    normalized = normalize_track_status(raw_status)
    if not normalized:
        return "unknown", 0.2, "Track-status code unavailable."
    statuses = set(normalized)
    unknown = statuses - set("1234567")
    if unknown or "3" in statuses:
        return "unknown", 0.3, "FastF1 track-status code is unknown or undocumented."
    non_green = statuses - {"1"}
    if not non_green:
        return "green", 0.95, "Track clear in FastF1 track-status feed."
    if len(non_green) > 1:
        return "mixed", 0.65, "Multiple FastF1 track-status codes occurred within this lap; cause unavailable."
    code = next(iter(non_green))
    mapping = {
        "2": ("yellow", 0.85, "Yellow flag from FastF1 track-status feed; sectors and cause unavailable."),
        "4": ("safety-car", 0.85, "Safety-car status from FastF1 track-status feed; cause unavailable."),
        "5": ("red-flag", 0.85, "Red-flag status from FastF1 track-status feed; cause unavailable."),
        "6": ("virtual-safety-car", 0.85, "Virtual-safety-car status from FastF1 track-status feed; cause unavailable."),
        "7": ("virtual-safety-car", 0.75, "Virtual-safety-car ending status; cause unavailable."),
    }
    return mapping.get(code, ("unknown", 0.3, "Track-status code could not be classified."))


def compound_phase(stint_length: int) -> str:
    if stint_length <= 8:
        return "short"
    if stint_length <= 24:
        return "medium"
    return "long"


def quality_tier(score: float) -> str:
    if score >= 0.78:
        return "strong"
    if score >= 0.55:
        return "moderate"
    return "limited"


def normalized_key(value: Any) -> str:
    text = safe_text(value).lower()
    return re.sub(r"[^a-z0-9]+", "", text)


def build_race_lookup(races: pd.DataFrame) -> dict[tuple[int, int], dict[str, Any]]:
    lookup: dict[tuple[int, int], dict[str, Any]] = {}
    if races.empty:
        return lookup
    for row in races.to_dict("records"):
        season = to_int(row.get("season"))
        rnd = to_int(row.get("round"))
        if season is None or rnd is None:
            continue
        lookup[(season, rnd)] = row
    return lookup


def build_archetype_lookup(archetypes: pd.DataFrame) -> dict[tuple[int, int], dict[str, Any]]:
    lookup: dict[tuple[int, int], dict[str, Any]] = {}
    if archetypes.empty:
        return lookup
    for row in archetypes.to_dict("records"):
        season = to_int(row.get("season"))
        rnd = to_int(row.get("round"))
        if season is None or rnd is None:
            continue
        lookup[(season, rnd)] = row
    return lookup


def ranked_results(results: pd.DataFrame) -> pd.DataFrame:
    ranked = results.copy()
    ranked["position_num"] = pd.to_numeric(ranked.get("position"), errors="coerce")
    ranked = ranked.sort_values(["position_num", "abbreviation"], na_position="last")
    return ranked


def driver_display(row: pd.Series | dict[str, Any]) -> str:
    code = safe_text(row.get("abbreviation") if isinstance(row, dict) else row.get("abbreviation"))
    if code:
        return code
    return safe_text(row.get("driver") if isinstance(row, dict) else row.get("driver"))


def team_display(row: pd.Series | dict[str, Any]) -> str:
    return safe_text(row.get("team_name") if isinstance(row, dict) else row.get("team_name")) or safe_text(
        row.get("team") if isinstance(row, dict) else row.get("team")
    )


def lap_quality(laps: pd.DataFrame) -> float:
    if laps.empty:
        return 0.0
    valid_laps = pd.to_numeric(laps.get("lap_time_s"), errors="coerce").notna().mean()
    valid_positions = pd.to_numeric(laps.get("position"), errors="coerce").notna().mean()
    weather_cols = ["air_temp_c", "track_temp_c", "humidity_pct", "rainfall", "wind_speed_mps"]
    weather_cov = laps[[col for col in weather_cols if col in laps.columns]].notna().mean().mean()
    if pd.isna(weather_cov):
        weather_cov = 0.0
    return clamp01((0.55 * valid_laps) + (0.25 * valid_positions) + (0.20 * float(weather_cov)))


def degradation_slope(group: pd.DataFrame) -> tuple[float | None, float]:
    valid = group.dropna(subset=["lap_time_s", "lap_number"]).copy()
    valid = valid[pd.to_numeric(valid["lap_time_s"], errors="coerce").notna()]
    if len(valid) < 5:
        return None, 0.35
    x = pd.to_numeric(valid["lap_number"], errors="coerce").astype(float)
    y = pd.to_numeric(valid["lap_time_s"], errors="coerce").astype(float)
    try:
        slope = float(np.polyfit(x, y, 1)[0])
    except (TypeError, ValueError, np.linalg.LinAlgError):
        return None, 0.35
    return round(slope, 4), clamp01(min(0.9, 0.35 + (len(valid) / 30)))


def build_driver_stints(race_id: str, race_laps: pd.DataFrame) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if race_laps.empty:
        return rows
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps["lap_number"], errors="coerce")
    laps["stint"] = pd.to_numeric(laps["stint"], errors="coerce")
    laps["lap_time_s"] = pd.to_numeric(laps["lap_time_s"], errors="coerce")
    for (driver, stint), group in laps.dropna(subset=["stint"]).groupby(["driver", "stint"], sort=True):
        start_lap = to_int(group["lap_number"].min(), 0) or 0
        end_lap = to_int(group["lap_number"].max(), start_lap) or start_lap
        length = max(0, end_lap - start_lap + 1)
        valid = group.dropna(subset=["lap_time_s"])
        slope, confidence = degradation_slope(group)
        rows.append(
            {
                "race_analysis_id": race_id,
                "driver": safe_text(driver),
                "team": safe_text(group["team"].dropna().iloc[0]) if "team" in group and group["team"].notna().any() else "",
                "stint_number": int(stint),
                "compound": safe_text(group["compound"].dropna().iloc[0]) if group["compound"].notna().any() else "",
                "start_lap": start_lap,
                "end_lap": end_lap,
                "stint_length": length,
                "avg_lap_time_s": round(float(valid["lap_time_s"].mean()), 3) if not valid.empty else "",
                "median_lap_time_s": round(float(valid["lap_time_s"].median()), 3) if not valid.empty else "",
                "best_lap_time_s": round(float(valid["lap_time_s"].min()), 3) if not valid.empty else "",
                "degradation_s_per_lap": slope if slope is not None else "",
                "degradation_confidence": confidence,
                "pace_rank_in_stint": "",
                "compound_phase": compound_phase(length),
                "traffic_adjusted_flag": False,
                "stint_quality_score": clamp01((0.7 * confidence) + (0.3 if length >= 4 else 0.1)),
                "note": "Timing-derived; traffic and gaps are not directly measured.",
            }
        )
    frame = pd.DataFrame(rows)
    if not frame.empty:
        frame["avg_num"] = pd.to_numeric(frame["avg_lap_time_s"], errors="coerce")
        frame["pace_rank_in_stint"] = frame.groupby("stint_number")["avg_num"].rank(method="min").astype("Int64")
        rows = frame.drop(columns=["avg_num"]).to_dict("records")
    return rows


def build_pace_evolution(race_id: str, race_laps: pd.DataFrame) -> list[dict[str, Any]]:
    if race_laps.empty:
        return []
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps["lap_number"], errors="coerce")
    laps["lap_time_s"] = pd.to_numeric(laps["lap_time_s"], errors="coerce")
    laps["tyre_life"] = pd.to_numeric(laps["tyre_life"], errors="coerce")
    laps["position"] = pd.to_numeric(laps["position"], errors="coerce")
    laps = laps.dropna(subset=["lap_number"]).sort_values(["driver", "lap_number"])
    max_lap = to_int(laps["lap_number"].max(), 0) or 0
    field_median = laps.groupby("lap_number")["lap_time_s"].median()
    laps["normalized_pace_delta_s"] = laps.apply(
        lambda row: row["lap_time_s"] - field_median.get(row["lap_number"], np.nan)
        if pd.notna(row["lap_time_s"])
        else np.nan,
        axis=1,
    )
    laps["field_rank_on_lap"] = laps.groupby("lap_number")["lap_time_s"].rank(method="min")
    laps["rolling_pace_delta_s"] = laps.groupby("driver")["normalized_pace_delta_s"].transform(
        lambda series: series.rolling(3, min_periods=1).mean()
    )
    start_track_temp = to_num(laps["track_temp_c"].dropna().iloc[0]) if "track_temp_c" in laps and laps["track_temp_c"].notna().any() else None
    rows: list[dict[str, Any]] = []
    for row in laps.to_dict("records"):
        lap_number = to_int(row.get("lap_number"), 0) or 0
        rainfall = bool(to_num(row.get("rainfall"), 0) or 0)
        track_temp = to_num(row.get("track_temp_c"))
        weather_adjusted = rainfall or (
            start_track_temp is not None and track_temp is not None and abs(track_temp - start_track_temp) >= 5
        )
        normalized_delta = to_num(row.get("normalized_pace_delta_s"))
        fuel_correction = lap_number * 0.035
        rows.append(
            {
                "race_analysis_id": race_id,
                "driver": safe_text(row.get("driver")),
                "team": safe_text(row.get("team")),
                "lap_number": lap_number,
                "race_phase": race_phase(lap_number, max_lap),
                "compound": safe_text(row.get("compound")),
                "stint_number": to_int(row.get("stint"), ""),
                "lap_time_s": round(to_num(row.get("lap_time_s"), 0) or 0, 3) if to_num(row.get("lap_time_s")) is not None else "",
                "normalized_pace_delta_s": round(normalized_delta, 3) if normalized_delta is not None else "",
                "field_rank_on_lap": to_int(row.get("field_rank_on_lap"), ""),
                "rolling_pace_delta_s": round(to_num(row.get("rolling_pace_delta_s"), 0) or 0, 3)
                if to_num(row.get("rolling_pace_delta_s")) is not None
                else "",
                "tyre_age": to_int(row.get("tyre_life"), ""),
                "fuel_corrected_delta_s": round((normalized_delta or 0) + fuel_correction, 3)
                if normalized_delta is not None
                else "",
                "weather_adjusted_flag": weather_adjusted,
                "pace_confidence": clamp01(0.72 if to_num(row.get("lap_time_s")) is not None else 0.35),
            }
        )
    return rows


def pit_laps_by_driver(stint_rows: list[dict[str, Any]]) -> dict[str, list[int]]:
    result: dict[str, list[int]] = {}
    frame = pd.DataFrame(stint_rows)
    if frame.empty:
        return result
    for driver, group in frame.groupby("driver", sort=True):
        laps = []
        ordered = group.sort_values("stint_number")
        for _, row in ordered.iloc[1:].iterrows():
            start_lap = to_int(row.get("start_lap"))
            if start_lap is not None:
                laps.append(max(1, start_lap - 1))
        result[safe_text(driver)] = laps
    return result


def build_pit_strategy(race_id: str, race_laps: pd.DataFrame, stint_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    frame = pd.DataFrame(stint_rows)
    if frame.empty or race_laps.empty:
        return rows
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps["lap_number"], errors="coerce")
    laps["position"] = pd.to_numeric(laps["position"], errors="coerce")
    laps["lap_time_s"] = pd.to_numeric(laps["lap_time_s"], errors="coerce")
    for driver, group in frame.groupby("driver", sort=True):
        ordered = group.sort_values("stint_number")
        driver_laps = laps[laps["driver"] == driver].sort_values("lap_number")
        valid_driver_times = driver_laps["lap_time_s"].dropna()
        median_lap = to_num(valid_driver_times.median()) if not valid_driver_times.empty else None
        for idx in range(1, len(ordered)):
            previous = ordered.iloc[idx - 1]
            current = ordered.iloc[idx]
            pit_lap = max(1, to_int(current.get("start_lap"), 1) - 1)
            before = driver_laps[driver_laps["lap_number"] <= pit_lap].tail(1)
            after = driver_laps[driver_laps["lap_number"] >= pit_lap + 2].head(1)
            position_before = to_int(before["position"].iloc[0]) if not before.empty else None
            position_after = to_int(after["position"].iloc[0]) if not after.empty else None
            net_change = (position_before - position_after) if position_before is not None and position_after is not None else None
            pit_lap_time = to_num(before["lap_time_s"].iloc[0]) if not before.empty else None
            out_lap_time = to_num(after["lap_time_s"].iloc[0]) if not after.empty else None
            pit_loss = None
            traffic_proxy = None
            if median_lap is not None and pit_lap_time is not None and out_lap_time is not None:
                pit_loss = max(0.0, pit_lap_time + out_lap_time - (2 * median_lap))
                traffic_proxy = max(0.0, out_lap_time - median_lap)
            if net_change is None:
                label = "pit-cycle unknown"
                effect = "Pit-cycle effect is unavailable."
            elif net_change > 0:
                label = "gained after stop"
                effect = "Pit cycle improved track position proxy."
            elif net_change < 0:
                label = "lost after stop"
                effect = "Pit cycle cost track position proxy."
            else:
                label = "neutral stop"
                effect = "Pit cycle kept track position proxy stable."
            rows.append(
                {
                    "race_analysis_id": race_id,
                    "driver": safe_text(driver),
                    "team": safe_text(current.get("team")),
                    "pit_stop_number": idx,
                    "pit_lap": pit_lap,
                    "compound_from": safe_text(previous.get("compound")),
                    "compound_to": safe_text(current.get("compound")),
                    "stint_length_before": to_int(previous.get("stint_length"), ""),
                    "position_before_pit": position_before if position_before is not None else "",
                    "position_after_cycle": position_after if position_after is not None else "",
                    "net_position_change": net_change if net_change is not None else "",
                    "estimated_pit_loss_s": round(pit_loss, 3) if pit_loss is not None else "",
                    "undercut_overcut_label": label,
                    "rejoin_risk": "high" if position_after and position_after > 10 else "medium" if position_after and position_after > 5 else "low",
                    "traffic_penalty_proxy_s": round(traffic_proxy, 3) if traffic_proxy is not None else "",
                    "strategy_effect": effect,
                    "confidence": clamp01(0.62 if net_change is not None else 0.38),
                    "weakest_assumption": "Pit-cycle position is a lap-position proxy; no gap feed is available.",
                }
            )
    return rows


def build_position_changes(
    race_id: str, race_laps: pd.DataFrame, race_results: pd.DataFrame, pit_laps: dict[str, list[int]]
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if race_results.empty:
        return rows
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps.get("lap_number"), errors="coerce")
    laps["position"] = pd.to_numeric(laps.get("position"), errors="coerce")
    result_rows = ranked_results(race_results)
    for _, result in result_rows.iterrows():
        driver = driver_display(result)
        driver_laps = laps[laps["driver"] == driver].dropna(subset=["lap_number", "position"]).sort_values("lap_number")
        start_position = to_int(result.get("grid_position"))
        finish_position = to_int(result.get("position"))
        if start_position is None and not driver_laps.empty:
            start_position = to_int(driver_laps["position"].iloc[0])
        net_change = (start_position - finish_position) if start_position is not None and finish_position is not None else None
        on_track_gain = 0.0
        pit_gain = 0.0
        largest_gain = ("", 0.0)
        largest_loss = ("", 0.0)
        volatility = 0.0
        previous_position = None
        for lap in driver_laps.to_dict("records"):
            lap_number = to_int(lap.get("lap_number"), 0) or 0
            position = to_num(lap.get("position"))
            if previous_position is not None and position is not None:
                delta = previous_position - position
                volatility += abs(delta)
                is_pit_window = any(abs(lap_number - pit_lap) <= 2 for pit_lap in pit_laps.get(driver, []))
                if delta > 0 and is_pit_window:
                    pit_gain += delta
                elif delta > 0:
                    on_track_gain += delta
                if delta > largest_gain[1]:
                    largest_gain = (race_phase(lap_number, to_int(driver_laps["lap_number"].max(), 0) or 0), delta)
                if -delta > largest_loss[1]:
                    largest_loss = (race_phase(lap_number, to_int(driver_laps["lap_number"].max(), 0) or 0), -delta)
            previous_position = position
        rows.append(
            {
                "race_analysis_id": race_id,
                "driver": driver,
                "team": team_display(result),
                "start_position": start_position if start_position is not None else "",
                "finish_position": finish_position if finish_position is not None else "",
                "net_position_change": net_change if net_change is not None else "",
                "positions_gained_on_track_proxy": round(on_track_gain, 1),
                "positions_gained_in_pit_cycles_proxy": round(pit_gain, 1),
                "largest_gain_phase": largest_gain[0] or "none",
                "largest_loss_phase": largest_loss[0] or "none",
                "position_volatility_score": clamp01(volatility / 30),
                "confidence": clamp01(0.55 if not driver_laps.empty else 0.35),
                "note": "Lap-position movement proxy; pass-by-pass attribution is unavailable.",
            }
        )
    return rows


def build_position_timeline(
    race_id: str,
    race_laps: pd.DataFrame,
    race_results: pd.DataFrame,
    track_status_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if race_laps.empty or race_results.empty or "position" not in race_laps.columns:
        return []
    status_by_lap = {to_int(row.get("lap_number"), 0): row for row in track_status_rows}
    grid_by_driver = {
        driver_display(row): to_int(row.get("grid_position"))
        for _, row in ranked_results(race_results).iterrows()
    }
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps.get("lap_number"), errors="coerce")
    laps["position"] = pd.to_numeric(laps.get("position"), errors="coerce")
    laps = laps.dropna(subset=["lap_number", "position"]).sort_values(["driver", "lap_number"])
    max_lap = to_int(laps["lap_number"].max(), 0) or 0
    rows: list[dict[str, Any]] = []
    for driver, group in laps.groupby("driver", sort=True):
        start_position = grid_by_driver.get(safe_text(driver))
        previous_position: float | None = None
        team = safe_text(group["team"].dropna().iloc[0]) if "team" in group and group["team"].notna().any() else ""
        for row in group.to_dict("records"):
            lap_number = to_int(row.get("lap_number"), 0) or 0
            position = to_int(row.get("position"))
            if position is None:
                continue
            status_row = status_by_lap.get(lap_number, {})
            status_label = safe_text(status_row.get("track_status_label")) or "unknown"
            previous_delta = (previous_position - position) if previous_position is not None else 0
            confidence = 0.82
            if status_label in {"safety-car", "virtual-safety-car", "red-flag", "mixed"}:
                confidence = 0.52
            elif status_label == "unknown":
                confidence = 0.42
            rows.append(
                {
                    "race_analysis_id": race_id,
                    "driver": safe_text(driver),
                    "team": team,
                    "lap_number": lap_number,
                    "position": position,
                    "position_delta_from_start": (start_position - position) if start_position is not None else "",
                    "position_delta_from_previous_lap": round(previous_delta, 1),
                    "phase": race_phase(lap_number, max_lap),
                    "track_status_label": status_label,
                    "confidence": clamp01(confidence),
                    "evidence_type": "derived",
                }
            )
            previous_position = float(position)
    return rows


def pit_window_laps(pit_rows: list[dict[str, Any]]) -> dict[str, set[int]]:
    windows: dict[str, set[int]] = {}
    for row in pit_rows:
        driver = safe_text(row.get("driver"))
        pit_lap = to_int(row.get("pit_lap"))
        if not driver or pit_lap is None:
            continue
        windows.setdefault(driver, set()).update(range(max(1, pit_lap - 1), pit_lap + 4))
    return windows


def build_position_swing_events(
    race_id: str,
    position_timeline: list[dict[str, Any]],
    pit_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    pit_windows = pit_window_laps(pit_rows)
    rows: list[dict[str, Any]] = []
    neutral_labels = {"safety-car", "virtual-safety-car", "red-flag", "mixed", "yellow"}
    for row in position_timeline:
        delta = to_num(row.get("position_delta_from_previous_lap"), 0) or 0
        if delta == 0:
            continue
        driver = safe_text(row.get("driver"))
        lap_number = to_int(row.get("lap_number"), 0) or 0
        status_label = safe_text(row.get("track_status_label"))
        if lap_number in pit_windows.get(driver, set()):
            event_type = "pit-cycle movement"
            confidence = 0.58
            note = "Pit-window position movement inferred from lap-position changes; no exact gaps."
        elif status_label in neutral_labels:
            event_type = "neutralization-affected movement"
            confidence = 0.42
            note = "Track-status phase overlaps position movement; cause unavailable."
        elif delta > 0:
            event_type = "track-position gain"
            confidence = 0.52
            note = "Lap-position gain; pass-by-pass attribution unavailable."
        else:
            event_type = "track-position loss"
            confidence = 0.52
            note = "Lap-position loss; pass-by-pass attribution unavailable."
        rows.append(
            {
                "race_analysis_id": race_id,
                "event_id": f"{race_id}-pos-{len(rows) + 1:04d}",
                "driver": driver,
                "team": safe_text(row.get("team")),
                "start_lap": lap_number,
                "end_lap": lap_number,
                "position_delta": round(delta, 1),
                "phase": safe_text(row.get("phase")),
                "event_type": event_type,
                "evidence_type": "inferred",
                "confidence": clamp01(confidence),
                "note": note,
            }
        )
    return rows


def build_traffic_proxy(
    race_id: str,
    pace_rows: list[dict[str, Any]],
    position_timeline: list[dict[str, Any]],
    pit_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not pace_rows or not position_timeline:
        return []
    timeline_by_key = {
        (safe_text(row.get("driver")), to_int(row.get("lap_number"), 0)): row for row in position_timeline
    }
    pit_windows = pit_window_laps(pit_rows)
    rows: list[dict[str, Any]] = []
    neutral_labels = {"safety-car", "virtual-safety-car", "red-flag", "mixed"}
    for pace in pace_rows:
        driver = safe_text(pace.get("driver"))
        lap_number = to_int(pace.get("lap_number"), 0) or 0
        timeline = timeline_by_key.get((driver, lap_number), {})
        position = to_int(timeline.get("position"))
        normalized_delta = to_num(pace.get("normalized_pace_delta_s"))
        status_label = safe_text(timeline.get("track_status_label"))
        in_pit_window = lap_number in pit_windows.get(driver, set())
        confidence = 0.38
        dirty_air_proxy = ""
        if normalized_delta is None or position is None or in_pit_window or status_label in neutral_labels:
            label = "uncertain"
            note = "Traffic proxy limited by missing exact gaps, pit-window overlap, or track-status phase."
        else:
            dirty_value = max(0.0, normalized_delta - 0.25)
            dirty_air_proxy = round(dirty_value, 3)
            if position <= 3 and normalized_delta <= 0.35:
                label = "clean-air likely"
                confidence = 0.5
                note = "Likely clean-air proxy from front-running position and neutral pace delta; no exact gap feed."
            elif position > 1 and normalized_delta >= 0.75:
                label = "traffic likely"
                confidence = 0.48
                note = "Traffic likely proxy from position and pace loss; no exact gap feed."
            else:
                label = "uncertain"
                confidence = 0.42
                note = "Traffic state uncertain without exact gap feed."
        rows.append(
            {
                "race_analysis_id": race_id,
                "driver": driver,
                "team": safe_text(pace.get("team")),
                "lap_number": lap_number,
                "phase": safe_text(pace.get("race_phase")),
                "position": position if position is not None else "",
                "lap_time_s": pace.get("lap_time_s"),
                "normalized_pace_delta_s": pace.get("normalized_pace_delta_s"),
                "traffic_proxy_label": label,
                "dirty_air_proxy_s": dirty_air_proxy,
                "drs_window_proxy": "gap-data-missing-proxy",
                "confidence": clamp01(confidence),
                "evidence_type": "proxy",
                "note": note,
            }
        )
    return rows


def build_weather_context(race_id: str, race_laps: pd.DataFrame) -> list[dict[str, Any]]:
    if race_laps.empty:
        return []
    weather_cols = ["air_temp_c", "track_temp_c", "humidity_pct", "rainfall", "wind_speed_mps"]
    available = [col for col in weather_cols if col in race_laps.columns]
    if not available:
        return []
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps["lap_number"], errors="coerce")
    max_lap = to_int(laps["lap_number"].max(), 0) or 0
    grouped = laps.groupby("lap_number", sort=True)[available].mean(numeric_only=True).reset_index()
    start_track_temp = to_num(grouped["track_temp_c"].dropna().iloc[0]) if "track_temp_c" in grouped and grouped["track_temp_c"].notna().any() else None
    rows: list[dict[str, Any]] = []
    for row in grouped.to_dict("records"):
        lap_number = to_int(row.get("lap_number"), 0) or 0
        track_temp = to_num(row.get("track_temp_c"))
        delta = (track_temp - start_track_temp) if track_temp is not None and start_track_temp is not None else None
        state = weather_state(row.get("rainfall"), row.get("humidity_pct"))
        if state != "dry":
            impact = "wet grip phase"
        elif delta is not None and delta >= 5:
            impact = "track heating"
        elif delta is not None and delta <= -5:
            impact = "track cooling"
        else:
            impact = "stable dry phase"
        non_null = sum(1 for col in available if to_num(row.get(col)) is not None)
        rows.append(
            {
                "race_analysis_id": race_id,
                "lap_number": lap_number,
                "race_phase": race_phase(lap_number, max_lap),
                "air_temp_c": round(to_num(row.get("air_temp_c"), 0) or 0, 2) if to_num(row.get("air_temp_c")) is not None else "",
                "track_temp_c": round(track_temp, 2) if track_temp is not None else "",
                "humidity_pct": round(to_num(row.get("humidity_pct"), 0) or 0, 2)
                if to_num(row.get("humidity_pct")) is not None
                else "",
                "rainfall": bool(to_num(row.get("rainfall"), 0) or 0),
                "wind_speed_mps": round(to_num(row.get("wind_speed_mps"), 0) or 0, 2)
                if to_num(row.get("wind_speed_mps")) is not None
                else "",
                "weather_state": state,
                "track_temp_delta_from_start_c": round(delta, 2) if delta is not None else "",
                "weather_impact_label": impact,
                "confidence": clamp01(non_null / len(available)),
            }
        )
    return rows


def build_track_status_context(race_id: str, race_laps: pd.DataFrame) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if race_laps.empty or "track_status" not in race_laps.columns:
        return [], []
    laps = race_laps.copy()
    laps["lap_number"] = pd.to_numeric(laps["lap_number"], errors="coerce")
    laps = laps.dropna(subset=["lap_number"]).sort_values("lap_number")
    max_lap = to_int(laps["lap_number"].max(), 0) or 0
    lap_rows: list[dict[str, Any]] = []
    for lap_number, group in laps.groupby("lap_number", sort=True):
        digit_set: set[str] = set()
        raw_values: list[str] = []
        for value in group["track_status"].dropna().tolist():
            normalized = normalize_track_status(value)
            if normalized:
                raw_values.append(normalized)
                digit_set.update(normalized)
        raw_status = "".join(sorted(digit_set)) if digit_set else ""
        label, confidence, note = track_status_metadata(raw_status)
        lap_rows.append(
            {
                "race_analysis_id": race_id,
                "lap_number": int(lap_number),
                "phase": race_phase(lap_number, max_lap),
                "track_status_raw": raw_status,
                "track_status_label": label,
                "confidence": confidence,
                "source": "canonical_fastf1_laps.track_status",
                "note": note,
            }
        )

    neutral_labels = {"yellow", "safety-car", "virtual-safety-car", "red-flag", "mixed"}
    phase_rows: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for row in lap_rows:
        active = row["track_status_label"] in neutral_labels
        if not active:
            if current is not None:
                phase_rows.append(current)
                current = None
            continue
        if current is None or current["status_label"] != row["track_status_label"] or row["lap_number"] != current["end_lap"] + 1:
            if current is not None:
                phase_rows.append(current)
            current = {
                "race_analysis_id": race_id,
                "phase_id": f"{race_id}-status-{len(phase_rows) + 1:02d}",
                "start_lap": row["lap_number"],
                "end_lap": row["lap_number"],
                "status_label": row["track_status_label"],
                "affected_laps": 1,
                "confidence": row["confidence"],
                "evidence_type": "track_status_only",
                "cause_available": False,
                "cause_note": "Cause unavailable: no race-control message source found locally.",
            }
        else:
            current["end_lap"] = row["lap_number"]
            current["affected_laps"] += 1
            current["confidence"] = round((current["confidence"] + row["confidence"]) / 2, 3)
    if current is not None:
        phase_rows.append(current)
    return lap_rows, phase_rows


def build_links(race_id: str, session_id: str, analytics_sessions: set[str], strategy_races: set[str]) -> list[dict[str, Any]]:
    analytics_enabled = session_id in analytics_sessions
    strategy_enabled = race_id in strategy_races
    return [
        {
            "race_analysis_id": race_id,
            "surface": "race_archive",
            "label": "Race archive",
            "href": f"/races/{race_id}",
            "relevance_note": "Classification and event facts.",
            "enabled": True,
            "unavailable_reason": "",
        },
        {
            "race_analysis_id": race_id,
            "surface": "analytics",
            "label": "Telemetry comparison",
            "href": f"/analytics?sessionId={session_id}",
            "relevance_note": "Driver-vs-driver segment analysis.",
            "enabled": analytics_enabled,
            "unavailable_reason": "" if analytics_enabled else "Telemetry product views unavailable for this race.",
        },
        {
            "race_analysis_id": race_id,
            "surface": "strategy_lab",
            "label": "Strategy Lab",
            "href": f"/lab?raceId={race_id}",
            "relevance_note": "Re-run strategy assumptions from this race context.",
            "enabled": strategy_enabled,
            "unavailable_reason": "" if strategy_enabled else "Strategy product view is not built for this race.",
        },
    ]


def build_story_points(
    race_id: str,
    race_results: pd.DataFrame,
    race_laps: pd.DataFrame,
    stint_rows: list[dict[str, Any]],
    position_rows: list[dict[str, Any]],
    neutralization_rows: list[dict[str, Any]],
    quality_score: float,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    ranked = ranked_results(race_results)
    max_lap = to_int(pd.to_numeric(race_laps.get("lap_number"), errors="coerce").max(), 1) if not race_laps.empty else 1
    story_id = 1
    if not ranked.empty:
        winner = ranked.iloc[0]
        rows.append(
            {
                "race_analysis_id": race_id,
                "story_point_id": f"{race_id}-story-{story_id:02d}",
                "lap_number": max_lap,
                "phase": "result",
                "title": f"{driver_display(winner)} controlled the result",
                "summary": f"{driver_display(winner)} won for {team_display(winner)}.",
                "evidence_type": "observed",
                "drivers_involved": driver_display(winner),
                "teams_involved": team_display(winner),
                "related_metric": "classified result",
                "impact_score": 0.9,
                "confidence": clamp01(quality_score),
                "data_limit_note": "",
            }
        )
        story_id += 1
    pos = pd.DataFrame(position_rows)
    if not pos.empty:
        pos["net_num"] = pd.to_numeric(pos["net_position_change"], errors="coerce")
        mover = pos.sort_values("net_num", ascending=False).head(1)
        if not mover.empty and to_num(mover.iloc[0].get("net_num"), 0) != 0:
            row = mover.iloc[0]
            rows.append(
                {
                    "race_analysis_id": race_id,
                    "story_point_id": f"{race_id}-story-{story_id:02d}",
                    "lap_number": max_lap,
                    "phase": "result",
                    "title": f"{row['driver']} gained the most ground",
                    "summary": f"{row['driver']} finished {abs(int(row['net_num']))} places better than the start.",
                    "evidence_type": "derived",
                    "drivers_involved": row["driver"],
                    "teams_involved": row["team"],
                    "related_metric": "start-to-finish position delta",
                    "impact_score": clamp01(0.45 + abs(row["net_num"]) / 20),
                    "confidence": clamp01(row.get("confidence", 0.5)),
                    "data_limit_note": "Position movement is lap-position derived, not pass-by-pass verified.",
                }
            )
            story_id += 1
    stints = pd.DataFrame(stint_rows)
    if not stints.empty:
        stints["deg_num"] = pd.to_numeric(stints["degradation_s_per_lap"], errors="coerce")
        valid = stints.dropna(subset=["deg_num"]).copy()
        if not valid.empty:
            stable = valid.sort_values("deg_num").head(1).iloc[0]
            rows.append(
                {
                    "race_analysis_id": race_id,
                    "story_point_id": f"{race_id}-story-{story_id:02d}",
                    "lap_number": to_int(stable.get("end_lap"), max_lap),
                    "phase": race_phase(stable.get("end_lap"), max_lap),
                    "title": f"{stable['driver']} showed stable tyre life",
                    "summary": f"{stable['compound']} stint degradation measured at {seconds_label(stable['deg_num'])}/lap.",
                    "evidence_type": "derived",
                    "drivers_involved": stable["driver"],
                    "teams_involved": stable["team"],
                    "related_metric": "stint degradation slope",
                    "impact_score": 0.58,
                    "confidence": clamp01(stable.get("degradation_confidence", 0.5)),
                    "data_limit_note": "Traffic and fuel effects are approximated.",
                }
            )
            story_id += 1
    if neutralization_rows:
        first_phase = sorted(neutralization_rows, key=lambda row: (row["start_lap"], row["end_lap"]))[0]
        first_lap = to_int(first_phase.get("start_lap"), 1)
        end_lap = to_int(first_phase.get("end_lap"), first_lap)
        status_label = safe_text(first_phase.get("status_label")).replace("-", " ")
        if first_lap is not None:
            rows.append(
                {
                    "race_analysis_id": race_id,
                    "story_point_id": f"{race_id}-story-{story_id:02d}",
                    "lap_number": first_lap,
                    "phase": race_phase(first_lap, max_lap),
                    "title": "Track-status phase shaped pace",
                    "summary": f"{status_label.title()} context covered laps {first_lap}-{end_lap}; cause unavailable.",
                    "evidence_type": "inferred",
                    "drivers_involved": "",
                    "teams_involved": "",
                    "related_metric": "FastF1 track_status code",
                    "impact_score": clamp01(0.35 + (first_phase.get("affected_laps", 1) / 10)),
                    "confidence": clamp01(first_phase.get("confidence", 0.5)),
                    "data_limit_note": "Track-status only; no message-level cause is available.",
                }
            )
            story_id += 1
    weather = build_weather_context(race_id, race_laps)
    if weather:
        weather_frame = pd.DataFrame(weather)
        wet_rows = weather_frame[weather_frame["weather_state"] != "dry"]
        if not wet_rows.empty:
            lap = to_int(wet_rows.iloc[0].get("lap_number"), 1)
            rows.append(
                {
                    "race_analysis_id": race_id,
                    "story_point_id": f"{race_id}-story-{story_id:02d}",
                    "lap_number": lap,
                    "phase": race_phase(lap, max_lap),
                    "title": "Weather shifted the grip picture",
                    "summary": "Rainfall was present in the timing weather feed.",
                    "evidence_type": "observed",
                    "drivers_involved": "",
                    "teams_involved": "",
                    "related_metric": "rainfall",
                    "impact_score": 0.6,
                    "confidence": clamp01(wet_rows["confidence"].mean()),
                    "data_limit_note": "",
                }
            )
    return rows[:5]


def dominant_strategy(stint_rows: list[dict[str, Any]]) -> str:
    frame = pd.DataFrame(stint_rows)
    if frame.empty:
        return "unknown"
    stops = frame.groupby("driver")["stint_number"].max().fillna(1).astype(int) - 1
    if stops.empty:
        return "unknown"
    mode = int(stops.mode().iloc[0])
    return f"{stop_label(mode)} majority"


def winning_compound_path(winner: str, stint_rows: list[dict[str, Any]]) -> str:
    frame = pd.DataFrame(stint_rows)
    if frame.empty or not winner:
        return ""
    winner_stints = frame[frame["driver"] == winner].sort_values("stint_number")
    compounds = [safe_text(compound) for compound in winner_stints["compound"].tolist() if safe_text(compound)]
    return " > ".join(compounds)


def build_summary(
    race_id: str,
    race_results: pd.DataFrame,
    race_laps: pd.DataFrame,
    stint_rows: list[dict[str, Any]],
    position_rows: list[dict[str, Any]],
    weather_rows: list[dict[str, Any]],
    quality_score: float,
) -> dict[str, Any]:
    ranked = ranked_results(race_results)
    winner = driver_display(ranked.iloc[0]) if not ranked.empty else ""
    winner_team = team_display(ranked.iloc[0]) if not ranked.empty else ""
    podium = ", ".join(driver_display(row) for _, row in ranked.head(3).iterrows())
    stints_frame = pd.DataFrame(stint_rows)
    fastest = ""
    if not race_laps.empty:
        median_pace = race_laps.dropna(subset=["lap_time_s"]).groupby("driver")["lap_time_s"].median().sort_values()
        if not median_pace.empty:
            fastest = f"{median_pace.index[0]} held the strongest median race pace."
    pos_frame = pd.DataFrame(position_rows)
    key_position = "Position movement is proxy-only."
    if not pos_frame.empty:
        pos_frame["net_num"] = pd.to_numeric(pos_frame["net_position_change"], errors="coerce")
        mover = pos_frame.sort_values("net_num", ascending=False).head(1)
        if not mover.empty and pd.notna(mover.iloc[0]["net_num"]):
            key_position = f"{mover.iloc[0]['driver']} had the largest start-finish gain proxy."
    wet = any(row.get("weather_state") != "dry" for row in weather_rows)
    if wet:
        weather_summary = "Wet or damp weather appeared in the timing feed."
    elif weather_rows:
        temps = pd.DataFrame(weather_rows)
        track_temps = pd.to_numeric(temps["track_temp_c"], errors="coerce").dropna()
        if track_temps.empty:
            weather_summary = "Dry timing feed; track temperature unavailable."
        else:
            weather_summary = f"Dry timing feed, track temp {track_temps.mean():.1f}C avg."
    else:
        weather_summary = "Weather unavailable."
    race_shape = "mixed-condition race" if wet else "pace-and-strategy race"
    if "track_status" in race_laps.columns:
        status = race_laps["track_status"].dropna().map(normalize_track_status)
        if len(status[(status != "") & (status != "1")]) > 0:
            race_shape = "track-status interrupted pace profile"
    strategy = dominant_strategy(stint_rows)
    if not stints_frame.empty:
        strategy_factor = f"{strategy} shaped stint length and tyre exposure."
    else:
        strategy_factor = "Strategy detail is limited by stint coverage."
    primary_story = f"{winner} won for {winner_team}." if winner else "Race result available."
    weakest = "Race-control messages and pass-by-pass attribution are unavailable; position movement is proxy-based."
    return {
        "race_analysis_id": race_id,
        "winner": winner,
        "winner_team": winner_team,
        "podium": podium,
        "dominant_strategy": strategy,
        "winning_compound_path": winning_compound_path(winner, stint_rows),
        "race_shape": race_shape,
        "primary_story": primary_story,
        "key_strategy_factor": strategy_factor,
        "key_pace_factor": fastest or "Pace factor limited by lap coverage.",
        "key_position_factor": key_position,
        "weather_summary": weather_summary,
        "confidence": clamp01(quality_score),
        "weakest_assumption": weakest,
    }


def main() -> None:
    generated_at = utc_now()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    laps = read_csv(CANONICAL_DIR / "laps_canonical.csv")
    results = read_csv(CANONICAL_DIR / "results_canonical.csv")
    races = read_csv(CURATED_DIR / "races.csv")
    curated_results = read_csv(CURATED_DIR / "race_results.csv")
    analytics_index = read_csv(ANALYTICS_DIR / "analytics_session_index.csv")
    strategy_index = read_csv(STRATEGY_DIR / "strategy_lab_index.csv")

    race_lookup = build_race_lookup(races)
    analytics_sessions = set(analytics_index.get("session_id", pd.Series(dtype=str)).dropna().astype(str))
    strategy_races = set(strategy_index.get("race_id", pd.Series(dtype=str)).dropna().astype(str))
    curated_result_races = set(curated_results.get("race_id", pd.Series(dtype=str)).dropna().astype(str))

    race_laps_all = laps[laps.get("session_code", "") == "R"].copy() if not laps.empty else pd.DataFrame()
    race_results_all = results[results.get("session_code", "") == "R"].copy() if not results.empty else pd.DataFrame()
    for frame in [race_laps_all, race_results_all]:
        if not frame.empty:
            frame["season"] = pd.to_numeric(frame["season"], errors="coerce").astype("Int64")
            frame["round"] = pd.to_numeric(frame["round"], errors="coerce").astype("Int64")

    index_rows: list[dict[str, Any]] = []
    summary_rows: list[dict[str, Any]] = []
    story_rows: list[dict[str, Any]] = []
    stint_rows_all: list[dict[str, Any]] = []
    pit_rows: list[dict[str, Any]] = []
    pace_rows: list[dict[str, Any]] = []
    position_rows_all: list[dict[str, Any]] = []
    weather_rows_all: list[dict[str, Any]] = []
    link_rows: list[dict[str, Any]] = []
    track_status_rows_all: list[dict[str, Any]] = []
    neutralization_rows_all: list[dict[str, Any]] = []
    position_timeline_rows_all: list[dict[str, Any]] = []
    position_swing_rows_all: list[dict[str, Any]] = []
    traffic_proxy_rows_all: list[dict[str, Any]] = []
    warnings: list[str] = []

    if race_results_all.empty:
        warnings.append("No canonical race results found.")

    race_groups = race_results_all.groupby(["season", "round", "event_name", "session_id"], dropna=True, sort=True)
    for (season_raw, round_raw, event, session_id), race_results in race_groups:
        season = int(season_raw)
        rnd = int(round_raw)
        race_meta = race_lookup.get((season, rnd), {})
        race_id = safe_text(race_meta.get("id")) or f"{season}-{rnd:02d}-{normalized_key(event)}"
        if curated_result_races and race_id not in curated_result_races:
            continue
        race_laps = race_laps_all[
            (race_laps_all["season"] == season)
            & (race_laps_all["round"] == rnd)
            & (race_laps_all["session_id"].astype(str) == str(session_id))
        ].copy()
        if race_laps.empty:
            warnings.append(f"{race_id}: skipped because canonical race laps are unavailable.")
            continue

        race_results = race_results.copy()
        race_results["position_num"] = pd.to_numeric(race_results.get("position"), errors="coerce")
        ranked = ranked_results(race_results)
        winner_row = ranked.iloc[0] if not ranked.empty else pd.Series(dtype=object)
        driver_count = int(race_results["abbreviation"].dropna().nunique())
        classified_count = int(race_results["position_num"].dropna().count())
        stints_for_race = build_driver_stints(race_id, race_laps)
        pit_laps = pit_laps_by_driver(stints_for_race)
        pits_for_race = build_pit_strategy(race_id, race_laps, stints_for_race)
        positions_for_race = build_position_changes(race_id, race_laps, race_results, pit_laps)
        weather_for_race = build_weather_context(race_id, race_laps)
        track_status_for_race, neutralization_for_race = build_track_status_context(race_id, race_laps)
        pace_for_race = build_pace_evolution(race_id, race_laps)
        position_timeline_for_race = build_position_timeline(race_id, race_laps, race_results, track_status_for_race)
        position_swing_for_race = build_position_swing_events(race_id, position_timeline_for_race, pits_for_race)
        traffic_proxy_for_race = build_traffic_proxy(race_id, pace_for_race, position_timeline_for_race, pits_for_race)
        quality_score = clamp01(
            (0.25 if driver_count > 0 else 0)
            + (0.25 * lap_quality(race_laps))
            + (0.15 if stints_for_race else 0)
            + (0.15 if weather_for_race else 0)
            + (0.20 if classified_count > 0 else 0)
        )
        weather_available = bool(weather_for_race)
        pit_stop_count = len(pits_for_race)
        index_rows.append(
            {
                "race_analysis_id": race_id,
                "season": season,
                "round": rnd,
                "event": safe_text(event),
                "race_name": safe_text(race_meta.get("race_name")) or safe_text(event),
                "session_id": safe_text(session_id),
                "circuit": safe_text(race_meta.get("circuit_id")),
                "race_date": safe_text(race_meta.get("scheduled_at")),
                "winner": driver_display(winner_row) if not winner_row.empty else "",
                "winner_team": team_display(winner_row) if not winner_row.empty else "",
                "driver_count": driver_count,
                "classified_driver_count": classified_count,
                "stint_count": len(stints_for_race),
                "pit_stop_count": pit_stop_count,
                "weather_available": weather_available,
                "race_control_available": False,
                "analysis_quality_score": quality_score,
                "generated_at": generated_at,
                "build_version": BUILD_VERSION,
                "freshness_status": "ready" if quality_score >= 0.55 else "limited",
            }
        )
        summary_rows.append(
            build_summary(
                race_id,
                race_results,
                race_laps,
                stints_for_race,
                positions_for_race,
                weather_for_race,
                quality_score,
            )
        )
        story_rows.extend(
            build_story_points(
                race_id,
                race_results,
                race_laps,
                stints_for_race,
                positions_for_race,
                neutralization_for_race,
                quality_score,
            )
        )
        stint_rows_all.extend(stints_for_race)
        pit_rows.extend(pits_for_race)
        pace_rows.extend(pace_for_race)
        position_rows_all.extend(positions_for_race)
        weather_rows_all.extend(weather_for_race)
        link_rows.extend(build_links(race_id, safe_text(session_id), analytics_sessions, strategy_races))
        track_status_rows_all.extend(track_status_for_race)
        neutralization_rows_all.extend(neutralization_for_race)
        position_timeline_rows_all.extend(position_timeline_for_race)
        position_swing_rows_all.extend(position_swing_for_race)
        traffic_proxy_rows_all.extend(traffic_proxy_for_race)

    index_rows = sorted(index_rows, key=lambda row: (row["season"], row["round"]))
    ordered_ids = {row["race_analysis_id"]: idx for idx, row in enumerate(index_rows)}
    sort_by_race = lambda row: ordered_ids.get(row["race_analysis_id"], 999999)
    for collection in [
        summary_rows,
        story_rows,
        stint_rows_all,
        pit_rows,
        pace_rows,
        position_rows_all,
        weather_rows_all,
        link_rows,
        track_status_rows_all,
        neutralization_rows_all,
        position_timeline_rows_all,
        position_swing_rows_all,
        traffic_proxy_rows_all,
    ]:
        collection.sort(key=sort_by_race)

    write_csv(
        OUTPUT_FILES["index"],
        index_rows,
        [
            "race_analysis_id",
            "season",
            "round",
            "event",
            "race_name",
            "session_id",
            "circuit",
            "race_date",
            "winner",
            "winner_team",
            "driver_count",
            "classified_driver_count",
            "stint_count",
            "pit_stop_count",
            "weather_available",
            "race_control_available",
            "analysis_quality_score",
            "generated_at",
            "build_version",
            "freshness_status",
        ],
    )
    write_csv(
        OUTPUT_FILES["summary"],
        summary_rows,
        [
            "race_analysis_id",
            "winner",
            "winner_team",
            "podium",
            "dominant_strategy",
            "winning_compound_path",
            "race_shape",
            "primary_story",
            "key_strategy_factor",
            "key_pace_factor",
            "key_position_factor",
            "weather_summary",
            "confidence",
            "weakest_assumption",
        ],
    )
    write_csv(
        OUTPUT_FILES["story_points"],
        story_rows,
        [
            "race_analysis_id",
            "story_point_id",
            "lap_number",
            "phase",
            "title",
            "summary",
            "evidence_type",
            "drivers_involved",
            "teams_involved",
            "related_metric",
            "impact_score",
            "confidence",
            "data_limit_note",
        ],
    )
    write_csv(
        OUTPUT_FILES["stints"],
        stint_rows_all,
        [
            "race_analysis_id",
            "driver",
            "team",
            "stint_number",
            "compound",
            "start_lap",
            "end_lap",
            "stint_length",
            "avg_lap_time_s",
            "median_lap_time_s",
            "best_lap_time_s",
            "degradation_s_per_lap",
            "degradation_confidence",
            "pace_rank_in_stint",
            "compound_phase",
            "traffic_adjusted_flag",
            "stint_quality_score",
            "note",
        ],
    )
    write_csv(
        OUTPUT_FILES["pit_strategy"],
        pit_rows,
        [
            "race_analysis_id",
            "driver",
            "team",
            "pit_stop_number",
            "pit_lap",
            "compound_from",
            "compound_to",
            "stint_length_before",
            "position_before_pit",
            "position_after_cycle",
            "net_position_change",
            "estimated_pit_loss_s",
            "undercut_overcut_label",
            "rejoin_risk",
            "traffic_penalty_proxy_s",
            "strategy_effect",
            "confidence",
            "weakest_assumption",
        ],
    )
    write_csv(
        OUTPUT_FILES["pace_evolution"],
        pace_rows,
        [
            "race_analysis_id",
            "driver",
            "team",
            "lap_number",
            "race_phase",
            "compound",
            "stint_number",
            "lap_time_s",
            "normalized_pace_delta_s",
            "field_rank_on_lap",
            "rolling_pace_delta_s",
            "tyre_age",
            "fuel_corrected_delta_s",
            "weather_adjusted_flag",
            "pace_confidence",
        ],
    )
    write_csv(
        OUTPUT_FILES["position_changes"],
        position_rows_all,
        [
            "race_analysis_id",
            "driver",
            "team",
            "start_position",
            "finish_position",
            "net_position_change",
            "positions_gained_on_track_proxy",
            "positions_gained_in_pit_cycles_proxy",
            "largest_gain_phase",
            "largest_loss_phase",
            "position_volatility_score",
            "confidence",
            "note",
        ],
    )
    write_csv(
        OUTPUT_FILES["weather_context"],
        weather_rows_all,
        [
            "race_analysis_id",
            "lap_number",
            "race_phase",
            "air_temp_c",
            "track_temp_c",
            "humidity_pct",
            "rainfall",
            "wind_speed_mps",
            "weather_state",
            "track_temp_delta_from_start_c",
            "weather_impact_label",
            "confidence",
        ],
    )
    write_csv(
        OUTPUT_FILES["links"],
        link_rows,
        ["race_analysis_id", "surface", "label", "href", "relevance_note", "enabled", "unavailable_reason"],
    )
    write_csv(
        OUTPUT_FILES["track_status"],
        track_status_rows_all,
        [
            "race_analysis_id",
            "lap_number",
            "phase",
            "track_status_raw",
            "track_status_label",
            "confidence",
            "source",
            "note",
        ],
    )
    write_csv(
        OUTPUT_FILES["neutralization_phases"],
        neutralization_rows_all,
        [
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
        ],
    )
    write_csv(
        OUTPUT_FILES["position_timeline"],
        position_timeline_rows_all,
        [
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
        ],
    )
    write_csv(
        OUTPUT_FILES["position_swing_events"],
        position_swing_rows_all,
        [
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
        ],
    )
    write_csv(
        OUTPUT_FILES["traffic_proxy"],
        traffic_proxy_rows_all,
        [
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
        ],
    )

    row_counts = {name: int(pd.read_csv(path).shape[0]) if path.exists() else 0 for name, path in OUTPUT_FILES.items()}
    index_frame = pd.DataFrame(index_rows)
    confidence_values = []
    for collection, field in [
        (summary_rows, "confidence"),
        (story_rows, "confidence"),
        (pit_rows, "confidence"),
        (position_rows_all, "confidence"),
        (weather_rows_all, "confidence"),
    ]:
        confidence_values.extend([to_num(row.get(field)) for row in collection if to_num(row.get(field)) is not None])
    report = {
        "generated_at": generated_at,
        "build_version": BUILD_VERSION,
        "rows": row_counts,
        "races_generated": int(len(index_rows)),
        "season_coverage": sorted(index_frame["season"].dropna().astype(int).unique().tolist()) if not index_frame.empty else [],
        "latest_race": index_rows[-1]["race_name"] if index_rows else "",
        "missing_data_flags": {
            "race_control": "missing",
            "exact_pass_attribution": "missing",
            "dynamic_gap_feed": "missing",
            "position_changes": "proxy",
            "track_status": "partial" if "track_status" in race_laps_all.columns else "missing",
            "neutralization_context": "track_status_only" if neutralization_rows_all else "missing",
            "traffic_proxy": "proxy_no_exact_gap_feed" if traffic_proxy_rows_all else "missing",
            "drs_window": "proxy_only_no_exact_gap_feed",
        },
        "confidence_distribution": {
            "min": round(float(np.nanmin(confidence_values)), 3) if confidence_values else None,
            "mean": round(float(np.nanmean(confidence_values)), 3) if confidence_values else None,
            "max": round(float(np.nanmax(confidence_values)), 3) if confidence_values else None,
            "tier": quality_tier(float(np.nanmean(confidence_values))) if confidence_values else "limited",
        },
        "validation_errors": [],
        "warnings": warnings,
    }
    REPORT_FILE.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps({"rows": row_counts, "races_generated": len(index_rows), "report": str(REPORT_FILE)}, indent=2))


if __name__ == "__main__":
    main()
