# layer5-analysis/scripts/evaluation.py
"""
Shared evaluation utilities. Enforces the rules:
- Student-level splits (never answer-level)
- Baselines for every model
- Cross-validation with confidence intervals
- Fixed random seeds
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from scipy import stats

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def student_level_split(answers_df: pd.DataFrame, test_fraction: float = None):
    """
    Split data by student, not by answer.
    Returns train and test DataFrames where no student appears in both.
    """
    test_fraction = test_fraction or config.TEST_FRACTION
    np.random.seed(config.RANDOM_SEED)

    student_ids = answers_df['anon_student_id'].unique()
    np.random.shuffle(student_ids)

    n_test = max(1, int(len(student_ids) * test_fraction))
    test_students = set(student_ids[:n_test])

    train = answers_df[~answers_df['anon_student_id'].isin(test_students)].copy()
    test = answers_df[answers_df['anon_student_id'].isin(test_students)].copy()

    print(f"  Student-level split: {len(train['anon_student_id'].unique())} train, "
          f"{len(test['anon_student_id'].unique())} test students")
    print(f"  Answers: {len(train)} train, {len(test)} test")

    train_students = set(train['anon_student_id'].unique())
    test_students_set = set(test['anon_student_id'].unique())
    assert len(train_students & test_students_set) == 0, "LEAKAGE: students in both splits!"

    return train, test


def student_level_cv(df: pd.DataFrame, n_folds: int = None, group_col: str = 'anon_student_id'):
    """
    Cross-validation that keeps all of a student's rows in the same fold.
    Uses GroupKFold with anon_student_id as the group.
    """
    n_folds = n_folds or config.CV_FOLDS
    gkf = GroupKFold(n_splits=n_folds)
    groups = df[group_col].values

    for fold, (train_idx, test_idx) in enumerate(gkf.split(df, groups=groups)):
        yield fold, df.iloc[train_idx].copy(), df.iloc[test_idx].copy()


def compute_baseline_accuracy(train_df: pd.DataFrame, test_df: pd.DataFrame) -> float:
    """
    Baseline: predict each student's correctness using the majority class.
    """
    overall_mean = train_df['is_correct'].mean()
    predicted = int(overall_mean >= 0.5)
    actual = test_df['is_correct'].astype(int)
    return float((actual == predicted).mean())


def compute_baseline_mae(train_scores: pd.Series, test_scores: pd.Series) -> float:
    """Baseline MAE: predict the mean training score for every test student."""
    mean_score = train_scores.mean()
    return float(np.abs(test_scores - mean_score).mean())


def confidence_interval(scores: list[float], confidence: float = 0.95) -> tuple[float, float, float]:
    """Compute mean and confidence interval from cross-validation scores."""
    n = len(scores)
    mean = float(np.mean(scores))
    if n < 2:
        return mean, mean, mean
    se = float(stats.sem(scores))
    ci = stats.t.interval(confidence, n - 1, loc=mean, scale=se)
    return mean, float(ci[0]), float(ci[1])


def report_model_comparison(results: dict[str, dict]):
    """
    Print a comparison table of models vs baselines.
    """
    print(f"\n{'Model':<30} {'Metric':>10} {'95% CI':>20} {'Baseline':>10} {'Δ':>10}")
    print("-" * 85)
    for name, r in results.items():
        metric = r.get('metric', 0)
        ci = f"[{r.get('ci_low', 0):.3f}, {r.get('ci_high', 0):.3f}]"
        baseline = r.get('baseline', 0)
        delta = metric - baseline
        delta_str = f"+{delta:.3f}" if delta >= 0 else f"{delta:.3f}"
        print(f"{name:<30} {metric:>10.4f} {ci:>20} {baseline:>10.4f} {delta_str:>10}")
