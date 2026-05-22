from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
TRACE_DIR = ROOT / "data" / "analytics" / "indexed" / "traces"
MANIFEST_PATH = TRACE_DIR / "analytics_trace_manifest.json"
REPORT_PATH = ROOT / "data" / "reports" / "analytics_telemetry_trace_validation_report.json"

FORBIDDEN_WORDS = ("battery", "ers")
REQUIRED_POINT_KEYS = {"x", "speed", "rpm", "gear", "throttle", "brake", "drs", "energyProxy"}


def read_json_gz(path: Path) -> dict[str, Any]:
    with gzip.open(path, "rb") as handle:
        return json.loads(handle.read().decode("utf-8"))


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def validate_payload(session_id: str, payload: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    if payload.get("session", {}).get("sessionId") != session_id:
        fail(errors, f"{session_id}: payload session id mismatch")
    point_count = int(payload.get("tracePointCount", 0))
    if point_count <= 12 or point_count > 120:
        fail(errors, f"{session_id}: trace point count out of bounds ({point_count})")
    note = str(payload.get("honestyNote", "")).lower()
    for word in FORBIDDEN_WORDS:
        if word in note:
            fail(errors, f"{session_id}: forbidden wording in trace note ({word})")
    if "representative" not in note or "approximate" not in note:
        warnings.append(f"{session_id}: honesty note should mention representative and approximate context")

    drivers = payload.get("drivers")
    if not isinstance(drivers, dict) or not drivers:
        fail(errors, f"{session_id}: no driver traces")
        return

    for driver, trace in drivers.items():
        quality = trace.get("quality")
        if not isinstance(quality, (int, float)) or quality < 0 or quality > 1:
            fail(errors, f"{session_id} {driver}: quality outside 0-1")
        points = trace.get("points")
        if not isinstance(points, list) or len(points) != point_count:
            fail(errors, f"{session_id} {driver}: invalid point count")
            continue
        previous_x = -1.0
        for idx, point in enumerate(points):
            if set(point.keys()) != REQUIRED_POINT_KEYS:
                fail(errors, f"{session_id} {driver}: point {idx} has invalid keys")
                break
            x = point["x"]
            if not isinstance(x, (int, float)) or x < 0 or x > 1 or x < previous_x:
                fail(errors, f"{session_id} {driver}: x coordinate invalid at point {idx}")
                break
            previous_x = float(x)
        for span_type, spans in trace.get("spans", {}).items():
            if span_type not in {"braking", "drs"}:
                fail(errors, f"{session_id} {driver}: unknown span type {span_type}")
            for span in spans:
                start = span.get("start")
                end = span.get("end")
                if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or start < 0 or end > 1 or end < start:
                    fail(errors, f"{session_id} {driver}: invalid {span_type} span")


def main() -> int:
    errors: list[str] = []
    warnings: list[str] = []
    if not MANIFEST_PATH.exists():
        fail(errors, "analytics telemetry trace manifest is missing")
    else:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        sessions = manifest.get("sessions")
        if not isinstance(sessions, dict) or not sessions:
            fail(errors, "trace manifest has no sessions")
        else:
            for session_id, entry in sessions.items():
                filename = entry.get("file")
                if not isinstance(filename, str) or ".." in filename or filename.startswith(("/", "\\")):
                    fail(errors, f"{session_id}: invalid trace file path")
                    continue
                path = TRACE_DIR / filename
                if not path.exists():
                    fail(errors, f"{session_id}: trace file missing")
                    continue
                if path.stat().st_size > 350_000:
                    warnings.append(f"{session_id}: trace shard is large ({path.stat().st_size} bytes)")
                validate_payload(session_id, read_json_gz(path), errors, warnings)

    report = {
        "manifest": str(MANIFEST_PATH),
        "sessions": 0 if not MANIFEST_PATH.exists() else len(json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get("sessions", {})),
        "warnings": warnings[:200],
        "warning_count": len(warnings),
        "errors": errors,
        "status": "failed" if errors else "passed",
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
