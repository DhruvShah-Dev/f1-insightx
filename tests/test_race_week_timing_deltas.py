from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "data"))
BUILDER_PATH = ROOT / "data" / "build_race_week_layers.py"

spec = importlib.util.spec_from_file_location("build_race_week_layers", BUILDER_PATH)
builder = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(builder)


def race_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": "2025-01-test", "season": 2025, "round": 1, "race_name": "Prior Test GP", "circuit_id": "test_circuit", "scheduled_at": "2025-01-01T00:00:00Z", "sprint_weekend": False},
            {"id": "2025-01-other", "season": 2025, "round": 1, "race_name": "Other GP", "circuit_id": "other_circuit", "scheduled_at": "2025-01-08T00:00:00Z", "sprint_weekend": False},
            {"id": "2026-01-test", "season": 2026, "round": 1, "race_name": "Test GP", "circuit_id": "test_circuit", "scheduled_at": "2026-01-01T00:00:00Z", "sprint_weekend": False},
        ]
    )


def active_race_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "id": "2026-01-test",
                "season": 2026,
                "round": 1,
                "race_id": "2026-01-test",
                "race_name": "Test GP",
                "circuit_id": "test_circuit",
                "scheduled_at": "2026-01-01T00:00:00Z",
                "status": "upcoming",
                "is_next_race": True,
            }
        ]
    )


def spain_race_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": "2025-01-alpha", "season": 2025, "round": 1, "race_name": "Alpha GP", "circuit_id": "alpha", "scheduled_at": "2025-03-01T13:00:00Z", "sprint_weekend": False},
            {"id": "2025-02-beta", "season": 2025, "round": 2, "race_name": "Beta GP", "circuit_id": "beta", "scheduled_at": "2025-03-08T13:00:00Z", "sprint_weekend": False},
            {"id": "2025-03-gamma", "season": 2025, "round": 3, "race_name": "Gamma GP", "circuit_id": "gamma", "scheduled_at": "2025-03-15T13:00:00Z", "sprint_weekend": False},
            {"id": "2025-04-delta", "season": 2025, "round": 4, "race_name": "Delta GP", "circuit_id": "delta", "scheduled_at": "2025-03-22T13:00:00Z", "sprint_weekend": False},
            {"id": "2025-05-outlier", "season": 2025, "round": 5, "race_name": "Outlier GP", "circuit_id": "outlier", "scheduled_at": "2025-03-29T13:00:00Z", "sprint_weekend": False},
            {"id": "2024-10-catalunya", "season": 2024, "round": 10, "race_name": "Spanish Grand Prix", "circuit_id": "catalunya", "scheduled_at": "2024-06-23T13:00:00Z", "sprint_weekend": False},
            {"id": "2025-09-catalunya", "season": 2025, "round": 9, "race_name": "Spanish Grand Prix", "circuit_id": "catalunya", "scheduled_at": "2025-06-01T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-01-alpha", "season": 2026, "round": 1, "race_name": "Alpha GP", "circuit_id": "alpha", "scheduled_at": "2026-03-01T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-02-beta", "season": 2026, "round": 2, "race_name": "Beta GP", "circuit_id": "beta", "scheduled_at": "2026-03-08T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-03-gamma", "season": 2026, "round": 3, "race_name": "Gamma GP", "circuit_id": "gamma", "scheduled_at": "2026-03-15T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-04-delta", "season": 2026, "round": 4, "race_name": "Delta GP", "circuit_id": "delta", "scheduled_at": "2026-03-22T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-05-outlier", "season": 2026, "round": 5, "race_name": "Outlier GP", "circuit_id": "outlier", "scheduled_at": "2026-03-29T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-01-before", "season": 2026, "round": 1, "race_name": "Before GP", "circuit_id": "before", "scheduled_at": "2026-03-01T13:00:00Z", "sprint_weekend": False},
            {"id": "2026-07-catalunya", "season": 2026, "round": 7, "race_name": "Barcelona Grand Prix", "circuit_id": "catalunya", "scheduled_at": "2026-06-14T13:00:00Z", "sprint_weekend": False},
        ]
    )


