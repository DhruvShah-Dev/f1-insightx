from __future__ import annotations

import fnmatch
import subprocess
from pathlib import PurePosixPath

BLOCKED_PATTERNS = [
    "data/raw/**",
    "data/staged/**",
    "data/canonical_fastf1/*.csv",
    "data/telemetry_features/**",
    "data/analytics/*.csv",
    "data/analytics/indexed/**",
    "data/reports/**",
    "*.parquet",
    "*.feather",
    "*.arrow",
]


def git_ls_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        check=True,
        capture_output=True,
        text=True,
    )
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def matches(path: str, pattern: str) -> bool:
    normalized = PurePosixPath(path).as_posix()
    return fnmatch.fnmatch(normalized, pattern)


def main() -> None:
    tracked = git_ls_files()
    violations = sorted(
        path
        for path in tracked
        if not path.endswith(".gitkeep") and any(matches(path, pattern) for pattern in BLOCKED_PATTERNS)
    )

    if violations:
        print("Generated or large artifacts are tracked and should be removed from git:")
        for path in violations:
            print(f"- {path}")
        raise SystemExit(1)

    print("Generated artifact guard passed.")


if __name__ == "__main__":
    main()
