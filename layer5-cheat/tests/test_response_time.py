# layer5-cheat/tests/test_response_time.py
import unittest
import numpy as np
import pandas as pd
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from models.response_time_model import fit_response_time_model
from detectors.response_time import compute_timing_signals


class TestResponseTime(unittest.TestCase):

    def test_lognormal_model_fit(self):
        """Verify that lognormal RT model calculates residuals correctly."""
        records = []
        for s in range(1, 21):
            for q in range(1, 16):
                # Faster students have lower base time
                base_time = 5000 if s <= 5 else 9000
                rt = base_time + np.random.normal(0, 500)
                records.append({
                    'student_anon': s,
                    'variant_id': f'v_{q}',
                    'template_id': f'q_{q}',
                    'rt_ms': max(1000, rt),
                    'is_correct': 1 if s <= 5 else 0,
                })

        df = pd.DataFrame(records)
        model = fit_response_time_model(df)

        self.assertIn('residuals', model)
        self.assertGreater(len(model['residuals']), 0)
        self.assertIn('standardized', model['residuals'].columns)

    def test_fast_correct_hard_signal(self):
        """A student answering hard questions in < 1500ms must be flagged with fast-correct signals."""
        records = []
        # Add normal baseline cohort students
        for s in range(1, 15):
            for q in range(1, 16):
                records.append({
                    'student_anon': s,
                    'variant_id': f'v_{q}',
                    'template_id': f'q_{q}',
                    'rt_ms': 8000.0 + np.random.normal(0, 300),
                    'is_correct': 1 if q <= 10 else 0,
                })
        # Add anomalous student 999 answering hard questions in 1200ms
        for q in range(1, 16):
            records.append({
                'student_anon': 999,
                'variant_id': f'v_{q}',
                'template_id': f'q_{q}',
                'rt_ms': 1200.0 if q > 10 else 8000.0,
                'is_correct': 1,
            })
        df = pd.DataFrame(records)
        diffs = {f'q_{q}': (2.0 if q > 10 else -1.0) for q in range(1, 16)}
        abils = {s: 0.0 for s in range(1, 15)}
        abils[999] = -0.5

        signals = compute_timing_signals(df, pd.DataFrame(), diffs, abils)
        self.assertGreater(len(signals), 0)
        student_sig = signals[signals['student_anon'] == 999].iloc[0]
        self.assertGreaterEqual(student_sig['n_fast_correct_hard'], 1)


if __name__ == '__main__':
    unittest.main()