def spain_active_race_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "id": "2026-07-catalunya",
                "season": 2026,
                "round": 7,
                "race_id": "2026-07-catalunya",
                "race_name": "Barcelona Grand Prix",
                "circuit_id": "catalunya",
                "scheduled_at": "2026-06-14T13:00:00Z",
                "status": "upcoming",
                "is_next_race": True,
            }
        ]
    )


def spain_qualifying_results_frame() -> pd.DataFrame:
    rows = [
        ("2025-01-alpha|pole", "2025-01-alpha", "pole", "ref", 1, 80000),
        ("2025-02-beta|pole", "2025-02-beta", "pole", "ref", 1, 81000),
        ("2025-03-gamma|pole", "2025-03-gamma", "pole", "ref", 1, 82000),
        ("2025-04-delta|pole", "2025-04-delta", "pole", "ref", 1, 83000),
        ("2025-05-outlier|pole", "2025-05-outlier", "pole", "ref", 1, 84000),
        ("2024-10-catalunya|norris", "2024-10-catalunya", "norris", "mclaren", 1, 71383),
        ("2024-10-catalunya|piastri", "2024-10-catalunya", "piastri", "mclaren", 10, 72011),
        ("2024-10-catalunya|alonso", "2024-10-catalunya", "alonso", "aston_martin", 11, 72128),
        ("2025-09-catalunya|piastri", "2025-09-catalunya", "piastri", "mclaren", 1, 71546),
        ("2025-09-catalunya|norris", "2025-09-catalunya", "norris", "mclaren", 2, 71755),
        ("2025-09-catalunya|alonso", "2025-09-catalunya", "alonso", "aston_martin", 10, 72284),
        ("2026-01-alpha|pole", "2026-01-alpha", "pole", "ref", 1, 81400),
        ("2026-02-beta|pole", "2026-02-beta", "pole", "ref", 1, 82600),
        ("2026-03-gamma|pole", "2026-03-gamma", "pole", "ref", 1, 83800),
        ("2026-04-delta|pole", "2026-04-delta", "pole", "ref", 1, 85000),
        ("2026-05-outlier|pole", "2026-05-outlier", "pole", "ref", 1, 87400),
        ("2026-01-before|norris", "2026-01-before", "norris", "mclaren", 1, 70000),
        ("2026-01-before|piastri", "2026-01-before", "piastri", "mclaren", 2, 70250),
        ("2026-01-before|alonso", "2026-01-before", "alonso", "aston_martin", 8, 71000),
    ]
    return pd.DataFrame(
        [
            {
                "id": row[0],
                "race_id": row[1],
                "driver_id": row[2],
                "constructor_id": row[3],
                "position": row[4],
                "q1_time_ms": row[5],
                "q2_time_ms": None,
                "q3_time_ms": None,
                "status": "CLASSIFIED",
            }
            for row in rows
        ]
    )


def spain_driver_features_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": "2026-07-catalunya|norris", "season": 2026, "round": 7, "race_id": "2026-07-catalunya", "driver_id": "norris", "constructor_id": "mclaren", "form_bias_score": 0.8},
            {"id": "2026-07-catalunya|rookie", "season": 2026, "round": 7, "race_id": "2026-07-catalunya", "driver_id": "rookie", "constructor_id": "mclaren", "form_bias_score": 0.5},
            {"id": "2026-07-catalunya|alonso", "season": 2026, "round": 7, "race_id": "2026-07-catalunya", "driver_id": "alonso", "constructor_id": "aston_martin", "form_bias_score": 0.4},
        ]
    )


