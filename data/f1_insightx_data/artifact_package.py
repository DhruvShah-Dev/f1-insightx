from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable


RUNTIME_DATA_PATHS = (
    "analytics",
    "race_analysis",
    "reports",
    "race_week",
    "strategy_lab",
    "curated",
    "predictions",
)

RUNTIME_DATA_FILES = ("season_state.json",)


@dataclass(frozen=True)
class RuntimeArtifact:
    bundle_dir: Path
    archive_path: Path | None
    file_count: int
    byte_count: int


def utc_stamp() -> str:
    return datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")


def iter_files(path: Path) -> Iterable[Path]:
    if path.is_file():
        yield path
        return

    for child in path.rglob("*"):
        if child.is_file():
            yield child


def copy_runtime_data(*, repo_root: Path, bundle_dir: Path) -> list[str]:
    data_root = repo_root / "data"
    bundled_data = bundle_dir / "data"
    bundled_data.mkdir(parents=True, exist_ok=True)

    included: list[str] = []

    for relative_dir in RUNTIME_DATA_PATHS:
        source = data_root / relative_dir
        if not source.exists():
            continue

        destination = bundled_data / relative_dir
        shutil.copytree(source, destination, dirs_exist_ok=True)
        included.append(f"data/{relative_dir}")

    for relative_file in RUNTIME_DATA_FILES:
        source = data_root / relative_file
        if not source.exists():
            continue

        shutil.copy2(source, bundled_data / relative_file)
        included.append(f"data/{relative_file}")

    return included


def write_artifact_manifest(*, repo_root: Path, bundle_dir: Path, included: list[str]) -> Path:
    manifest_path = bundle_dir / "artifact-manifest.json"
    payload = {
        "created_at": datetime.now(UTC).isoformat(),
        "source_root": str(repo_root),
        "includes": included,
        "note": "Runtime data bundle for bundled-artifact deployment. Keep out of Git.",
    }
    manifest_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest_path


def create_zip_archive(bundle_dir: Path) -> Path:
    archive_base = bundle_dir.with_suffix("")
    archive_name = shutil.make_archive(str(archive_base), "zip", root_dir=bundle_dir)
    return Path(archive_name)


def create_runtime_artifact(
    *,
    repo_root: Path,
    output_dir: Path,
    stamp: str | None = None,
    archive: bool = True,
) -> RuntimeArtifact:
    resolved_root = repo_root.resolve()
    resolved_output = output_dir.resolve()
    bundle_dir = resolved_output / f"deploy-runtime-{stamp or utc_stamp()}"
    bundle_dir.mkdir(parents=True, exist_ok=True)

    included = copy_runtime_data(repo_root=resolved_root, bundle_dir=bundle_dir)
    write_artifact_manifest(repo_root=resolved_root, bundle_dir=bundle_dir, included=included)

    files = list(iter_files(bundle_dir))
    archive_path = create_zip_archive(bundle_dir) if archive else None

    return RuntimeArtifact(
        bundle_dir=bundle_dir,
        archive_path=archive_path,
        file_count=len(files),
        byte_count=sum(file.stat().st_size for file in files),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Package runtime-safe data artifacts for deployment.")
    parser.add_argument("--repo-root", default=".", help="Repository root. Defaults to the current directory.")
    parser.add_argument("--output-dir", default="artifacts", help="Directory for deploy-runtime-* bundles.")
    parser.add_argument("--stamp", default=None, help="Optional deterministic bundle timestamp.")
    parser.add_argument("--no-zip", action="store_true", help="Create the expanded bundle only.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    artifact = create_runtime_artifact(
        repo_root=Path(args.repo_root),
        output_dir=Path(args.output_dir),
        stamp=args.stamp,
        archive=not args.no_zip,
    )
    print(
        json.dumps(
            {
                "bundle_dir": str(artifact.bundle_dir),
                "archive_path": str(artifact.archive_path) if artifact.archive_path else None,
                "file_count": artifact.file_count,
                "byte_count": artifact.byte_count,
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
