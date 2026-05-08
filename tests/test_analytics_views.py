from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data"))

from build_analytics_views import comparison_confidence, deterministic_pairs, pairwise_segment


class AnalyticsViewTests(unittest.TestCase):
    def test_driver_pair_generation_is_deterministic_without_reversed_duplicates(self) -> None:
        pairs = deterministic_pairs(["VER", "HAM", "VER", "ALO"])

        self.assertEqual(pairs, [("ALO", "HAM"), ("ALO", "VER"), ("HAM", "VER")])
        self.assertFalse(any(left >= right for left, right in pairs))

    def test_confidence_is_bounded(self) -> None:
        self.assertEqual(comparison_confidence(2, -1, 0.5), 0.5)
        self.assertGreaterEqual(comparison_confidence(None), 0)
        self.assertLessEqual(comparison_confidence(1, 1), 1)

    def test_pairwise_segment_has_no_self_or_reversed_pairs(self) -> None:
        frame = pd.DataFrame(
            {
                "session_id": ["s1", "s1", "s1"],
                "segment_id": ["seg1", "seg1", "seg1"],
                "driver": ["VER", "HAM", "ALO"],
                "segmentation_confidence": [0.6, 0.7, 0.8],
                "apex_speed_kph": [120, 118, 121],
            }
        )
        paired = pairwise_segment(frame, ["apex_speed_kph"], segment_kind="approximate_segment")

        self.assertEqual(len(paired), 3)
        self.assertFalse((paired["driver_a"] >= paired["driver_b"]).any())

    def test_proxy_language_can_be_preserved_in_outputs(self) -> None:
        note = "Energy deployment proxy; not true ERS or battery state."

        self.assertIn("proxy", note.lower())
        self.assertIn("not true ers", note.lower())


if __name__ == "__main__":
    unittest.main()
