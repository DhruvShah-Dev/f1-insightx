from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

from data.build_pit_wall_picks import build_race_pit_stop_results, stable_random_positions


class PitWallPicksDataTests(unittest.TestCase):
    def test_stable_random_positions_are_unique_and_outside_top_three(self) -> None:
        first = stable_random_positions("2026_01_bahrain")
        second = stable_random_positions("2026_01_bahrain")

        self.assertEqual(first, second)
        self.assertEqual(len(set(first)), 3)
        self.assertTrue(all(4 <= position <= 20 for position in first))

    def test_build_race_pit_stop_results_selects_fastest_valid_duration(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            curated_dir = root / "curated"
            staged_openf1_dir = root / "staged" / "openf1"
            curated_dir.mkdir(parents=True)
            pit_dir = staged_openf1_dir / "2026" / "1" / "100_R"
            pit_dir.mkdir(parents=True)

            pd.DataFrame(
                [
                    {
                        "id": "2026_01_bahrain",
                        "season": 2026,
                        "round": 1,
                        "race_name": "Bahrain Grand Prix",
                        "scheduled_at": "2026-03-08T15:00:00+00:00",
                    }
                ]
            ).to_csv(curated_dir / "races.csv", index=False)
            pd.DataFrame(
                [
                    {"id": "norris", "driver_code": "NOR", "permanent_number": 4, "full_name": "Lando Norris"},
                    {"id": "piastri", "driver_code": "PIA", "permanent_number": 81, "full_name": "Oscar Piastri"},
                ]
            ).to_csv(curated_dir / "drivers.csv", index=False)
            pd.DataFrame(
                [
                    {"driver_number": 4, "duration": 2.71},
                    {"driver_number": 81, "duration": 2.31},
                    {"driver_number": 4, "duration": ""},
                ]
            ).to_csv(pit_dir / "pit.csv", index=False)

            settings = SimpleNamespace(curated_dir=curated_dir, staged_openf1_dir=staged_openf1_dir)
            result = build_race_pit_stop_results(settings)

        self.assertEqual(
            result.to_dict("records"),
            [
                {
                    "race_id": "2026_01_bahrain",
                    "season": 2026,
                    "round": 1,
                    "driver_id": "piastri",
                    "pit_duration_s": 2.31,
                    "source_label": "openf1_pit_v1",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
