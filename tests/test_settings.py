from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data"))

from f1_insightx_data.settings import DEFAULT_JOLPICA_BASE_URL, DEFAULT_OPENF1_BASE_URL, load_settings


def test_blank_api_base_urls_fall_back_to_defaults(monkeypatch) -> None:
    monkeypatch.setenv("JOLPICA_BASE_URL", "")
    monkeypatch.setenv("OPENF1_BASE_URL", "   ")

    settings = load_settings()

    assert settings.jolpica_base_url == DEFAULT_JOLPICA_BASE_URL
    assert settings.openf1_base_url == DEFAULT_OPENF1_BASE_URL


def test_api_base_urls_are_trimmed_and_normalized(monkeypatch) -> None:
    monkeypatch.setenv("JOLPICA_BASE_URL", " https://example.test/f1/ ")
    monkeypatch.setenv("OPENF1_BASE_URL", " https://openf1.example.test/v1/ ")

    settings = load_settings()

    assert settings.jolpica_base_url == "https://example.test/f1"
    assert settings.openf1_base_url == "https://openf1.example.test/v1"
