"""Persist pipeline inputs and release state in a private Supabase Storage bucket."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
BUCKET = "f1-insightx-pipeline"
PREFIX = "v2"
LEGACY_PREFIX = "v1"
CHUNK_SIZE = 5 * 1024 * 1024
ARCHIVE_DIRS = (
    "data/raw",
    "data/staged",
    "data/canonical_fastf1",
    "data/canonical_sessions",
    "data/quarantine",
    "data/telemetry_features",
    "data/analytics",
    "data/race_analysis",
    "data/race_week",
    "data/strategy_lab",
    "data/curated",
    "data/features",
    "data/model_inputs",
    "data/predictions",
    "data/reports",
)


def storage():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return create_client(url, key).storage.from_(os.environ.get("PIPELINE_STORAGE_BUCKET") or BUCKET)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(bucket, key: str) -> dict:
    try:
        return json.loads(bucket.download(key))
    except Exception as error:
        # Missing objects are expected on a newly provisioned bucket. Other
        # failures must stop the job rather than silently dropping history.
        message = str(error).lower()
        if "not found" in message and "bucket" not in message:
            return {}
        raise


def put_json(bucket, key: str, value: dict) -> None:
    bucket.upload(key, json.dumps(value, sort_keys=True).encode(), {"content-type": "application/json", "upsert": "true"})


def archive_files() -> list[Path]:
    files: list[Path] = []
    for dirname in ARCHIVE_DIRS:
        directory = ROOT / dirname
        if directory.exists():
            files.extend(path for path in directory.rglob("*") if path.is_file() and not path.name.startswith(".git"))
    return sorted(set(files))


def restore() -> dict:
    bucket = storage()
    manifest = read_json(bucket, f"{PREFIX}/archive-manifest.json")
    prefix = PREFIX
    if not manifest:
        manifest = read_json(bucket, f"{LEGACY_PREFIX}/archive-manifest.json")
        prefix = LEGACY_PREFIX
    entries = manifest.get("files", {})
    if not isinstance(entries, dict):
        raise RuntimeError("Invalid pipeline archive manifest")
    restored = 0
    for name, entry in entries.items():
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT / "data") or not name.startswith("data/"):
            raise RuntimeError(f"Unsafe archive path: {name}")
        expected_hash = entry["sha256"] if isinstance(entry, dict) else entry
        if path.exists() and digest(path.read_bytes()) == expected_hash:
            continue
        if isinstance(entry, dict):
            content = b"".join(
                bucket.download(f"{prefix}/archive/{name}/{expected_hash}/part-{index:05d}")
                for index in range(entry["chunks"])
            )
        else:
            content = bucket.download(f"{prefix}/archive/{name}")
        if digest(content) != expected_hash:
            raise RuntimeError(f"Archive checksum mismatch: {name}")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + ".restore.tmp")
        temporary.write_bytes(content)
        temporary.replace(path)
        restored += 1
    return {"archive_prefix": prefix, "manifest_files": len(entries), "restored": restored}


def save() -> dict:
    bucket = storage()
    previous = read_json(bucket, f"{PREFIX}/archive-manifest.json").get("files", {})
    entries = dict(previous)
    uploaded = 0
    for path in archive_files():
        name = path.relative_to(ROOT).as_posix()
        content = path.read_bytes()
        checksum = digest(content)
        previous_entry = previous.get(name)
        previous_hash = previous_entry.get("sha256") if isinstance(previous_entry, dict) else previous_entry
        if previous_hash != checksum or not isinstance(previous_entry, dict):
            for index, offset in enumerate(range(0, len(content), CHUNK_SIZE) or [0]):
                bucket.upload(
                    f"{PREFIX}/archive/{name}/{checksum}/part-{index:05d}",
                    content[offset:offset + CHUNK_SIZE],
                    {"content-type": "application/octet-stream", "upsert": "true"},
                )
                uploaded += 1
        entries[name] = {"sha256": checksum, "chunks": max(1, (len(content) + CHUNK_SIZE - 1) // CHUNK_SIZE), "size": len(content)}
    put_json(bucket, f"{PREFIX}/archive-manifest.json", {"schema_version": 1, "files": entries})
    return {"manifest_files": len(entries), "uploaded": uploaded}


def release_state() -> dict:
    bucket = storage()
    current = read_json(bucket, f"{PREFIX}/release-state.json")
    return current or read_json(bucket, f"{LEGACY_PREFIX}/release-state.json")


def save_release_state(value: dict) -> None:
    put_json(storage(), f"{PREFIX}/release-state.json", value)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Manage the durable pipeline archive")
    parser.add_argument("action", choices=("save", "restore"))
    args = parser.parse_args()
    print(json.dumps(save() if args.action == "save" else restore(), indent=2))
