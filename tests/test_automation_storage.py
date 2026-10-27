from __future__ import annotations

import json
from pathlib import Path

from data import automation_storage as archive


class Bucket:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def upload(self, key: str, content: bytes, _options: dict) -> None:
        self.objects[key] = content

    def download(self, key: str) -> bytes:
        if key not in self.objects:
            raise RuntimeError("not found")
        return self.objects[key]


def test_archive_is_chunked_idempotent_and_restorable(monkeypatch, tmp_path: Path) -> None:
    bucket = Bucket()
    monkeypatch.setattr(archive, "ROOT", tmp_path)
    monkeypatch.setattr(archive, "CHUNK_SIZE", 4)
    monkeypatch.setattr(archive, "storage", lambda: bucket)
    source = tmp_path / "data/raw/fastf1/session.bin"
    source.parent.mkdir(parents=True)
    source.write_bytes(b"abcdefghij")
    first = archive.save()
    assert first["uploaded"] == 3
    assert archive.save()["uploaded"] == 0
    manifest = json.loads(bucket.download("v1/archive-manifest.json"))
    assert manifest["files"]["data/raw/fastf1/session.bin"]["chunks"] == 3
    source.unlink()
    assert archive.restore()["restored"] == 1
    assert source.read_bytes() == b"abcdefghij"


def test_archive_rejects_path_traversal(monkeypatch, tmp_path: Path) -> None:
    bucket = Bucket()
    monkeypatch.setattr(archive, "ROOT", tmp_path)
    monkeypatch.setattr(archive, "storage", lambda: bucket)
    bucket.objects["v1/archive-manifest.json"] = json.dumps({"files": {"data/../../outside": "bad"}}).encode()
    try:
        archive.restore()
    except RuntimeError as error:
        assert "Unsafe archive path" in str(error)
    else:
        raise AssertionError("Unsafe path was accepted")
