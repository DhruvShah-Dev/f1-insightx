from __future__ import annotations

import fnmatch
import subprocess
from pathlib import PurePosixPath

BLOCKED_PATTERNS = [
    "data/raw/**",
    "data/staged/**",
    "data/canonical_fastf1/*.csv",
    "data/canonical_sessions/*.csv",
    "data/quarantine/**",
    "data/telemetry_features/**",
    "data/analytics/*.csv",
    "data/analytics/indexed/**",
    "data/reports/**",
    "*.parquet",
    "*.feather",
    "*.arrow",
]

# Compact validation snapshots are part of the release contract. Bulk source
# archives and generated session shards are not.
RELEASE_REPORTS = {
    "data/reports/openf1_2026_session_audit.json",
    "data/reports/race_evidence_quality_report.json",
    "data/reports/opening_evidence_quality_report.json",
    "data/reports/decisive_lap_quality_report.json",
}


def new_files() -> list[str]:
    # The repository contains historical tracked archives. Guard newly added
    # files without requiring an unrelated rewrite of that published history.
    paths: set[str] = set()
    for args in (
        ["git", "ls-files", "--others", "--exclude-standard"],
        ["git", "diff", "--cached", "--name-only", "--diff-filter=A"],
    ):
        result = subprocess.run(args, check=True, capture_output=True, text=True)
        paths.update(line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip())
    return sorted(paths)


def matches(path: str, pattern: str) -> bool:
    normalized = PurePosixPath(path).as_posix()
    return fnmatch.fnmatch(normalized, pattern)


def main() -> None:
    added = new_files()
    violations = sorted(
        path
        for path in added
        if path not in RELEASE_REPORTS and not path.endswith(".gitkeep")
        and any(matches(path, pattern) for pattern in BLOCKED_PATTERNS)
    )

    if violations:
        print("New bulk or generated artifacts would enter git:")
        for path in violations:
            print(f"- {path}")
        raise SystemExit(1)

    print("Generated artifact guard passed.")


if __name__ == "__main__":
    main()
