from __future__ import annotations

import subprocess
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "data" / "ml" / "generated"


def read_generated(name: str) -> pd.DataFrame:
    path = GENERATED / name
    assert path.exists(), f"{name} was not generated"
    return pd.read_csv(path, low_memory=False)


def race_dates() -> dict[str, pd.Timestamp]:
    races = pd.read_csv(ROOT / "data" / "curated" / "races.csv")
    races["scheduled_at"] = pd.to_datetime(races["scheduled_at"], utc=True, errors="coerce")
    return dict(zip(races["id"].astype(str), races["scheduled_at"]))


def clean_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip()
    return "" if text.lower() == "nan" else text


def test_pre_race_features_have_required_cutoff_columns() -> None:
    for name in ["pre_race_driver_features.csv", "pre_race_team_features.csv", "pre_race_track_features.csv"]:
        frame = read_generated(name)
        assert not frame.empty
        for column in [
            "feature_version",
            "source_data_version",
            "feature_cutoff_race_id",
            "target_race_id",
            "feature_set_type",
            "source_race_ids",
            "missing_flags",
            "proxy_feature_count",
            "proxy_feature_flags",
            "proxy_heavy_flag",
            "data_quality_score",
        ]:
            assert column in frame.columns
        assert (frame["feature_set_type"] == "pre_race").all()


def test_pre_race_features_do_not_contain_label_columns() -> None:
    forbidden = {
        "finish_position",
        "finish_band",
        "points_finish",
        "podium_flag",
        "top_five_flag",
        "dnf_flag",
        "teammate_delta",
        "label_cutoff",
        "label_quality_score",
    }
    for name in ["pre_race_driver_features.csv", "pre_race_team_features.csv", "pre_race_track_features.csv"]:
        frame = read_generated(name)
        assert forbidden.isdisjoint(set(frame.columns)), name


def test_source_races_are_before_target_race() -> None:
    dates = race_dates()
    for name in ["pre_race_driver_features.csv", "pre_race_team_features.csv", "pre_race_track_features.csv"]:
        frame = read_generated(name)
        for row in frame.to_dict("records"):
            target_date = dates[clean_text(row["target_race_id"])]
            cutoff = clean_text(row.get("feature_cutoff_race_id"))
            if cutoff:
                assert dates[cutoff] < target_date
            sources = clean_text(row.get("source_race_ids"))
            for source_id in [part for part in sources.split(";") if part]:
                assert dates[source_id] < target_date


def test_labels_are_separate_and_bounded() -> None:
    labels = read_generated("race_outcome_labels.csv")
    features = read_generated("pre_race_driver_features.csv")
    assert len(labels) == len(features)
    assert "finish_position" in labels.columns
    assert "finish_position" not in features.columns
    quality = pd.to_numeric(labels["label_quality_score"], errors="coerce")
    assert ((quality >= 0) & (quality <= 1)).all()
    assert quality.nunique() > 1


def test_driver_track_context_and_proxy_metadata_are_useful() -> None:
    features = read_generated("pre_race_driver_features.csv")
    assert "unknown" not in set(features["track_archetype"].astype(str))
    assert features["track_archetype"].nunique() > 1
    assert features["track_fit_score"].notna().mean() >= 0.8

    proxy_counts = pd.to_numeric(features["proxy_feature_count"], errors="coerce")
    assert proxy_counts.notna().all()
    assert (proxy_counts >= 0).all()
    assert features["proxy_feature_flags"].astype(str).str.len().gt(0).all()


def test_quality_labels_and_generated_files_are_ignored() -> None:
    quality = read_generated("data_quality_labels.csv")
    assert not quality.empty
    assert "missing_flags" in quality.columns
    confidence = pd.to_numeric(quality["confidence_score"], errors="coerce")
    assert ((confidence >= 0) & (confidence <= 1)).all()

    for path in GENERATED.glob("*"):
        if path.is_file():
            result = subprocess.run(["git", "check-ignore", "-q", str(path)], cwd=ROOT, check=False)
            assert result.returncode == 0, f"{path} is not ignored"
