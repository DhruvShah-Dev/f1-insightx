from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

import pandas as pd


SEGMENT_COUNT = 20
MIN_TRACE_ROWS = 20


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")


def read_json(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def seconds(series: pd.Series) -> pd.Series:
    return pd.to_timedelta(series, errors="coerce").dt.total_seconds()


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    if pd.isna(value):
        return low
    return max(low, min(high, float(value)))


def quality_score(telemetry: pd.DataFrame, position: pd.DataFrame | None = None) -> float:
    if telemetry.empty:
        return 0.0
    required = ["Speed", "Throttle", "Brake", "Distance", "Time"]
    completeness = sum(column in telemetry.columns and telemetry[column].notna().any() for column in required) / len(required)
    row_score = min(1.0, len(telemetry) / 180.0)
    distance = pd.to_numeric(telemetry.get("Distance"), errors="coerce")
    distance_score = 1.0 if distance.notna().any() and float(distance.max() - distance.min()) > 1000 else 0.45
    position_score = 0.1 if position is not None and not position.empty else 0.0
    return round(clamp(completeness * 0.55 + row_score * 0.25 + distance_score * 0.1 + position_score), 4)


def base_metadata(frame: pd.DataFrame) -> dict[str, Any]:
    first = frame.iloc[0]
    return {
        "season": int(first.get("season") or first.get("Season") or 0),
        "round": int(first.get("round") or first.get("Round") or 0),
        "event": str(first.get("race_name") or first.get("event_name") or ""),
        "session": str(first.get("session_code") or ""),
        "driver": str(first.get("driver") or ""),
        "lap_number": int(first.get("lap_number")) if pd.notna(first.get("lap_number")) else None,
        "compound": str(first.get("compound") or ""),
        "stint": None,
    }


def enrich_trace(telemetry: pd.DataFrame) -> pd.DataFrame:
    trace = telemetry.copy()
    trace["_time_s"] = seconds(trace["Time"]) if "Time" in trace.columns else pd.Series(pd.NA, index=trace.index)
    for column in ("Distance", "Speed", "RPM", "nGear", "Throttle", "DRS"):
        if column in trace.columns:
            trace[column] = pd.to_numeric(trace[column], errors="coerce")
    if "Brake" in trace.columns:
        trace["Brake"] = trace["Brake"].astype("boolean").fillna(False)
    trace = trace.sort_values(["driver", "lap_number", "_time_s"], na_position="last")
    trace["_dt_s"] = trace.groupby(["driver", "lap_number"], dropna=False)["_time_s"].diff().clip(lower=0, upper=2).fillna(0.0)
    trace["_distance_delta_m"] = trace.groupby(["driver", "lap_number"], dropna=False)["Distance"].diff().clip(lower=0, upper=250).fillna(0.0)
    return trace


def telemetry_lap_summary(telemetry: pd.DataFrame, position: pd.DataFrame | None = None) -> pd.DataFrame:
    if telemetry.empty:
        return pd.DataFrame()
    trace = enrich_trace(telemetry)
    rows: list[dict[str, Any]] = []
    for _, lap in trace.groupby(["season", "round", "race_name", "session_code", "driver", "lap_number"], dropna=False):
        metadata = base_metadata(lap)
        lap_time = lap["_time_s"].max() - lap["_time_s"].min() if lap["_time_s"].notna().any() else None
        distance = pd.to_numeric(lap["Distance"], errors="coerce") if "Distance" in lap.columns else pd.Series(dtype=float)
        speed = pd.to_numeric(lap["Speed"], errors="coerce") if "Speed" in lap.columns else pd.Series(dtype=float)
        rpm = pd.to_numeric(lap["RPM"], errors="coerce") if "RPM" in lap.columns else pd.Series(dtype=float)
        throttle = pd.to_numeric(lap["Throttle"], errors="coerce") if "Throttle" in lap.columns else pd.Series(dtype=float)
        drs = pd.to_numeric(lap["DRS"], errors="coerce") if "DRS" in lap.columns else pd.Series(dtype=float)
        brake = lap["Brake"].astype(bool) if "Brake" in lap.columns else pd.Series(False, index=lap.index)
        rows.append(
            {
                **metadata,
                "lap_time_s": round(float(lap_time), 3) if lap_time and not pd.isna(lap_time) else None,
                "max_speed_kph": round(float(speed.max()), 3) if speed.notna().any() else None,
                "avg_speed_kph": round(float(speed.mean()), 3) if speed.notna().any() else None,
                "full_throttle_pct": round(float((throttle >= 99).mean() * 100), 3) if throttle.notna().any() else None,
                "braking_pct": round(float(brake.mean() * 100), 3),
                "avg_rpm": round(float(rpm.mean()), 3) if rpm.notna().any() else None,
                "max_rpm": round(float(rpm.max()), 3) if rpm.notna().any() else None,
                "drs_pct": round(float((drs > 0).mean() * 100), 3) if drs.notna().any() else None,
                "distance_covered_m": round(float(distance.max() - distance.min()), 3) if distance.notna().any() else None,
                "telemetry_quality_score": quality_score(lap, position),
            }
        )
    return pd.DataFrame(rows)


def assign_segments(trace: pd.DataFrame, segment_count: int = SEGMENT_COUNT) -> pd.DataFrame:
    if trace.empty or "Distance" not in trace.columns:
        return trace.assign(segment_id="unknown", segment_kind="unknown", segmentation_confidence=0.0)
    result = trace.copy()
    distance = pd.to_numeric(result["Distance"], errors="coerce")
    max_distance = float(distance.max()) if distance.notna().any() else 0.0
    if max_distance <= 0:
        return result.assign(segment_id="unknown", segment_kind="unknown", segmentation_confidence=0.0)
    bins = pd.cut(distance, bins=segment_count, labels=False, include_lowest=True).fillna(0).astype(int)
    result["_segment_index"] = bins
    segment_speed = result.groupby("_segment_index")["Speed"].median()
    low_speed_threshold = float(segment_speed.quantile(0.38)) if not segment_speed.empty else 150.0
    high_speed_threshold = float(segment_speed.quantile(0.68)) if not segment_speed.empty else 230.0
    circuit = slugify(str(result.iloc[0].get("race_name") or "circuit"))
    result["segment_kind"] = result["_segment_index"].map(lambda idx: "corner" if segment_speed.get(idx, 0) <= low_speed_threshold else "straight" if segment_speed.get(idx, 0) >= high_speed_threshold else "transition")
    result["segment_id"] = result.apply(lambda row: f"{circuit}_{row['segment_kind']}_{int(row['_segment_index']) + 1:02d}", axis=1)
    result["segmentation_confidence"] = 0.55
    return result


def segment_profiles(telemetry: pd.DataFrame) -> dict[str, pd.DataFrame]:
    if telemetry.empty:
        return {name: pd.DataFrame() for name in ["corner_speed", "corner_braking", "corner_throttle", "straight_speed", "energy"]}
    trace = assign_segments(enrich_trace(telemetry))
    speed_rows: list[dict[str, Any]] = []
    braking_rows: list[dict[str, Any]] = []
    throttle_rows: list[dict[str, Any]] = []
    straight_rows: list[dict[str, Any]] = []
    energy_rows: list[dict[str, Any]] = []

    group_cols = ["season", "round", "race_name", "session_code", "driver", "lap_number", "segment_id", "segment_kind"]
    for _, segment in trace.groupby(group_cols, dropna=False):
        metadata = base_metadata(segment)
        segment_id = str(segment.iloc[0]["segment_id"])
        kind = str(segment.iloc[0]["segment_kind"])
        speeds = pd.to_numeric(segment["Speed"], errors="coerce")
        distance = pd.to_numeric(segment["Distance"], errors="coerce")
        throttle = pd.to_numeric(segment["Throttle"], errors="coerce")
        brake = segment["Brake"].astype(bool) if "Brake" in segment.columns else pd.Series(False, index=segment.index)
        drs = pd.to_numeric(segment["DRS"], errors="coerce") if "DRS" in segment.columns else pd.Series(dtype=float)
        if len(segment) < 3 or speeds.notna().sum() < 3:
            continue
        common = {**metadata, "segment_id": segment_id, "corner_id": segment_id, "segmentation_confidence": float(segment["segmentation_confidence"].iloc[0])}
        if kind == "corner":
            speed_rows.append(
                {
                    **common,
                    "entry_speed_kph": round(float(speeds.iloc[: max(1, len(speeds) // 5)].mean()), 3),
                    "apex_speed_kph": round(float(speeds.min()), 3),
                    "exit_speed_kph": round(float(speeds.iloc[-max(1, len(speeds) // 5) :].mean()), 3),
                    "min_speed_kph": round(float(speeds.min()), 3),
                }
            )
            braking = segment[brake]
            braking_rows.append(
                {
                    **common,
                    "braking_start_distance_m": round(float(braking["Distance"].min()), 3) if not braking.empty else None,
                    "braking_duration_s": round(float(braking["_dt_s"].sum()), 3) if not braking.empty else 0.0,
                    "braking_distance_m": round(float(braking["_distance_delta_m"].sum()), 3) if not braking.empty else 0.0,
                    "min_speed_during_brake_kph": round(float(braking["Speed"].min()), 3) if not braking.empty else None,
                    "brake_intensity_proxy": round(float(brake.mean()), 4),
                    "late_brake_score": round(clamp((float(braking["Distance"].min()) - float(distance.min())) / max(float(distance.max() - distance.min()), 1.0)) if not braking.empty else 0.0, 4),
                }
            )
            pickup = segment[throttle >= 20]
            full = segment[throttle >= 99]
            throttle_rows.append(
                {
                    **common,
                    "throttle_pickup_distance_m": round(float(pickup["Distance"].min()), 3) if not pickup.empty else None,
                    "throttle_pickup_time_s": round(float(pickup["_time_s"].min()), 3) if not pickup.empty else None,
                    "full_throttle_exit_distance_m": round(float(full["Distance"].min()), 3) if not full.empty else None,
                    "traction_exit_score": round(clamp((float(throttle.iloc[-max(1, len(throttle) // 5) :].mean()) / 100.0) * (float(speeds.iloc[-1]) / max(float(speeds.max()), 1.0))), 4),
                }
            )
        elif kind == "straight":
            terminal = float(speeds.iloc[-max(1, len(speeds) // 5) :].mean())
            entry = float(speeds.iloc[: max(1, len(speeds) // 5)].mean())
            plateau = float(speeds.diff().abs().tail(max(3, len(speeds) // 4)).mean())
            clipping = clamp(1 - plateau / 2.5) if terminal > 250 and float(throttle.tail(max(3, len(throttle) // 4)).mean()) > 95 else 0.0
            lift_coast = float(((throttle < 20) & (~brake) & (speeds > speeds.quantile(0.7))).mean())
            straight_rows.append(
                {
                    **metadata,
                    "segment_id": segment_id,
                    "entry_speed_kph": round(entry, 3),
                    "terminal_speed_kph": round(terminal, 3),
                    "acceleration_score": round(clamp((terminal - entry) / 120.0), 4),
                    "drs_active_pct": round(float((drs > 0).mean() * 100), 3) if drs.notna().any() else None,
                    "clipping_proxy_score": round(clipping, 4),
                    "segmentation_confidence": float(segment["segmentation_confidence"].iloc[0]),
                }
            )
            energy_rows.append(
                {
                    **metadata,
                    "segment_id": segment_id,
                    "deployment_proxy_score": round(clamp((terminal - entry) / 90.0 + float((throttle > 95).mean()) * 0.3 - clipping * 0.2), 4),
                    "lift_and_coast_score": round(clamp(lift_coast * 2.0), 4),
                    "clipping_proxy_score": round(clipping, 4),
                    "recovery_zone_score": round(clamp(float(brake.mean()) * 1.8), 4),
                    "confidence": 0.48,
                    "label": "energy deployment proxy; not true ERS or battery state",
                }
            )

    corner_speed = pd.DataFrame(speed_rows)
    if not corner_speed.empty:
        corner_speed["speed_delta_vs_session_best"] = corner_speed.groupby(["season", "round", "session", "corner_id"])["apex_speed_kph"].transform(lambda s: (s.max() - s).round(3))
        corner_speed["speed_delta_vs_teammate"] = corner_speed.groupby(["season", "round", "session", "corner_id"])["apex_speed_kph"].transform(lambda s: (s.mean() - s).round(3))
    return {
        "corner_speed": corner_speed,
        "corner_braking": pd.DataFrame(braking_rows),
        "corner_throttle": pd.DataFrame(throttle_rows),
        "straight_speed": pd.DataFrame(straight_rows),
        "energy": pd.DataFrame(energy_rows),
    }


def driver_corner_delta(corner_speed: pd.DataFrame) -> pd.DataFrame:
    if corner_speed.empty:
        return pd.DataFrame()
    rows: list[dict[str, Any]] = []
    for keys, group in corner_speed.groupby(["season", "round", "event", "session", "corner_id"], dropna=False):
        ordered = group.sort_values("apex_speed_kph", ascending=False)
        best = ordered.iloc[0]
        for _, row in ordered.iterrows():
            rows.append(
                {
                    "season": keys[0],
                    "round": keys[1],
                    "event": keys[2],
                    "session": keys[3],
                    "corner_id": keys[4],
                    "driver": row["driver"],
                    "reference_driver": best["driver"],
                    "apex_speed_delta_kph": round(float(best["apex_speed_kph"] - row["apex_speed_kph"]), 3),
                    "entry_speed_delta_kph": round(float(best["entry_speed_kph"] - row["entry_speed_kph"]), 3),
                    "exit_speed_delta_kph": round(float(best["exit_speed_kph"] - row["exit_speed_kph"]), 3),
                    "comparison_scope": "session_best",
                }
            )
    return pd.DataFrame(rows)
