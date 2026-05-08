from __future__ import annotations

import unittest
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))

from f1_insightx_data.telemetry_features import segment_profiles, telemetry_lap_summary
from build_strategy_lab_layers import build_track_archetype_table, telemetry_strategy_signals, track_archetype_from_features


class TelemetryFeatureTests(unittest.TestCase):
    def sample_trace(self) -> pd.DataFrame:
        times = list(range(100))
        distances = [idx * 130 for idx in times]
        speeds = [300, 305, 302, 292, 260, 210, 150, 105, 120, 170, 230, 275, 300, 306, 304, 290, 250, 190, 130, 98] * 5
        throttle = [100, 100, 100, 80, 20, 0, 0, 25, 65, 100, 100, 100, 100, 100, 100, 70, 10, 0, 25, 85] * 5
        brake = [False, False, False, True, True, True, False, False, False, False, False, False, False, False, False, True, True, True, False, False] * 5
        return pd.DataFrame(
            {
                "season": [2026] * 100,
                "round": [1] * 100,
                "race_name": ["Test Grand Prix"] * 100,
                "session_code": ["R"] * 100,
                "driver": ["AAA"] * 100,
                "lap_number": [4] * 100,
                "compound": ["MEDIUM"] * 100,
                "tyre_life": [3] * 100,
                "Time": pd.to_timedelta(times, unit="s"),
                "Distance": distances,
                "Speed": speeds,
                "RPM": [9000 + speed * 8 for speed in speeds],
                "nGear": [8 if speed > 260 else 6 if speed > 190 else 4 for speed in speeds],
                "Throttle": throttle,
                "Brake": brake,
                "DRS": [12 if speed > 285 else 0 for speed in speeds],
                "Source": ["car"] * 100,
            }
        )

    def test_telemetry_lap_summary_smoke(self) -> None:
        summary = telemetry_lap_summary(self.sample_trace())

        self.assertEqual(len(summary), 1)
        self.assertGreater(float(summary.iloc[0]["max_speed_kph"]), 300)
        self.assertIn("telemetry_quality_score", summary.columns)

    def test_energy_proxy_is_labelled_as_proxy_not_true_ers(self) -> None:
        profiles = segment_profiles(self.sample_trace())
        energy = profiles["energy"]

        self.assertFalse(energy.empty)
        self.assertTrue(energy["label"].str.contains("not true ERS", case=False).any())

    def test_strategy_signals_are_generated_and_bounded(self) -> None:
        trace = self.sample_trace()
        profiles = segment_profiles(trace)
        summary = telemetry_lap_summary(trace)
        signals = telemetry_strategy_signals(
            driver_code="AAA",
            season=2026,
            round_number=1,
            corner_speed=profiles["corner_speed"],
            corner_braking=profiles["corner_braking"],
            corner_throttle=profiles["corner_throttle"],
            straight_speed=profiles["straight_speed"],
            energy_proxy=profiles["energy"],
            lap_summary=summary,
            track_position_sensitivity=0.5,
            degradation_anchor=0.06,
        )

        self.assertIn("overtaking_attack_score", signals)
        for key, value in signals.items():
            if key.endswith("_score") or key.endswith("_strength") or key.endswith("_proxy") or key.endswith("_confidence") or key.endswith("_tendency"):
                self.assertGreaterEqual(float(value), 0.0)
                self.assertLessEqual(float(value), 1.0)

    def test_track_archetype_uses_feature_weights(self) -> None:
        trace = self.sample_trace()
        profiles = segment_profiles(trace)
        archetype = track_archetype_from_features(
            "Test Grand Prix",
            profiles["corner_speed"],
            profiles["corner_braking"],
            profiles["corner_throttle"],
            profiles["straight_speed"],
            pd.DataFrame({"event_name": ["Test Grand Prix"], "degradation_per_lap_s": [0.08]}),
        )

        self.assertIn(archetype["track_archetype"], {"power-sensitive", "traction-sensitive", "braking-heavy", "high-degradation", "track-position-dominant", "mixed"})
        self.assertGreaterEqual(float(archetype["archetype_confidence"]), 0.0)

    def test_archetype_table_has_multiple_bounded_contexts(self) -> None:
        trace = self.sample_trace()
        profiles = segment_profiles(trace)
        summary = telemetry_lap_summary(trace)
        second_speed = profiles["corner_speed"].copy()
        second_speed["event"] = "Power Grand Prix"
        second_speed["apex_speed_kph"] = second_speed["apex_speed_kph"] + 80
        second_straight = profiles["straight_speed"].copy()
        second_straight["event"] = "Power Grand Prix"
        second_straight["terminal_speed_kph"] = second_straight["terminal_speed_kph"] + 40
        second_summary = summary.copy()
        second_summary["event"] = "Power Grand Prix"
        second_summary["avg_speed_kph"] = second_summary["avg_speed_kph"] + 30

        table = build_track_archetype_table(
            pd.concat([profiles["corner_speed"], second_speed], ignore_index=True),
            profiles["corner_braking"],
            profiles["corner_throttle"],
            pd.concat([profiles["straight_speed"], second_straight], ignore_index=True),
            pd.concat([summary, second_summary], ignore_index=True),
            pd.DataFrame({"event_name": ["Test Grand Prix", "Power Grand Prix"], "degradation_per_lap_s": [0.08, 0.03]}),
        )

        self.assertGreater(len(table), 1)
        for column in ["straight_line_weight", "braking_weight", "traction_weight", "degradation_weight", "track_position_weight"]:
            self.assertTrue(((table[column] >= 0) & (table[column] <= 1)).all())
        self.assertGreater(table["track_archetype"].nunique(), 1)


if __name__ == "__main__":
    unittest.main()
