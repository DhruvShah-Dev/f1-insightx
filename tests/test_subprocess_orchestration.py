from __future__ import annotations

import ast
import sys
from pathlib import Path
from unittest.mock import patch

from data import refresh_current_race_week_sessions, run_fastf1_pipeline


ROOT = Path(__file__).resolve().parents[1]


def _assert_no_shell_true(path: Path) -> None:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        for keyword in node.keywords:
            if keyword.arg == "shell" and isinstance(keyword.value, ast.Constant):
                assert keyword.value.value is not True, f"{path} must not call subprocess with shell=True"


def test_fastf1_pipeline_uses_fixed_command_allowlist() -> None:
    commands: list[list[str]] = []

    def record_command(command: list[str], check: bool) -> None:
        commands.append(command)
        assert check is True

    with patch.object(sys, "argv", ["run_fastf1_pipeline.py", "--start-season", "2025", "--end-season", "2026", "--force"]):
        with patch.object(run_fastf1_pipeline.subprocess, "run", side_effect=record_command):
            run_fastf1_pipeline.main()

    data_dir = ROOT / "data"
    expected_scripts = [
        data_dir / "fastf1_ingest.py",
        data_dir / "build_fastf1_features.py",
        data_dir / "build_fastf1_models.py",
        data_dir / "build_race_week_layers.py",
        data_dir / "build_strategy_lab_layers.py",
        data_dir / "build_fastf1_track_paths.py",
    ]

    assert [Path(command[1]) for command in commands] == expected_scripts
    assert all(command[0] == sys.executable for command in commands)
    assert commands[0][-1] == "--force"
    assert commands[-1][-1] == "--force"


def test_race_week_refresh_builds_allowlisted_commands() -> None:
    commands: list[list[str]] = []

    def record_command(command: list[str]) -> dict[str, object]:
        commands.append(command)
        return {"command": command, "returncode": 0, "stdout": "{}", "stderr": "", "json": {"run": {}}}

    with patch.object(
        sys,
        "argv",
        [
            "refresh_current_race_week_sessions.py",
            "--sessions",
            "FP1",
            "Q",
            "--retry-failed",
            "--completion-buffer-minutes",
            "45",
        ],
    ):
        with patch.object(
            refresh_current_race_week_sessions,
            "load_current_race_week",
            return_value={"id": "2026-austria", "season": 2026, "round": 11, "race_name": "Austrian Grand Prix"},
        ):
            with patch.object(refresh_current_race_week_sessions, "run_command", side_effect=record_command):
                refresh_current_race_week_sessions.main()

    assert commands[0][:7] == [
        sys.executable,
        "data/fastf1_ingest.py",
        "--season",
        "2026",
        "--round",
        "11",
        "--sessions",
    ]
    assert commands[0][7:9] == ["FP1", "Q"]
    assert "--retry-failed" in commands[0]
    assert commands[1:] == [
        [sys.executable, "data/build_race_week_layers.py"],
        [sys.executable, "build_product_manifest.py"],
        [sys.executable, "build_season_state.py"],
    ]


def test_orchestration_never_uses_shell_true() -> None:
    _assert_no_shell_true(ROOT / "data" / "run_fastf1_pipeline.py")
    _assert_no_shell_true(ROOT / "data" / "refresh_current_race_week_sessions.py")
