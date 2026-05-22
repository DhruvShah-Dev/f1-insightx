from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_FASTF1_DIR = DATA_DIR / "raw" / "fastf1"
ANALYTICS_DIR = DATA_DIR / "analytics"
TRACE_DIR = ANALYTICS_DIR / "indexed" / "traces"
REPORT_PATH = DATA_DIR / "reports" / "analytics_telemetry_trace_report.json"
SESSION_INDEX_PATH = ANALYTICS_DIR / "analytics_session_index.csv"
MANIFEST_PATH = TRACE_DIR / "analytics_trace_manifest.json"

POINT_COUNT = 96
BUILD_VERSION_PREFIX = "analytics_telemetry_traces"
CHANNELS = ["Speed", "RPM", "nGear", "Throttle", "Brake", "DRS"]


def now_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def session_dir(row: pd.Series) -> Path:
    return RAW_FASTF1_DIR / str(int(row["season"])) / f"{int(row['round']):02d}_{slugify(str(row['event']))}" / str(row["session"])


def safe_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return round(number, 3)


def normalized_energy_proxy(speed: np.ndarray, throttle: np.ndarray, drs: np.ndarray) -> np.ndarray:
    valid_speed = np.nan_to_num(speed, nan=0.0)
    if valid_speed.max() <= valid_speed.min():
        speed_norm = np.zeros_like(valid_speed)
    else:
        speed_norm = (valid_speed - valid_speed.min()) / max(1e-9, valid_speed.max() - valid_speed.min())
    throttle_norm = np.nan_to_num(throttle, nan=0.0) / 100.0
    drs_norm = np.where(np.nan_to_num(drs, nan=0.0) > 0, 1.0, 0.0)
    return np.clip((speed_norm * 0.58) + (throttle_norm * 0.32) + (drs_norm * 0.1), 0.0, 1.0)


def boolish_series(series: pd.Series) -> pd.Series:
    if series.dtype == bool:
        return series.astype(float) * 100.0
    return pd.to_numeric(series, errors="coerce").fillna(0).clip(lower=0, upper=100)


def span_ranges(x: np.ndarray, active: np.ndarray) -> list[dict[str, float]]:
    spans: list[dict[str, float]] = []
    start: float | None = None
    last = 0.0
    for idx, is_active in enumerate(active):
        current = float(x[idx])
        if is_active and start is None:
            start = current
        if not is_active and start is not None:
            if last - start >= 0.008:
                spans.append({"start": round(start, 4), "end": round(last, 4)})
            start = None
        last = current
    if start is not None and last - start >= 0.008:
        spans.append({"start": round(start, 4), "end": round(last, 4)})
    return spans[:18]


def resample_lap(lap: pd.DataFrame) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    lap = lap.sort_values("Distance").drop_duplicates(subset=["Distance"])
    distance = pd.to_numeric(lap["Distance"], errors="coerce").to_numpy(dtype=float)
    mask = np.isfinite(distance)
    if mask.sum() < 24:
        return [], {"quality": 0.0, "reason": "too_few_distance_points"}

    lap = lap.loc[mask].copy()
    distance = distance[mask]
    distance_min = float(np.nanmin(distance))
    distance_span = float(np.nanmax(distance) - distance_min)
    if distance_span <= 100:
        return [], {"quality": 0.0, "reason": "distance_span_too_short"}

    x_source = (distance - distance_min) / distance_span
    x_target = np.linspace(0, 1, POINT_COUNT)
    arrays: dict[str, np.ndarray] = {}
    for channel in CHANNELS:
        if channel == "Brake":
            values = boolish_series(lap[channel]).to_numpy(dtype=float)
        else:
            values = pd.to_numeric(lap[channel], errors="coerce").interpolate(limit_direction="both").to_numpy(dtype=float)
        arrays[channel] = np.interp(x_target, x_source, np.nan_to_num(values, nan=float(np.nanmean(values) if np.isfinite(values).any() else 0.0)))

    energy = normalized_energy_proxy(arrays["Speed"], arrays["Throttle"], arrays["DRS"])
    points: list[dict[str, Any]] = []
    for idx, x in enumerate(x_target):
        points.append({
            "x": round(float(x), 4),
            "speed": safe_float(arrays["Speed"][idx]),
            "rpm": safe_float(arrays["RPM"][idx]),
            "gear": safe_float(arrays["nGear"][idx]),
            "throttle": safe_float(arrays["Throttle"][idx]),
            "brake": safe_float(arrays["Brake"][idx]),
            "drs": safe_float(1.0 if arrays["DRS"][idx] > 0 else 0.0),
            "energyProxy": safe_float(energy[idx]),
        })

    quality = min(1.0, max(0.0, len(lap) / 260.0) * min(1.0, distance_span / 4500.0))
    metadata = {
        "quality": round(quality, 3),
        "distance_m": round(distance_span, 1),
        "point_count_raw": int(len(lap)),
        "braking_spans": span_ranges(x_target, arrays["Brake"] > 4),
        "drs_spans": span_ranges(x_target, arrays["DRS"] > 0),
    }
    return points, metadata


def representative_lap_kind(session_code: str) -> str:
    if session_code in {"Q", "SQ"}:
        return "fastest qualifying representative lap"
    if session_code in {"R", "S"}:
        return "representative clean race lap"
    return "representative practice lap"


