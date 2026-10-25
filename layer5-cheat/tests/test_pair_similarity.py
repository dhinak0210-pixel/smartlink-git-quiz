# layer5-cheat/tests/test_pair_similarity.py
import unittest
import pandas as pd
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from models.option_probabilities import estimate_option_probabilities
from detectors.pair_similarity import compute_pair_similarity


class TestPairSimilarity(unittest.TestCase):

    def test_shared_wrong_matching(self):
        """Two students who copy identical wrong options must have a high match score."""
        records = []
        # Student 1 and 2 share identical wrong options across 8 items
        for q in range(1, 16):
            records.append({
                'student_anon': 1,
                'variant_id': f'v_{q}',
                'template_id': f'q_{q}',
                'chosen_option_tag': 'opt_c',
                'is_correct': 0,
                'rt_ms': 5000,
            })
            records.append({
                'student_anon': 2,
                'variant_id': f'v_{q}',
                'template_id': f'q_{q}',
                'chosen_option_tag': 'opt_c',
                'is_correct': 0,
                'rt_ms': 5050,
            })
            # Student 3 has different wrong options
            records.append({
                'student_anon': 3,
                'variant_id': f'v_{q}',
                'template_id': f'q_{q}',
                'chosen_option_tag': f'opt_rnd_{q}',
                'is_correct': 0,
                'rt_ms': 6000,
            })

        df = pd.DataFrame(records)
        abils = {1: -0.5, 2: -0.5, 3: -0.5}
        opt_probs = estimate_option_probabilities(df, abils)
        pairs = compute_pair_similarity(df, abils, opt_probs)

        self.assertGreater(len(pairs), 0)
        # Pair (1, 2) must be the top ranked pair
        top_pair = pairs.iloc[0]
        pair_set = {top_pair['student_a'], top_pair['student_b']}
        self.assertEqual(pair_set, {1, 2}, "Copied pair must be highest ranked")
        self.assertGreaterEqual(top_pair['incorrect_matches'], 10)


if __name__ == '__main__':
    unittest.main()
