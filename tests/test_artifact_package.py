from __future__ import annotations

import json
from pathlib import Path

from data.f1_insightx_data.artifact_package import create_runtime_artifact


def write(path: Path, value: str = "x") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")


def test_runtime_artifact_packages_only_runtime_safe_data(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    output = tmp_path / "out"

    write(repo / "data" / "analytics" / "analytics_session_index.csv")
    write(repo / "data" / "analytics" / "indexed" / "sessions" / "fixture.json.gz")
    write(repo / "data" / "race_analysis" / "race_analysis_index.csv")
    write(repo / "data" / "reports" / "product_manifest.json", "{}")
    write(repo / "data" / "race_week" / "race_week_overview.csv")
    write(repo / "data" / "strategy_lab" / "strategy_lab_overview.csv")
    write(repo / "data" / "curated" / "races.csv")
    write(repo / "data" / "predictions" / "race_pick_challenges.csv")
    write(repo / "data" / "season_state.json", "{}")

    write(repo / "data" / "raw" / "fastf1" / "raw.csv")
    write(repo / "data" / "canonical_fastf1" / "laps_canonical.csv")
    write(repo / "data" / "telemetry_features" / "telemetry_lap_summary.csv")

    artifact = create_runtime_artifact(repo_root=repo, output_dir=output, stamp="test", archive=False)

    assert (artifact.bundle_dir / "data" / "analytics" / "analytics_session_index.csv").exists()
    assert (artifact.bundle_dir / "data" / "race_analysis" / "race_analysis_index.csv").exists()
    assert (artifact.bundle_dir / "data" / "season_state.json").exists()
    assert not (artifact.bundle_dir / "data" / "raw").exists()
    assert not (artifact.bundle_dir / "data" / "canonical_fastf1").exists()
    assert not (artifact.bundle_dir / "data" / "telemetry_features").exists()


def test_runtime_artifact_manifest_records_included_paths(tmp_path: Path) -> None:
    repo = tmp_path / "repo"
    write(repo / "data" / "analytics" / "analytics_session_index.csv")
    write(repo / "data" / "season_state.json", "{}")

    artifact = create_runtime_artifact(repo_root=repo, output_dir=tmp_path / "out", stamp="manifest", archive=False)

    manifest = json.loads((artifact.bundle_dir / "artifact-manifest.json").read_text(encoding="utf-8"))
    assert "data/analytics" in manifest["includes"]
    assert "data/season_state.json" in manifest["includes"]
    assert all("raw" not in included for included in manifest["includes"])
