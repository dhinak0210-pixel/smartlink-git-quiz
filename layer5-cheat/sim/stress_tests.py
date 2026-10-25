# layer5-cheat/sim/stress_tests.py
"""
Stress tests for cheat detection pipeline:
1. Friend-group test: students who study together and share misconceptions
2. Misspecified model test: item discrimination variation
3. Network jitter: simulates packet drops causing delayed submission bursts
"""

import numpy as np
import pandas as pd
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from detectors.pair_similarity import compute_pair_similarity
from models.option_probabilities import estimate_option_probabilities


def simulate_study_group(
    honest_df: pd.DataFrame,
    group_students: list[int],
    shared_misconception_items: list[str],
    misconception_option: str = 'option_b',
) -> pd.DataFrame:
    """
    Simulate a legitimate group of friends who studied together and all fell for
    the same misconception on 2-3 specific tricky items.
    """
    df = honest_df.copy()
    for sid in group_students:
        for tid in shared_misconception_items:
            mask = (df['student_anon'] == sid) & (df['template_id'] == tid)
            df.loc[mask, 'is_correct'] = 0
            df.loc[mask, 'chosen_option_tag'] = misconception_option

    return df


def run_friend_group_stress_test(
    honest_df: pd.DataFrame,
    irt_abilities: dict,
    thresholds: dict,
) -> dict:
    """
    Assert that honest study groups sharing misconceptions do not trigger
    the 'Strong' collusion tier.
    """
    students = list(irt_abilities.keys())[:4]
    tricky_items = list(honest_df['template_id'].unique())[:2]

    stressed_df = simulate_study_group(honest_df, students, tricky_items)
    opt_probs = estimate_option_probabilities(stressed_df, irt_abilities)
    pairs = compute_pair_similarity(stressed_df, irt_abilities, opt_probs)

    strong_threshold = thresholds.get('pair_weighted_strong', 14.5)
    flagged_strong = pairs[pairs['weighted_match_score'] >= strong_threshold]

    # Verify that honest shared misconceptions on 2 items do not trigger false-positive Strong tier
    false_strong_count = len(flagged_strong)
    return {
        'test': 'friend_group_misconceptions',
        'passed': (false_strong_count == 0),
        'false_strong_flags': false_strong_count,
        'max_pair_score': float(pairs['weighted_match_score'].max()) if len(pairs) > 0 else 0.0,
        'strong_threshold': strong_threshold,
    }
