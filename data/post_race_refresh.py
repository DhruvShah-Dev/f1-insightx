"""Idempotent, gated post-race product refresh for GitHub Actions."""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

try:
    from . import automation_storage as archive
except ImportError:
    import automation_storage as archive

ROOT = Path(__file__).resolve().parents[1]
RACES = ROOT / "data/curated/races.csv"


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def race_target(now: datetime, rows: list[dict[str, str]]) -> dict[str, str] | None:
    candidates = []
    for row in rows:
        try:
            scheduled = datetime.fromisoformat(row["scheduled_at"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        if scheduled + timedelta(hours=3) <= now <= scheduled + timedelta(days=7):
            candidates.append((scheduled, row))
    return max(candidates, default=(None, None), key=lambda pair: pair[0])[1]


def result_ready(race: dict[str, str]) -> bool:
    results = ROOT / "data/curated/race_results.csv"
    if not results.exists():
        return False
    classified = {
        row.get("driver_id")
        for row in read_csv(results)
        if row.get("race_id") == race["id"] and row.get("driver_id")
    }
    qualifying = ROOT / "data/curated/qualifying_results.csv"
    qualified = {
        row.get("driver_id")
        for row in read_csv(qualifying)
        if row.get("race_id") == race["id"] and row.get("driver_id")
    } if qualifying.exists() else set()
    return len(classified) >= max(10, int(len(qualified) * 0.8))


def enriched_ready(race: dict[str, str]) -> bool:
    season, round_number = int(race["season"]), int(race["round"])
    checks = (
        ("data/canonical_fastf1/sessions.csv", "session_code", "R"),
        ("data/telemetry_features/telemetry_lap_summary.csv", "session", "R"),
        ("data/analytics/analytics_session_index.csv", "session", "R"),
        ("data/race_analysis/race_analysis_index.csv", None, None),
    )
    for filename, code_column, code in checks:
        path = ROOT / filename
        if not path.exists():
            return False
        if not any(
            row.get("season") == str(season)
            and row.get("round") == str(round_number)
            and (code_column is None or row.get(code_column) == code)
            for row in read_csv(path)
        ):
            return False
    return True


def race_telemetry_ready(race: dict[str, str]) -> bool:
    raw_root = ROOT / "data/raw/fastf1" / race["season"]
    manifests = raw_root.glob(f"{int(race['round']):02d}_*/R/session_manifest.json")
    for path in manifests:
        manifest = json.loads(path.read_text(encoding="utf-8"))
        if manifest.get("status") == "complete" and manifest.get("telemetry_available") and (path.parent / "telemetry.parquet").exists():
            return True
    return False


def run(*args: str) -> None:
    command = [sys.executable, *args]
    print("Running:", " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)


def build_web() -> None:
    subprocess.run(["npm.cmd" if os.name == "nt" else "npm", "run", "build"], cwd=ROOT, check=True)


def write_output(**values: str) -> None:
    path = os.getenv("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as handle:
            for key, value in values.items():
                handle.write(f"{key}={value}\n")
    print(json.dumps(values, sort_keys=True))


def require_publish_env() -> None:
    required = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PRODUCTION_BASE_URL")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError("Missing required publish configuration: " + ", ".join(missing))


def validate_core(race: dict[str, str]) -> None:
    if not result_ready(race):
        raise RuntimeError("Race result coverage is below 10 drivers")
    standings = ROOT / "data/curated/driver_standings.csv"
    standings_drivers = {
        row.get("driver_id") for row in read_csv(standings)
        if row.get("race_id") == race["id"] and row.get("driver_id")
    }
    if len(standings_drivers) < 10:
        raise RuntimeError("Driver standings do not include the completed race")
    state = json.loads((ROOT / "data/season_state.json").read_text(encoding="utf-8"))
    latest_result = state.get("latest_completed_race_with_results") or {}
    if (int(latest_result.get("season") or 0), int(latest_result.get("round") or 0)) < (int(race["season"]), int(race["round"])):
        raise RuntimeError("Season state does not include the completed race results")
    if state.get("next_race") and state["next_race"]["id"] == race["id"]:
        raise RuntimeError("The completed race is still marked as next")
    run("validate_season_state.py")


def validate_enriched(race: dict[str, str]) -> None:
    if not enriched_ready(race):
        raise RuntimeError("Enriched views do not cover the completed race")
    for validator in (
        "validate_canonical_fastf1.py",
        "validate_telemetry_features.py",
        "validate_analytics_views.py",
        "validate_analytics_telemetry_traces.py",
        "validate_race_analysis_views.py",
        "validate_season_state.py",
        "validate_product_manifest.py",
    ):
        run(validator)


def refresh(race: dict[str, str], stage: str) -> None:
    require_publish_env()
    print("Restoring durable pipeline history:", archive.restore(), flush=True)
    season = race["season"]
    round_number = race["round"]
    run("data/fetch_reference_data.py", "--start-season", season, "--end-season", season)
    run("data/normalize_results.py")
    print("Persisting source refresh:", archive.save(), flush=True)
    if not result_ready(race):
        print("Results have not settled; retry on the next scheduled run.")
        write_output(stage="none", race_id=race["id"])
        return
    run("data/build_product_views.py")
    run("data/build_pit_wall_picks.py")
    if stage == "enriched":
        try:
            run("data/fastf1_ingest.py", "--season", season, "--round", round_number,
                "--sessions", "FP1", "FP2", "FP3", "Q", "SQ", "S", "R",
                "--include-telemetry", "--only-missing", "--retry-failed", "--completion-buffer-minutes", "30")
            if not race_telemetry_ready(race):
                run("data/fastf1_ingest.py", "--season", season, "--round", round_number,
                    "--sessions", "R", "--include-telemetry", "--force", "--completion-buffer-minutes", "30")
        finally:
            print("Persisting FastF1 downloads:", archive.save(), flush=True)
        try:
            run("data/fetch_openf1_data.py", "--start-season", season, "--end-season", season,
                "--race-date", race["scheduled_at"],
                "--session-types", "FP1", "FP2", "FP3", "Q", "SQ", "S", "R")
            run("data/build_openf1_quality_report.py")
            run("validate_openf1_quality.py")
            run("data/build_openf1_telemetry_bridge.py", "--season", season, "--round", round_number)
        except subprocess.CalledProcessError:
            print("OpenF1 is delayed; continuing with explicit source gaps.", flush=True)
        print("Persisting downloaded sessions:", archive.save(), flush=True)
        run("data/build_pit_wall_picks.py")
        run("build_canonical_fastf1.py", "--start-season", "2020", "--end-season", season)
        run("build_telemetry_features.py", "--start-season", "2020", "--end-season", season)
        run("data/build_fastf1_features.py")
        run("data/build_fastf1_models.py")
        run("data/build_fastf1_track_paths.py", "--local-only", "--circuit-id", race["circuit_id"])
        run("data/build_analytics_views.py")
        run("data/build_analytics_indexes.py")
        run("data/build_analytics_telemetry_traces.py")
        run("data/build_race_analysis_views.py")
        run("data/build_race_week_layers.py")
        run("data/build_strategy_lab_layers.py")
    run("build_product_manifest.py")
    run("build_season_state.py")
    validate_core(race)
    if stage == "enriched":
        validate_enriched(race)
    run("data/build_web_fallback.py")
    build_web()
    print("Saving validated pipeline archive:", archive.save(), flush=True)
    run("data/load_supabase.py")
    write_output(stage=stage, race_id=race["id"], next_race_id=(json.loads((ROOT / "data/season_state.json").read_text(encoding="utf-8")).get("next_race") or {}).get("id", ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("run", "finalize"))
    parser.add_argument("--race-id")
    parser.add_argument("--stage", choices=("core", "enriched"))
    parser.add_argument("--force", action="store_true", help="Rebuild a previously completed enriched stage")
    parser.add_argument("--now", help="UTC time override for dry gate tests")
    args = parser.parse_args()
    if args.action == "finalize":
        if not args.race_id or not args.stage:
            raise RuntimeError("finalize requires --race-id and --stage")
        state = archive.release_state()
        state[args.race_id] = {"stage": args.stage, "published_at": datetime.now(UTC).isoformat()}
        archive.save_release_state(state)
        return
    now = datetime.fromisoformat(args.now.replace("Z", "+00:00")) if args.now else datetime.now(UTC)
    races = read_csv(RACES)
    race = next((row for row in races if row["id"] == args.race_id), None) if args.race_id else race_target(now, races)
    if args.race_id and race is None:
        raise RuntimeError(f"Unknown race ID: {args.race_id}")
    if not race:
        write_output(stage="none", race_id="")
        return
    require_publish_env()
    prior = archive.release_state().get(race["id"], {}).get("stage")
    if prior == "enriched" and not args.force:
        write_output(stage="none", race_id=race["id"])
        return
    refresh(race, "enriched" if prior in {"core", "enriched"} else "core")


if __name__ == "__main__":
    main()
