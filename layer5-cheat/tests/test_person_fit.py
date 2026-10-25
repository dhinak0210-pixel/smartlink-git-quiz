# layer5-cheat/tests/test_person_fit.py
import unittest
import numpy as np
import pandas as pd
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from detectors.person_fit import (
    compute_person_fit_statistics,
    simulate_person_fit_null,
    compute_p_value,
)


class TestPersonFit(unittest.TestCase):

    def setUp(self):
        self.difficulties = {f'q{i+1}': float(i - 7) * 0.4 for i in range(15)}

    def test_unexpected_correct_detection(self):
        """A student who misses all easy items but gets all hard items right must have high Guttman error."""
        # 15 items: items 1..5 easy, 6..10 medium, 11..15 hard
        # Honest student: gets easy right, hard wrong
        honest_resp = pd.DataFrame({
            'template_id': [f'q{i+1}' for i in range(15)],
            'is_correct': [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        })
        honest_stats = compute_person_fit_statistics(honest_resp, self.difficulties)

        # Inverted student: misses easy, gets hard right
        inverted_resp = pd.DataFrame({
            'template_id': [f'q{i+1}' for i in range(15)],
            'is_correct': [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
        })
        inverted_stats = compute_person_fit_statistics(inverted_resp, self.difficulties)

        self.assertGreater(inverted_stats['guttman_errors'], honest_stats['guttman_errors'],
                           "Inverted student must have significantly more Guttman errors")
        self.assertGreater(inverted_stats['unexpected_hit'], honest_stats['unexpected_hit'],
                           "Inverted student must have higher unexpected hit score")

    def test_null_simulation_validity(self):
        """Simulated null must produce valid empirical arrays."""
        diffs = np.array([self.difficulties[f'q{i+1}'] for i in range(15)])
        null = simulate_person_fit_null(n_items=15, raw_score=8, difficulties=diffs, n_sim=100)
        self.assertGreater(len(null['sim_unexpected']), 0)
        self.assertGreater(len(null['sim_guttman']), 0)


if __name__ == '__main__':
    unittest.main()
