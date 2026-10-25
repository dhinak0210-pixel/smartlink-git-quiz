# layer5-cheat/detectors/person_fit.py
"""
Detector A: Person-Fit — Unexpected Correct Answers.

Uses Rasch difficulties from the clean IRT pass to identify students
who got an unusual set of hard questions right while missing easier ones.

Statistics:
1. Unexpected-hit score: sum of surprise over correct answers
2. Guttman error index: hard-right/easy-wrong inversions
3. Hard-minus-easy gap: accuracy difference between hardest and easiest thirds

P-values by simulation (not asymptotic formulas).
Only the "too good" tail is flagged.

Usage:
    python person_fit.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import expit

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def compute_person_fit_statistics(
    student_responses: pd.DataFrame,
    difficulties: dict,
) -> dict:
    """
    Compute person-fit statistics for a single student.

    Args:
        student_responses: DataFrame with columns [template_id, is_correct]
        difficulties: {template_id: difficulty_logit}

    Returns:
        Dict with unexpected_hit, guttman_errors, hard_easy_gap, n_items, raw_score
    """
    valid = student_responses[student_responses['template_id'].isin(difficulties)].copy()
    if len(valid) < config.MIN_RESPONSES_FOR_PERSON_FIT:
        return None

    # Sort by difficulty (easiest first)
    valid['difficulty'] = valid['template_id'].map(difficulties)
    valid = valid.sort_values('difficulty')

    n = len(valid)
    raw_score = int(valid['is_correct'].sum())
    correct = valid['is_correct'].values
    diffs = valid['difficulty'].values

    # --- Statistic 1: Unexpected-hit score ---
    ability_est = float(np.log(max(raw_score, 0.5) / max(n - raw_score, 0.5)))

    unexpected_hit = 0.0
    for i in range(n):
        if correct[i] == 1:
            p = float(expit(ability_est - diffs[i]))
            surprise = -np.log(max(p, 1e-10))
            unexpected_hit += surprise * max(diffs[i], 0.0)

    # --- Statistic 2: Guttman error index ---
    guttman_errors = 0
    max_possible = 0
    for i in range(n):
        for j in range(i + 1, n):
            if diffs[j] > diffs[i]:
                max_possible += 1
                if correct[j] == 1 and correct[i] == 0:
                    guttman_errors += 1

    guttman_index = guttman_errors / max(max_possible, 1)

    # --- Statistic 3: Hard-minus-easy gap ---
    n_third = max(1, n // 3)
    easy_items = valid.head(n_third)
    hard_items = valid.tail(n_third)

    easy_acc = easy_items['is_correct'].mean() if len(easy_items) > 0 else 0
    hard_acc = hard_items['is_correct'].mean() if len(hard_items) > 0 else 0
    hard_easy_gap = hard_acc - easy_acc

    return {
        'unexpected_hit': round(float(unexpected_hit), 4),
        'guttman_errors': int(guttman_errors),
        'guttman_index': round(float(guttman_index), 4),
        'hard_easy_gap': round(float(hard_easy_gap), 4),
        'n_items': n,
        'raw_score': raw_score,
        'ability_estimate': round(float(ability_est), 4),
    }


def simulate_person_fit_null(
    n_items: int,
    raw_score: int,
    difficulties: np.ndarray,
    n_sim: int = None,
    seed: int = None,
) -> dict:
    """
    Simulate the null distribution of person-fit statistics
    conditional on the raw score and the items answered.

    Uses the Rasch model: P(correct_i) = logistic(ability - difficulty_i)
    Conditional on the total score.
    """
    n_sim = n_sim or config.PERSON_FIT_N_SIM
    rng = np.random.RandomState(seed or config.RANDOM_SEED)

    if raw_score <= 0 or raw_score >= n_items:
        return {
            'sim_unexpected': np.zeros(10),
            'sim_guttman': np.zeros(10),
            'sim_gap': np.zeros(10)
        }

    ability = np.log(raw_score / (n_items - raw_score))
    probs = expit(ability - difficulties)

    sim_unexpected = []
    sim_guttman = []
    sim_gap = []

    n_accepted = 0
    n_third = max(1, n_items // 3)
    max_attempts = 50
    attempts = 0

    # Precompute weights and indices outside loops
    item_weights = -np.log(np.maximum(probs, 1e-10)) * np.maximum(difficulties, 0.0)
    sorted_idx = np.argsort(difficulties)
    easy_idx = sorted_idx[:n_third]
    hard_idx = sorted_idx[-n_third:]

    # Precompute pairs for Guttman errors: j is harder than i, and j > i
    guttman_pairs = [
        (i, j) for i in range(n_items) for j in range(i + 1, n_items)
        if difficulties[j] > difficulties[i]
    ]

    while n_accepted < n_sim and attempts < max_attempts:
        attempts += 1
        batch_size = min(10000, max(500, (n_sim - n_accepted) * 15))
        patterns = (rng.random((batch_size, n_items)) < probs).astype(int)
        scores = patterns.sum(axis=1)

        mask = scores == raw_score
        matching = patterns[mask]

        if len(matching) == 0:
            continue

        # Vectorized batch processing
        needed = n_sim - n_accepted
        if len(matching) > needed:
            matching = matching[:needed]

        # 1. Unexpected hit score
        uh_batch = np.dot(matching, item_weights)
        sim_unexpected.extend(uh_batch.tolist())

        # 2. Guttman errors
        if guttman_pairs:
            ge_batch = np.zeros(len(matching), dtype=int)
            for i, j in guttman_pairs:
                ge_batch += (matching[:, j] == 1) & (matching[:, i] == 0)
            sim_guttman.extend(ge_batch.tolist())
        else:
            sim_guttman.extend([0] * len(matching))

        # 3. Hard-easy gap
        gap_batch = matching[:, hard_idx].mean(axis=1) - matching[:, easy_idx].mean(axis=1)
        sim_gap.extend(gap_batch.tolist())

        n_accepted += len(matching)

    # If rejection sampling yielded few results, fallback to permutation
    if len(sim_unexpected) < 10:
        base_pattern = np.zeros(n_items, dtype=int)
        base_pattern[:raw_score] = 1
        perm_patterns = np.array([rng.permutation(base_pattern) for _ in range(n_sim)])
        uh_batch = np.dot(perm_patterns, item_weights)
        sim_unexpected = uh_batch.tolist()

        if guttman_pairs:
            ge_batch = np.zeros(n_sim, dtype=int)
            for i, j in guttman_pairs:
                ge_batch += (perm_patterns[:, j] == 1) & (perm_patterns[:, i] == 0)
            sim_guttman = ge_batch.tolist()
        else:
            sim_guttman = [0] * n_sim

        gap_batch = perm_patterns[:, hard_idx].mean(axis=1) - perm_patterns[:, easy_idx].mean(axis=1)
        sim_gap = gap_batch.tolist()

    return {
        'sim_unexpected': np.array(sim_unexpected),
        'sim_guttman': np.array(sim_guttman),
        'sim_gap': np.array(sim_gap),
    }


def compute_p_value(observed: float, null_distribution: np.ndarray,
                     direction: str = 'upper') -> float:
    """
    Compute a one-sided p-value from a simulated null distribution.
    Only the upper tail is cheat-relevant ("too good").
    """
    if len(null_distribution) == 0:
        return 1.0
    if direction == 'upper':
        return float(np.mean(null_distribution >= observed))
    else:
        return float(np.mean(null_distribution <= observed))


def run_person_fit_detector(
    pf_df: pd.DataFrame,
    difficulties: dict,
) -> pd.DataFrame:
    """
    Run the person-fit detector on all students.

    Returns DataFrame with columns:
    student_anon, unexpected_hit, guttman_index, hard_easy_gap,
    p_unexpected, p_guttman, p_gap, min_p, raw_score, n_items
    """
    results = []

    for sid, group in pf_df.groupby('student_anon'):
        stats = compute_person_fit_statistics(group, difficulties)
        if stats is None:
            continue

        answered_templates = group['template_id'].values
        answered_diffs = np.array([difficulties.get(t, 0.0) for t in answered_templates])

        null = simulate_person_fit_null(
            n_items=stats['n_items'],
            raw_score=stats['raw_score'],
            difficulties=answered_diffs,
            n_sim=config.PERSON_FIT_N_SIM,
            seed=int(config.RANDOM_SEED + sid) if isinstance(sid, (int, np.integer)) else config.RANDOM_SEED,
        )

        p_unexpected = compute_p_value(stats['unexpected_hit'], null['sim_unexpected'], 'upper')
        p_guttman = compute_p_value(stats['guttman_errors'], null['sim_guttman'], 'upper')
        p_gap = compute_p_value(stats['hard_easy_gap'], null['sim_gap'], 'upper')

        min_p = min(p_unexpected, p_guttman, p_gap)

        results.append({
            'student_anon': sid,
            'unexpected_hit': stats['unexpected_hit'],
            'guttman_index': stats['guttman_index'],
            'hard_easy_gap': stats['hard_easy_gap'],
            'p_unexpected': round(p_unexpected, 4),
            'p_guttman': round(p_guttman, 4),
            'p_gap': round(p_gap, 4),
            'min_p': round(min_p, 4),
            'raw_score': stats['raw_score'],
            'n_items': stats['n_items'],
        })

    result_df = pd.DataFrame(results)
    if len(result_df) > 0:
        result_df = result_df.sort_values('min_p')

    return result_df


def person_fit_power_note(result_df: pd.DataFrame) -> str:
    """Generate a power note for the report."""
    if len(result_df) == 0:
        return "No students had sufficient data for person-fit analysis."

    scores = result_df['raw_score'].values
    n = len(scores)
    low = int(np.sum(scores <= 3))
    high = int(np.sum(scores >= 13))
    mid = n - low - high

    return (
        f"Person-fit power note: {low}/{n} students scored ≤3 (low power), "
        f"{high}/{n} scored ≥13 (low power), {mid}/{n} in mid-range (best power). "
        f"Person-fit has almost no power for very low or very high scores. "
        f"A non-flag does not mean the pattern is normal — it means the test "
        f"cannot detect inconsistency with only {config.N_QUESTIONS} items."
    )