def session_pace_frame() -> pd.DataFrame:
    rows = [
        ("2025-01-test|Q|norris", 2025, 1, "2025-01-test", "2025-01-test|Q", "Q", "norris", "mclaren", 0.2),
        ("2025-01-test|FP1|norris", 2025, 1, "2025-01-test", "2025-01-test|FP1", "FP1", "norris", "mclaren", 0.4),
        ("2025-01-other|Q|norris", 2025, 1, "2025-01-other", "2025-01-other|Q", "Q", "norris", "mclaren", 4.0),
        ("2026-01-test|Q|norris", 2026, 1, "2026-01-test", "2026-01-test|Q", "Q", "norris", "mclaren", 0.1),
        ("2026-01-test|Q|rookie", 2026, 1, "2026-01-test", "2026-01-test|Q", "Q", "rookie", "academy", 0.7),
        ("2026-01-test|FP1|norris", 2026, 1, "2026-01-test", "2026-01-test|FP1", "FP1", "norris", "mclaren", 0.3),
    ]
    return pd.DataFrame(
        [
            {
                "id": row[0],
                "season": row[1],
                "round": row[2],
                "race_id": row[3],
                "session_id": row[4],
                "session_code": row[5],
                "driver_id": row[6],
                "constructor_id": row[7],
                "representative_lap_s": None,
                "best_lap_s": 80.0 + row[8],
                "long_run_lap_s": None,
                "long_run_degradation_s": None,
                "gap_to_session_best_s": row[8],
                "pace_rank": None,
                "gap_to_teammate_s": None,
                "top_speed_kph": None,
                "air_temp_c": None,
                "track_temp_c": None,
                "rainfall_flag": False,
                "source_label": "test",
            }
            for row in rows
        ]
    )


def test_session_yoy_deltas_match_same_circuit_and_skip_missing_drivers() -> None:
    deltas = builder.build_session_year_over_year_deltas(
        session_pace=session_pace_frame(),
        races=race_frame(),
        active_races=active_race_frame(),
    )

    assert set(deltas["driver_id"]) == {"norris"}
    assert set(deltas["comparison_race_id"]) == {"2025-01-test"}
    q_delta = deltas[(deltas["driver_id"] == "norris") & (deltas["session_code"] == "Q")].iloc[0]
    assert q_delta["delta_gap_s"] == -0.1


def test_qualifying_pairwise_deltas_are_antisymmetric() -> None:
    yoy = builder.build_session_year_over_year_deltas(
        session_pace=session_pace_frame(),
        races=race_frame(),
        active_races=active_race_frame(),
    )
    qualifying = builder.build_qualifying_driver_deltas(
        session_pace=session_pace_frame(),
        races=race_frame(),
        active_races=active_race_frame(),
        session_year_over_year_deltas=yoy,
    )

    pairwise = qualifying[qualifying["delta_type"] == "pairwise_driver_delta"]
    left = pairwise[(pairwise["driver_id"] == "norris") & (pairwise["comparison_driver_id"] == "rookie")].iloc[0]
    right = pairwise[(pairwise["driver_id"] == "rookie") & (pairwise["comparison_driver_id"] == "norris")].iloc[0]
    assert left["pairwise_delta_gap_s"] == -right["pairwise_delta_gap_s"]


def test_missing_historical_qualifying_delta_is_neutral_signal() -> None:
    canonical = {
        "session_pace_summary": session_pace_frame(),
        "session_laps": pd.DataFrame(columns=["race_id", "driver_id", "session_id", "is_accurate", "deleted", "lap_time_s"]),
        "session_weather": pd.DataFrame(columns=["race_id", "rainfall", "wind_speed_mps"]),
    }
    intelligence = builder.build_race_week_intelligence_layers(
        canonical=canonical,
        races=race_frame(),
        circuits=pd.DataFrame([{"id": "test_circuit", "high_speed_bias": 5, "overtake_difficulty": 5, "tire_degradation_bias": 5}]),
        drivers=pd.DataFrame([{"id": "norris", "full_name": "Lando Norris"}, {"id": "rookie", "full_name": "Rookie Driver"}]),
        constructors=pd.DataFrame([{"id": "mclaren", "name": "McLaren"}, {"id": "academy", "name": "Academy"}]),
        qualifying_results=pd.DataFrame(columns=["driver_id", "race_id", "position"]),
        race_results=pd.DataFrame(columns=["driver_id", "race_id", "finish_position", "finish_status"]),
        prediction_snapshots=pd.DataFrame(),
        fastf1_predictions=pd.DataFrame(),
        strategy_profiles=pd.DataFrame(),
        race_week_context=active_race_frame(),
        strategy_baselines=pd.DataFrame(),
    )

    rookie = intelligence["driver_signals"][intelligence["driver_signals"]["driver_id"] == "rookie"].iloc[0]
    assert rookie["quali_delta_signal"] == 0.5


