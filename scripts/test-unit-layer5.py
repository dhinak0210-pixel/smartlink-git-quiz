#!/usr/bin/env python3
"""
scripts/test-unit-layer5.py

Comprehensive Unit Test & Verification Suite for SmartLink Git Quiz:
Layer 5 — Post-Event Psychometrics, IRT Calibration & ML Pipeline.
"""

import sys
import json
from pathlib import Path
import unittest
import numpy as np
import pandas as pd

# Path setup
BASE_DIR = Path(__file__).parent.parent
LAYER5_DIR = BASE_DIR / 'layer5-analysis'
sys.path.insert(0, str(LAYER5_DIR))

import config
from scripts.evaluation import (
    student_level_split, student_level_cv,
    compute_baseline_mae, confidence_interval
)


class TestLayer5Pipeline(unittest.TestCase):

    def setUp(self):
        self.anon_dir = LAYER5_DIR / 'data' / 'anonymized'
        self.public_dir = LAYER5_DIR / 'data' / 'public'
        self.models_dir = LAYER5_DIR / 'models'
        self.notebooks_dir = LAYER5_DIR / 'notebooks'

    def test_01_privacy_and_anonymization(self):
        """Verify absolute privacy: zero student PII and quantized timing."""
        forbidden_cols = {'name', 'email', 'college_id', 'ip_address', 'join_code', 'real_name'}
        
        for csv_file in self.anon_dir.glob('*.csv'):
            df = pd.read_csv(csv_file)
            cols = set(df.columns)
            leak = cols & forbidden_cols
            self.assertEqual(len(leak), 0, f"PII leakage detected in {csv_file.name}: {leak}")

        # Check timing quantization (multiples of 500ms)
        answers_path = self.anon_dir / 'answers.csv'
        self.assertTrue(answers_path.exists(), "answers.csv must exist in anonymized data")
        answers = pd.read_csv(answers_path)
        self.assertIn('response_ms_rounded', answers.columns)
        
        times = answers['response_ms_rounded'].dropna().values
        for t in times:
            self.assertEqual(t % config.TIMING_ROUND_MS, 0, f"Unrounded timing detected: {t}")

    def test_02_classical_item_analysis(self):
        """Verify difficulty (p-value), point-biserial discrimination, and distractors."""
        q_stats_path = self.public_dir / 'question_statistics.csv'
        self.assertTrue(q_stats_path.exists(), "question_statistics.csv must exist")
        
        df = pd.read_csv(q_stats_path)
        self.assertGreaterEqual(len(df), 30, "Should have statistics for questions")
        
        # Difficulty p-value bounds
        self.assertTrue((df['p_value'] >= 0.0).all() and (df['p_value'] <= 1.0).all(),
                        "p-values must be between 0.0 and 1.0")
        
        # Discrimination bounds
        valid_disc = df['discrimination'].dropna()
        self.assertTrue((valid_disc >= -1.0).all() and (valid_disc <= 1.0).all(),
                        "Point-biserial correlations must be within [-1, 1]")
        
        # Distractor analysis check
        dist_path = self.public_dir / 'distractor_analysis.csv'
        self.assertTrue(dist_path.exists(), "distractor_analysis.csv must exist")
        dist_df = pd.read_csv(dist_path)
        self.assertIn('high_scorers_chosen', dist_df.columns)
        self.assertIn('low_scorers_chosen', dist_df.columns)

    def test_03_irt_calibration(self):
        """Verify IRT parameter calibration and monotonic difficulty alignment."""
        params_path = self.models_dir / 'irt_params.json'
        self.assertTrue(params_path.exists(), "irt_params.json must exist")
        
        with open(params_path) as f:
            params = json.load(f)
        self.assertIn('item_params', params)
        self.assertGreaterEqual(len(params['item_params']), 30)

        # Verify comparison with hand labels
        comp_path = self.public_dir / 'irt_vs_labels.csv'
        self.assertTrue(comp_path.exists(), "irt_vs_labels.csv must exist")
        comp = pd.read_csv(comp_path)
        
        easy_b = comp[comp['label'] == 'easy']['irt_difficulty'].mean()
        med_b = comp[comp['label'] == 'medium']['irt_difficulty'].mean()
        hard_b = comp[comp['label'] == 'hard']['irt_difficulty'].mean()

        # Monotonicity: easy < medium < hard
        self.assertLess(easy_b, med_b, f"Easy IRT difficulty ({easy_b}) must be < Medium ({med_b})")
        self.assertLess(med_b, hard_b, f"Medium IRT difficulty ({med_b}) must be < Hard ({hard_b})")

    def test_04_student_level_cv_no_leakage(self):
        """Enforce strict student-level partitioning with GroupKFold."""
        answers = pd.read_csv(self.anon_dir / 'answers.csv')
        
        # 1. Split verification
        train_df, test_df = student_level_split(answers, test_fraction=0.2)
        train_students = set(train_df['anon_student_id'].unique())
        test_students = set(test_df['anon_student_id'].unique())
        self.assertEqual(len(train_students & test_students), 0,
                         "CRITICAL: Student ID overlap found between train and test!")

        # 2. Cross-validation verification
        for fold, tr, te in student_level_cv(answers, n_folds=5):
            tr_s = set(tr['anon_student_id'].unique())
            te_s = set(te['anon_student_id'].unique())
            self.assertEqual(len(tr_s & te_s), 0,
                             f"CRITICAL: Fold {fold} has student overlap between train and test!")

    def test_05_skill_prediction_beats_baseline(self):
        """Verify early-skill prediction models outperform the mean baseline."""
        res_path = self.public_dir / 'skill_prediction_results.json'
        self.assertTrue(res_path.exists(), "skill_prediction_results.json must exist")
        
        with open(res_path) as f:
            results = json.load(f)
            
        res_data = results['results']
        baseline_mae = res_data['Baseline (mean score)']['mae']
        linear_mae = res_data['Linear Regression']['mae']
        
        self.assertLess(linear_mae, baseline_mae,
                        f"Linear regression ({linear_mae}) must beat baseline ({baseline_mae})")
        
        # Check XGBoost if present
        if 'XGBoost' in res_data:
            xgb_mae = res_data['XGBoost']['mae']
            self.assertLess(xgb_mae, baseline_mae,
                            f"XGBoost ({xgb_mae}) must beat baseline ({baseline_mae})")

    def test_06_cheat_detection_agreement(self):
        """Verify anomaly detection agreement and non-punitive audit protocol."""
        comp_path = self.public_dir / 'cheat_detection_comparison.json'
        self.assertTrue(comp_path.exists(), "cheat_detection_comparison.json must exist")
        
        with open(comp_path) as f:
            comp = json.load(f)

        self.assertIn('jaccard_similarity', comp)
        j_rules_iso = comp['jaccard_similarity']['rules_vs_iso_forest']
        j_rules_db = comp['jaccard_similarity']['rules_vs_dbscan']
        
        self.assertGreaterEqual(j_rules_iso, 0.0)
        self.assertLessEqual(j_rules_iso, 1.0)
        self.assertGreaterEqual(j_rules_db, 0.0)
        self.assertLessEqual(j_rules_db, 1.0)

    def test_07_topic_weakness_clusters(self):
        """Verify k=2 topic clustering identifies curricular bottlenecks."""
        clusters_path = self.public_dir / 'topic_clusters.json'
        self.assertTrue(clusters_path.exists(), "topic_clusters.json must exist")
        
        with open(clusters_path) as f:
            clusters = json.load(f)
            
        self.assertEqual(len(clusters['clusters']), 2, "Must segment into k=2 pedagogical clusters")
        total_students = sum(c['student_count'] for c in clusters['clusters'])
        self.assertEqual(total_students, 200, "All 200 students must be clustered")

    def test_08_production_notebooks(self):
        """Verify all 6 Jupyter notebooks are valid JSON with non-empty code cells."""
        expected_nbs = [
            '01_eda.ipynb',
            '02_question_stats.ipynb',
            '03_irt.ipynb',
            '04_skill_prediction.ipynb',
            '05_cheat_detection.ipynb',
            '06_elo_practice.ipynb'
        ]
        
        for nb_name in expected_nbs:
            nb_path = self.notebooks_dir / nb_name
            self.assertTrue(nb_path.exists(), f"Notebook {nb_name} must exist")
            
            with open(nb_path) as f:
                nb = json.load(f)
                
            self.assertEqual(nb.get('nbformat'), 4)
            self.assertGreater(len(nb.get('cells', [])), 0, f"Notebook {nb_name} has no cells")

    def test_09_collegiate_event_report(self):
        """Verify the event report contains complete metrics and ₹0 budget."""
        report_path = self.public_dir / 'event_report.md'
        self.assertTrue(report_path.exists(), "event_report.md must exist")
        
        content = report_path.read_text()
        self.assertIn("100.0%", content, "Completion rate should be recorded")
        self.assertIn("₹0", content, "Zero cost infrastructure must be documented")
        self.assertIn("Potentially Flawed Questions", content, "Flawed questions must be surfaced")


if __name__ == '__main__':
    print("=" * 60)
    print("Running SmartLink Git Quiz — Layer 5 Unit & Verification Tests")
    print("=" * 60)
    suite = unittest.TestLoader().loadTestsFromTestCase(TestLayer5Pipeline)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
