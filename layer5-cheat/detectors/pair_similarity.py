# layer5-cheat/detectors/pair_similarity.py
"""
Detector C: Wrong-Answer Similarity.

For each pair of students who saw the same variant on shared items:
1. Count incorrect matches (same wrong option)
2. Weight by rarity (ability-conditioned)
3. Check timing synchrony

Hard Rule #9: Direction is NEVER stated for pairs.
The method cannot determine who copied whom.

Usage:
    python pair_similarity.py
"""

import itertools
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import poisson

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from models.option_probabilities import estimate_option_probabilities


def compute_pair_similarity(
    responses_df: pd.DataFrame,
    irt_abilities: dict,
    option_probs: dict,
) -> pd.DataFrame:
    """
    Compute wrong-answer similarity for all student pairs.

    Only compares items where both students saw the SAME variant.

    Returns DataFrame with:
    student_a, student_b, n_shared_items, incorrect_matches,
    weighted_match_score, timing_sync_count, expected_matches, p_value
    """
    df = responses_df.copy()
    df['ability'] = df['student_anon'].map(irt_abilities).fillna(0.0)

    # Build per-student answer lookup: {student: {variant_id: (option_tag, is_correct, rt_ms)}}
    student_answers = {}
    for sid, group in df.groupby('student_anon'):
        answers = {}
        for _, row in group.iterrows():
            vid = row['variant_id']
            answers[vid] = {
                'option': row['chosen_option_tag'],
                'correct': row['is_correct'],
                'rt_ms': row.get('rt_ms', row.get('rt_bucket', 10) * 1000),
            }
        student_answers[sid] = answers

    students = list(student_answers.keys())
    results = []

    for i in range(len(students)):
        for j in range(i + 1, len(students)):
            sa = students[i]
            sb = students[j]

            answers_a = student_answers[sa]
            answers_b = student_answers[sb]

            shared_variants = set(answers_a.keys()) & set(answers_b.keys())

            if len(shared_variants) < config.PAIR_MIN_SHARED_ITEMS:
                continue

            incorrect_matches = 0
            weighted_score = 0.0
            timing_sync = 0
            expected_matches = 0.0

            for vid in shared_variants:
                a = answers_a[vid]
                b = answers_b[vid]

                # Only count wrong-answer matches
                if a['correct'] == 1 or b['correct'] == 1:
                    continue
                if a['option'] != b['option']:
                    continue

                incorrect_matches += 1

                ability_a = irt_abilities.get(sa, 0.0)
                ability_b = irt_abilities.get(sb, 0.0)
                avg_ability = (ability_a + ability_b) / 2.0

                band = min(int((avg_ability + 3.0) / 6.0 * config.PAIR_ABILITY_BANDS),
                           config.PAIR_ABILITY_BANDS - 1)
                band = max(band, 0)

                if vid in option_probs and band in option_probs[vid]:
                    p_option = option_probs[vid][band].get(a['option'], 0.1)
                else:
                    p_option = 0.1

                weight = -np.log(max(p_option, 0.01))
                weighted_score += weight
                expected_matches += (p_option ** 2)

                rt_diff = abs(a['rt_ms'] - b['rt_ms'])
                if rt_diff < config.PAIR_TIMING_SYNC_THRESHOLD_MS:
                    timing_sync += 1

            if incorrect_matches == 0:
                continue

            p_value = float(poisson.sf(incorrect_matches - 1, max(expected_matches, 0.01)))

            results.append({
                'student_a': sa,
                'student_b': sb,
                'n_shared_items': len(shared_variants),
                'incorrect_matches': incorrect_matches,
                'weighted_match_score': round(float(weighted_score), 4),
                'timing_sync_count': timing_sync,
                'expected_matches': round(float(expected_matches), 4),
                'p_value': round(float(p_value), 6),
            })

    result_df = pd.DataFrame(results)
    if len(result_df) > 0:
        result_df = result_df.sort_values('weighted_match_score', ascending=False)

    return result_df