def test_empty_race_week_context_degrades_without_next_race_column() -> None:
    canonical = {
        "session_pace_summary": pd.DataFrame(),
        "session_laps": pd.DataFrame(),
        "session_weather": pd.DataFrame(),
    }

    intelligence = builder.build_race_week_intelligence_layers(
        canonical=canonical,
        races=race_frame(),
        circuits=pd.DataFrame(),
        drivers=pd.DataFrame(),
        constructors=pd.DataFrame(),
        qualifying_results=pd.DataFrame(),
        race_results=pd.DataFrame(),
        prediction_snapshots=pd.DataFrame(),
        fastf1_predictions=pd.DataFrame(),
        strategy_profiles=pd.DataFrame(),
        race_week_context=pd.DataFrame(),
        strategy_baselines=pd.DataFrame(),
    )
    product_views = builder.build_race_week_product_views_from_intelligence(
        races=race_frame(),
        drivers=pd.DataFrame(),
        constructors=pd.DataFrame(),
        race_week_context=pd.DataFrame(),
        strategy_view=pd.DataFrame(),
        intelligence=intelligence,
    )

    assert intelligence["driver_signals"].empty
    assert product_views["race_week_overview"].empty


def test_spain_base_pole_uses_2025_catalunya_plus_robust_2026_season_delta() -> None:
    q_gaps = builder.qualifying_gap_frame(spain_qualifying_results_frame(), spain_race_frame())
    base_pole, season_delta, track_residual, method = builder.catalunya_base_pole_seconds(
        q_gaps,
        target_season=2026,
        target_scheduled_at=pd.Timestamp("2026-06-14T13:00:00Z", tz="UTC"),
    )
    assert round(season_delta, 3) == 1.8
    assert round(base_pole, 3) == 73.346
    assert track_residual == 0.0
    assert method.startswith("same_circuit_median_2026_vs_2025")


def test_spain_prediction_times_equal_base_plus_gap_and_skip_fake_rookie_history() -> None:
    prediction = builder.build_spain_qualifying_prediction(
        races=spain_race_frame(),
        qualifying_results=spain_qualifying_results_frame(),
        race_week_context=spain_active_race_frame(),
        driver_features=spain_driver_features_frame(),
        session_year_over_year_deltas=pd.DataFrame(),
        qualifying_driver_deltas=pd.DataFrame(),
    )

    assert not prediction.empty
    assert prediction["predicted_q_rank"].notna().all()
    assert prediction["predicted_q_gap_s"].ge(0).all()
    assert prediction["confidence_score"].between(0, 1).all()
    assert prediction["confidence_score"].max() <= 0.68
    assert set(prediction["prediction_mode"]) == {"baseline"}
    assert prediction["id"].is_unique
    for _, mode_rows in prediction.groupby("prediction_mode"):
        assert mode_rows.sort_values("predicted_q_rank")["predicted_q_gap_s"].is_monotonic_increasing
    assert round(prediction["season_delta_26_vs_25_s"].dropna().iloc[0], 3) == 1.8
    assert round(prediction["base_pole_s"].dropna().iloc[0], 3) == 73.346

    for row in prediction.to_dict("records"):
        assert round(row["base_pole_s"] + row["predicted_q_gap_s"], 3) == row["predicted_q_time_s"]

    rookie = prediction[(prediction["prediction_mode"] == "baseline") & (prediction["driver_id"] == "rookie")].iloc[0]
    assert pd.isna(rookie["same_circuit_gap_s"])
    assert pd.isna(rookie["driver_gap_delta_s"])
    assert "same_circuit_driver_gap_missing" in rookie["missing_flags"]
    assert "driver_delta_missing" in rookie["missing_flags"]
