# layer5-cheat/tests/test_planted_cases.py
import unittest
import numpy as np
import pandas as pd
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from detectors.person_fit import run_person_fit_detector
from detectors.response_time import compute_timing_signals
from detectors.pair_similarity import compute_pair_similarity
from models.option_probabilities import estimate_option_probabilities
from combine.tier_rules import assign_tiers


class TestPlantedCases(unittest.TestCase):

    def test_planted_cheater_ranks_high(self):
        """Planted copier & pre-knowledge cheater must be in Strong/Review and rank at the top."""
        np.random.seed(42)
        records = []
        difficulties = {f'q{i+1}': float(i - 7) * 0.4 for i in range(15)}
        abilities = {s: 0.0 for s in range(1, 21)}

        # 18 honest students
        for s in range(1, 19):
            for q in range(1, 16):
                records.append({
                    'student_anon': s,
                    'variant_id': f'v_{q}',
                    'template_id': f'q{q}',
                    'chosen_option_tag': f'opt_{np.random.choice(["A", "B", "C", "D"])}',
                    'is_correct': int(np.random.rand() < 0.6),
                    'rt_ms': float(np.random.uniform(6000, 12000)),
                    'status': 'answered',
                })

        # Planted cheater 19: Pre-knowledge on hard items (answers in 1100ms correctly)
        for q in range(1, 16):
            is_hard = q > 10
            records.append({
                'student_anon': 19,
                'variant_id': f'v_{q}',
                'template_id': f'q{q}',
                'chosen_option_tag': 'opt_A',
                'is_correct': 1 if is_hard else 0, # misses easy, gets hard right
                'rt_ms': 1100.0 if is_hard else 9000.0,
                'status': 'answered',
            })

        # Planted cheater 20: Clones cheater 19's wrong answers identically
        for q in range(1, 16):
            is_hard = q > 10
            records.append({
                'student_anon': 20,
                'variant_id': f'v_{q}',
                'template_id': f'q{q}',
                'chosen_option_tag': 'opt_A',
                'is_correct': 1 if is_hard else 0,
                'rt_ms': 1150.0 if is_hard else 9050.0,
                'status': 'answered',
            })

        df = pd.DataFrame(records)

        # Run detectors
        pf = run_person_fit_detector(df, difficulties)
        timing = compute_timing_signals(df, pd.DataFrame(), difficulties, abilities)
        opt_probs = estimate_option_probabilities(df, abilities)
        pairs = compute_pair_similarity(df, abilities, opt_probs)

        thresholds = {
            'pf_min_p_strong': 0.05,
            'pf_min_p_review': 0.10,
            'rt_fast_hard_strong': 3.0,
            'rt_fast_hard_review': 2.0,
            'rt_misfit_z_strong': 3.2,
            'rt_misfit_z_review': 2.1,
            'pair_weighted_strong': 10.0,
            'pair_weighted_review': 6.0,
        }

        tiers = assign_tiers(pf, timing, pairs, pd.DataFrame(), pd.DataFrame(), thresholds)

        # Cheaters 19 and 20 must be flagged
        cheater_19 = tiers[tiers['student_anon'] == 19].iloc[0]
        cheater_20 = tiers[tiers['student_anon'] == 20].iloc[0]

        self.assertIn(cheater_19['tier'], ['Strong', 'Review'], "Planted pre-knowledge cheater must be flagged")
        self.assertIn(cheater_20['tier'], ['Strong', 'Review'], "Planted copier cheater must be flagged")

        # Top review candidates must include cheaters
        top_3_students = set(tiers.head(3)['student_anon'])
        self.assertTrue(19 in top_3_students or 20 in top_3_students,
                        "At least one planted cheater must rank in the top 3 review queue")


if __name__ == '__main__':
    unittest.main()