def build_session_payload(row: pd.Series, generated_at: str, build_version: str) -> tuple[dict[str, Any] | None, list[str]]:
    warnings: list[str] = []
    telemetry_path = session_dir(row) / "telemetry.parquet"
    if not telemetry_path.exists():
        return None, [f"{row['session_id']}: telemetry.parquet missing"]

    try:
        telemetry = pd.read_parquet(telemetry_path)
    except Exception as exc:  # pragma: no cover - defensive report path
        return None, [f"{row['session_id']}: failed to read telemetry parquet ({exc})"]

    required = {"driver", "lap_number", "compound", "Distance", "Speed", "RPM", "nGear", "Throttle", "Brake", "DRS"}
    missing = sorted(required - set(telemetry.columns))
    if missing:
        return None, [f"{row['session_id']}: missing telemetry columns {missing}"]

    drivers: dict[str, Any] = {}
    for driver, driver_frame in telemetry.groupby("driver", sort=True):
        lap_candidates = []
        for lap_number, lap in driver_frame.groupby("lap_number", sort=True):
            points, metadata = resample_lap(lap)
            if not points:
                continue
            avg_speed = pd.to_numeric(lap["Speed"], errors="coerce").mean()
            lap_candidates.append((lap_number, avg_speed, points, metadata, lap))
        if not lap_candidates:
            warnings.append(f"{row['session_id']} {driver}: no usable representative lap")
            continue

        session_code = str(row["session"])
        if session_code in {"Q", "SQ"}:
            chosen = max(lap_candidates, key=lambda item: (item[3]["quality"], item[1]))
        elif session_code in {"R", "S"}:
            speeds = sorted(item[1] for item in lap_candidates if math.isfinite(item[1]))
            median_speed = speeds[len(speeds) // 2] if speeds else 0
            chosen = min(lap_candidates, key=lambda item: (abs(item[1] - median_speed), -item[3]["quality"]))
        else:
            chosen = max(lap_candidates, key=lambda item: (item[3]["quality"], item[1]))

        lap_number, _avg_speed, points, metadata, lap = chosen
        compound = str(lap["compound"].dropna().iloc[0]) if "compound" in lap and not lap["compound"].dropna().empty else ""
        drivers[str(driver).upper()] = {
            "driver": str(driver).upper(),
            "lapNumber": int(lap_number),
            "compound": compound,
            "lapKind": representative_lap_kind(str(row["session"])),
            "quality": metadata["quality"],
            "distanceM": metadata["distance_m"],
            "rawPointCount": metadata["point_count_raw"],
            "spans": {
                "braking": metadata["braking_spans"],
                "drs": metadata["drs_spans"],
            },
            "points": points,
        }

    if not drivers:
        return None, warnings + [f"{row['session_id']}: no driver traces generated"]

    qualities = [driver["quality"] for driver in drivers.values()]
    return {
        "version": 1,
        "buildVersion": build_version,
        "generatedAt": generated_at,
        "source": "offline_fastf1_telemetry_parquet",
        "session": {
            "sessionId": row["session_id"],
            "season": int(row["season"]),
            "round": int(row["round"]),
            "event": row["event"],
            "session": row["session"],
        },
        "tracePointCount": POINT_COUNT,
        "quality": round(float(np.mean(qualities)), 3),
        "qualityTier": "representative telemetry trace",
        "honestyNote": "Precomputed representative telemetry trace. Approximate segment context only.",
        "drivers": drivers,
    }, warnings


def write_json_gz(path: Path, payload: dict[str, Any]) -> int:
    encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    with gzip.open(path, "wb", compresslevel=9) as handle:
        handle.write(encoded)
    return path.stat().st_size


def main() -> int:
    generated_at = now_utc()
    build_version = f"{BUILD_VERSION_PREFIX}_{generated_at.replace('-', '').replace(':', '')}"
    TRACE_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    sessions = pd.read_csv(SESSION_INDEX_PATH)
    manifest_sessions: dict[str, Any] = {}
    warnings: list[str] = []
    row_counts: dict[str, int] = {}
    bytes_written = 0

    for _, row in sessions.iterrows():
        payload, row_warnings = build_session_payload(row, generated_at, build_version)
        warnings.extend(row_warnings)
        if payload is None:
            continue
        session_id = str(row["session_id"])
        digest = hashlib.sha1(session_id.encode("utf-8")).hexdigest()[:12]
        filename = f"{slugify(session_id)}-{digest}.json.gz"
        size = write_json_gz(TRACE_DIR / filename, payload)
        bytes_written += size
        manifest_sessions[session_id] = {
            "file": filename,
            "season": int(row["season"]),
            "round": int(row["round"]),
            "event": row["event"],
            "session": row["session"],
            "drivers": len(payload["drivers"]),
            "tracePointCount": POINT_COUNT,
            "quality": payload["quality"],
            "bytes": size,
        }
        row_counts[session_id] = len(payload["drivers"])

    manifest = {
        "version": 1,
        "buildVersion": build_version,
        "generatedAt": generated_at,
        "tracePointCount": POINT_COUNT,
        "source": "offline_fastf1_telemetry_parquet",
        "sessions": manifest_sessions,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")

    report = {
        "generated_at": generated_at,
        "build_version": build_version,
        "sessions_available": len(manifest_sessions),
        "sessions_expected": int(len(sessions)),
        "drivers_with_traces": int(sum(row_counts.values())),
        "trace_point_count": POINT_COUNT,
        "total_trace_bytes": bytes_written,
        "average_session_bytes": round(bytes_written / max(1, len(manifest_sessions)), 1),
        "warnings": warnings[:200],
        "warning_count": len(warnings),
        "validation_errors": [],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
