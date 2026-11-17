"""Resume missing 2026 OpenF1 car data and track-location downloads.

Large sessions require filtered requests. Prefer nonoverlapping time windows,
keeping provider bytes unaltered, then assemble the existing staged CSV format.
"""

from __future__ import annotations

import csv
import json
import time
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from f1_insightx_data.openf1 import OpenF1Client
from f1_insightx_data.settings import load_settings


ROOT = Path(__file__).resolve().parent
REPORT = ROOT / "reports" / "openf1_telemetry_2026_download.json"
SESSION_CODES = {
    "Practice 1": "FP1", "Practice 2": "FP2", "Practice 3": "FP3",
    "Qualifying": "Q", "Sprint Qualifying": "SQ", "Sprint": "S", "Race": "R",
}
ENDPOINTS = ("car_data", "location")


def iso(value: datetime) -> str:
    return value.astimezone(UTC).replace(tzinfo=None).isoformat(timespec="microseconds")


def event_range(position_path: Path) -> tuple[datetime, datetime]:
    dates = [datetime.fromisoformat(str(row["date"]).replace("Z", "+00:00"))
             for row in load_rows(position_path) if row.get("date")]
    if not dates:
        raise ValueError(f"No timestamped position events in {position_path}")
    return min(dates) - timedelta(minutes=30), max(dates) + timedelta(minutes=30)


def fetch_window(client: OpenF1Client, endpoint: str, session_key: int,
                 start: datetime, end: datetime, folder: Path) -> list[Path]:
    """Bisect provider-size failures while preserving disjoint [start, end) windows."""
    name = f"window_{start.strftime('%Y%m%dT%H%M%S%f')}_{end.strftime('%Y%m%dT%H%M%S%f')}.json"
    target = folder / name
    if target.exists():
        load_rows(target)
        return [target]
    url = f"/{endpoint}?session_key={session_key}&date>={iso(start)}&date<{iso(end)}"
    try:
        rows, raw_bytes = client._get_snapshot(url)
    except Exception as error:
        if "404" in str(error):
            return []
        if "422" in str(error) and (end - start) > timedelta(minutes=1):
            midpoint = start + (end - start) / 2
            return (fetch_window(client, endpoint, session_key, start, midpoint, folder)
                    + fetch_window(client, endpoint, session_key, midpoint, end, folder))
        raise
    folder.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".json.tmp")
    temporary.write_bytes(raw_bytes)
    temporary.replace(target)
    print(f"{session_key} {endpoint} {start:%H:%M}-{end:%H:%M}: {len(rows)} rows", flush=True)
    return [target]


def fetch_tail(client: OpenF1Client, endpoint: str, session_key: int,
               boundary: datetime, side: str, folder: Path) -> list[Path]:
    """Capture provider events outside the position feed's active time span."""
    target = folder / f"tail_{side}_{boundary.strftime('%Y%m%dT%H%M%S%f')}.json"
    if target.exists():
        load_rows(target)
        return [target]
    filter_text = f"date<{iso(boundary)}" if side == "before" else f"date>={iso(boundary)}"
    try:
        rows, raw_bytes = client._get_snapshot(f"/{endpoint}?session_key={session_key}&{filter_text}")
    except Exception as error:
        if "404" in str(error):
            return []
        raise
    folder.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".json.tmp")
    temporary.write_bytes(raw_bytes)
    temporary.replace(target)
    print(f"{session_key} {endpoint} {side} tail: {len(rows)} rows", flush=True)
    return [target]


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    for attempt in range(20):
        try:
            temporary.replace(path)
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.2)


def load_rows(path: Path) -> list[dict[str, Any]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise TypeError(f"Expected a JSON array in {path}")
    return value


def stage_csv(paths: list[Path], target: Path) -> int:
    """Build a CSV from validated raw partitions without loading a session at once."""
    columns: list[str] = []
    count = 0
    for path in paths:
        rows = load_rows(path)
        count += len(rows)
        for row in rows:
            for column in row:
                if column not in columns:
                    columns.append(column)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".csv.tmp")
    with temporary.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for path in paths:
            for row in load_rows(path):
                writer.writerow(row)
    temporary.replace(target)
    return count


