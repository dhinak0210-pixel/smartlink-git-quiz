# layer5-cheat/tests/test_tiers.py
import unittest
import pandas as pd
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from combine.tier_rules import assign_tiers
from combine.trust_score_mapping import map_tiers_to_trust_scores


class TestTiers(unittest.TestCase):

    def test_tier_prioritization(self):
        """Strong tier students must rank higher in review prioritization than Clear students."""
        pf_df = pd.DataFrame([
            {'student_anon': 101, 'min_p': 0.001, 'unexpected_hit': 22.0},
            {'student_anon': 102, 'min_p': 0.800, 'unexpected_hit': 2.0},
        ])
        timing_df = pd.DataFrame([
            {'student_anon': 101, 'n_fast_correct_hard': 4, 'n_slow_correct_tab': 0, 'misfit_z': 3.5},
            {'student_anon': 102, 'n_fast_correct_hard': 0, 'n_slow_correct_tab': 0, 'misfit_z': 0.5},
        ])
        thresholds = {
            'pf_min_p_strong': 0.01,
            'pf_min_p_review': 0.05,
            'rt_fast_hard_strong': 3.0,
            'rt_fast_hard_review': 2.0,
            'rt_misfit_z_strong': 3.2,
            'rt_misfit_z_review': 2.1,
            'pair_weighted_strong': 14.5,
            'pair_weighted_review': 9.0,
        }

        tiers = assign_tiers(pf_df, timing_df, pd.DataFrame(), pd.DataFrame(), pd.DataFrame(), thresholds)
        self.assertGreaterEqual(len(tiers), 2)

        s101 = tiers[tiers['student_anon'] == 101].iloc[0]
        s102 = tiers[tiers['student_anon'] == 102].iloc[0]

        self.assertEqual(s101['tier'], 'Strong')
        self.assertEqual(s102['tier'], 'Clear')
        self.assertLess(s101['rank_in_tier'], s102['rank_in_tier'], "Strong tier must appear earlier in review queue")

        # Trust score mapping check
        mapping = map_tiers_to_trust_scores(tiers)
        s101_map = mapping[mapping['student_anon'] == 101].iloc[0]
        self.assertEqual(s101_map['trust_score'], 30)
        self.assertEqual(s101_map['adjudication_status'], 'held')


if __name__ == '__main__':
    unittest.main()
