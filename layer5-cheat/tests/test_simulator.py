# layer5-cheat/tests/test_simulator.py
import unittest
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from sim.honest_simulator import simulate_honest_class, compute_thresholds


class TestSimulator(unittest.TestCase):

    def test_simulate_honest_class_run(self):
        """Simulation must generate all detector maximum statistics."""
        diffs = {f'q{i+1}': float(i - 7) * 0.3 for i in range(15)}
        abils = {i+1: float(i - 10) * 0.1 for i in range(20)}
        variants = {(s, t): t for s in abils for t in diffs}
        rt_model = {
            'item_intensity': {t: 9.0 for t in diffs},
            'student_speed': {s: 0.0 for s in abils},
            'item_sigma': {t: 0.4 for t in diffs},
        }

        stats = simulate_honest_class(diffs, abils, variants, {}, rt_model, seed=42)
        self.assertIn('pf_min_p', stats)
        self.assertIn('rt_fast_hard', stats)
        self.assertIn('pair_weighted', stats)

    def test_compute_thresholds(self):
        """Quantiles must correctly yield strong and review thresholds."""
        stats_list = [
            {'pf_min_p': 0.02, 'rt_fast_hard': 2, 'pair_weighted': 8.5},
            {'pf_min_p': 0.05, 'rt_fast_hard': 1, 'pair_weighted': 6.0},
            {'pf_min_p': 0.01, 'rt_fast_hard': 3, 'pair_weighted': 12.0},
        ]
        thresh = compute_thresholds(stats_list)
        self.assertIn('pf_min_p_strong', thresh)
        self.assertIn('rt_fast_hard_strong', thresh)


if __name__ == '__main__':
    unittest.main()