def main() -> None:
    settings = load_settings()
    now = datetime.now(UTC)
    sessions = load_rows(settings.raw_openf1_dir / "2026" / "sessions.json")
    report: dict[str, Any] = {
        "started_at": now.isoformat(), "season": 2026,
        "scope": "car_data and location for provider-available completed sessions",
        "sessions": {},
    }
    if REPORT.exists():
        old = json.loads(REPORT.read_text(encoding="utf-8"))
        report["started_at"] = old.get("started_at", report["started_at"])
        report["sessions"] = old.get("sessions", {})

    client = OpenF1Client(settings.openf1_base_url)
    try:
        for session in sorted(sessions, key=lambda row: (row["date_start"], row["session_key"])):
            name = str(session.get("session_name"))
            if name not in SESSION_CODES:
                continue
            try:
                finished = datetime.fromisoformat(str(session["date_end"]).replace("Z", "+00:00")) <= now
            except (KeyError, ValueError):
                continue
            if not finished:
                continue
            key = int(session["session_key"])
            code = SESSION_CODES[name]
            folder = Path("2026") / str(session["meeting_key"]) / f"{key}_{code}"
            raw_dir = settings.raw_openf1_dir / folder
            staged_dir = settings.staged_openf1_dir / folder
            session_report = report["sessions"].setdefault(str(key), {
                "meeting_key": session["meeting_key"], "code": code, "endpoints": {},
            })
            # An absent position feed is the provider's signal that no session ran.
            if not (raw_dir / "position.json").exists():
                session_report["status"] = "provider_unavailable"
                atomic_json(REPORT, report)
                print(f"{key}_{code}: provider unavailable", flush=True)
                continue
            drivers_path = raw_dir / "drivers.json"
            if not drivers_path.exists():
                session_report["status"] = "drivers_missing"
                atomic_json(REPORT, report)
                print(f"{key}_{code}: drivers missing", flush=True)
                continue
            driver_numbers = sorted({int(row["driver_number"]) for row in load_rows(drivers_path)
                                     if row.get("driver_number") is not None})
            for endpoint in ENDPOINTS:
                aggregate = raw_dir / f"{endpoint}.json"
                staged = staged_dir / f"{endpoint}.csv"
                endpoint_report = session_report["endpoints"].setdefault(endpoint, {})
                if staged.exists() and endpoint_report.get("status") in {
                    "complete", "complete_time_windows", "existing_aggregate"
                }:
                    continue
                if aggregate.exists():
                    if not staged.exists():
                        endpoint_report["rows"] = stage_csv([aggregate], staged)
                    endpoint_report["status"] = "existing_aggregate"
                    atomic_json(REPORT, report)
                    continue
                partition = raw_dir / endpoint
                if not staged.exists():
                    try:
                        start, end = event_range(raw_dir / "position.json")
                        windows = fetch_tail(client, endpoint, key, start, "before", partition)
                        cursor = start
                        while cursor < end:
                            stop = min(cursor + timedelta(minutes=30), end)
                            windows.extend(fetch_window(client, endpoint, key, cursor, stop, partition))
                            cursor = stop
                            endpoint_report["windows_downloaded"] = len(windows)
                            endpoint_report["status"] = "in_progress"
                            atomic_json(REPORT, report)
                        windows.extend(fetch_tail(client, endpoint, key, end, "after", partition))
                        observed = Counter(
                            int(row["driver_number"])
                            for path in windows for row in load_rows(path)
                            if row.get("driver_number") is not None
                        )
                        reference_number = next((number for number in driver_numbers if number in observed), None)
                        if reference_number is None:
                            raise ValueError("No entrant telemetry appeared in the time windows")
                        reference, _ = client.fetch_endpoint_snapshot(
                            endpoint, key, driver_number=reference_number
                        )
                        if observed[reference_number] != len(reference):
                            raise ValueError(
                                f"Time coverage mismatch for driver {reference_number}: "
                                f"{observed[reference_number]} != {len(reference)}"
                            )
                        endpoint_report["rows"] = stage_csv(windows, staged)
                        endpoint_report["status"] = "complete_time_windows"
                        endpoint_report["reference_driver"] = reference_number
                        endpoint_report["reference_rows"] = len(reference)
                        endpoint_report.pop("error", None)
                        atomic_json(REPORT, report)
                        print(f"{key}_{code} {endpoint}: complete ({endpoint_report['rows']} rows)", flush=True)
                        continue
                    except Exception as error:
                        endpoint_report["error"] = str(error).splitlines()[0]
                        print(f"{key}_{code} {endpoint}: time windows failed; using driver requests: {error}", flush=True)
                        atomic_json(REPORT, report)
                missing: list[int] = []
                errors: dict[str, str] = {}
                for driver_number in driver_numbers:
                    target = partition / f"driver_{driver_number}.json"
                    if target.exists():
                        try:
                            load_rows(target)
                            continue
                        except (OSError, ValueError, TypeError):
                            target.unlink()
                    try:
                        rows, raw_bytes = client.fetch_endpoint_snapshot(
                            endpoint, key, driver_number=driver_number
                        )
                        partition.mkdir(parents=True, exist_ok=True)
                        temporary = target.with_suffix(".json.tmp")
                        temporary.write_bytes(raw_bytes)
                        temporary.replace(target)
                        print(f"{key}_{code} {endpoint} driver {driver_number}: {len(rows)} rows", flush=True)
                    except Exception as error:  # Continue, preserving successful partitions.
                        missing.append(driver_number)
                        errors[str(driver_number)] = str(error).splitlines()[0]
                        print(f"{key}_{code} {endpoint} driver {driver_number}: {errors[str(driver_number)]}", flush=True)
                    endpoint_report["downloaded_drivers"] = len(list(partition.glob("driver_*.json"))) if partition.exists() else 0
                    endpoint_report["expected_drivers"] = len(driver_numbers)
                    endpoint_report["errors"] = errors
                    atomic_json(REPORT, report)
                paths = [partition / f"driver_{number}.json" for number in driver_numbers
                         if (partition / f"driver_{number}.json").exists()]
                if paths and not missing and len(paths) == len(driver_numbers):
                    endpoint_report["rows"] = stage_csv(paths, staged)
                    endpoint_report["status"] = "complete"
                else:
                    endpoint_report["status"] = "partial"
                atomic_json(REPORT, report)
                print(f"{key}_{code} {endpoint}: {endpoint_report['status']}", flush=True)
    finally:
        client.close()
        counts = Counter(
            endpoint.get("status", "pending")
            for session in report["sessions"].values()
            for endpoint in session.get("endpoints", {}).values()
        )
        report["updated_at"] = datetime.now(UTC).isoformat()
        report["counts"] = dict(counts)
        atomic_json(REPORT, report)
        print(f"Summary: {dict(counts)}", flush=True)


if __name__ == "__main__":
    main()
