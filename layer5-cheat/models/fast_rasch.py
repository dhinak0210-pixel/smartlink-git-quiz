# layer5-cheat/models/fast_rasch.py
"""
Fast Rasch model fit for event-day calibration.
Uses Joint Maximum Likelihood Estimation (JMLE) with bias correction:
b_j* = b_j * (L - 1) / L
Runs in < 120 seconds for 200 students x 15 items.
"""

import time
import numpy as np
import pandas as pd
from scipy.special import expit

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def fit_fast_rasch(
    responses_df: pd.DataFrame,
    max_iter: int = 50,
    tol: float = 1e-4,
) -> dict:
    """
    Fit Rasch model (1PL) via JMLE with bias correction.

    Args:
        responses_df: DataFrame with [student_anon, template_id, is_correct]

    Returns:
        {
            'item_params': [{'template_id': tid, 'difficulty': b_j}],
            'person_params': [{'student_anon': sid, 'ability': theta_i}],
            'converged': bool,
            'duration_seconds': float,
        }
    """
    start_time = time.time()

    # Pivot to response matrix (students x items)
    matrix = responses_df.pivot(index='student_anon', columns='template_id', values='is_correct')
    students = matrix.index.tolist()
    items = matrix.columns.tolist()

    X = matrix.values.astype(float)
    n_students, n_items = X.shape

    # Initial estimates based on logit of proportions
    item_p = np.nanmean(X, axis=0)
    item_p = np.clip(item_p, 0.05, 0.95)
    b = -np.log(item_p / (1.0 - item_p))
    # Center item difficulties
    b -= np.mean(b)

    student_p = np.nanmean(X, axis=1)
    student_p = np.clip(student_p, 0.05, 0.95)
    theta = np.log(student_p / (1.0 - student_p))

    converged = False
    valid_mask = ~np.isnan(X)

    for it in range(max_iter):
        theta_prev = theta.copy()
        b_prev = b.copy()

        # Update theta for each student
        for i in range(n_students):
            row_mask = valid_mask[i, :]
            if not np.any(row_mask):
                continue
            r_i = X[i, row_mask]
            b_sub = b[row_mask]

            # Newton-Raphson update
            p_i = expit(theta[i] - b_sub)
            f_val = np.sum(r_i - p_i)
            f_prime = -np.sum(p_i * (1.0 - p_i))

            if abs(f_prime) > 1e-6:
                delta = f_val / f_prime
                theta[i] -= np.clip(delta, -1.0, 1.0)

        # Update b for each item
        for j in range(n_items):
            col_mask = valid_mask[:, j]
            if not np.any(col_mask):
                continue
            r_j = X[col_mask, j]
            theta_sub = theta[col_mask]

            p_j = expit(theta_sub - b[j])
            f_val = np.sum(r_j - p_j)
            f_prime = np.sum(p_j * (1.0 - p_j))

            if abs(f_prime) > 1e-6:
                delta = f_val / f_prime
                b[j] -= np.clip(delta, -1.0, 1.0)

        # Re-center b
        b -= np.mean(b)

        # Check convergence
        max_change = max(np.max(np.abs(theta - theta_prev)), np.max(np.abs(b - b_prev)))
        if max_change < tol:
            converged = True
            break

    # JMLE bias correction factor: (L - 1) / L where L = number of items
    bias_factor = (n_items - 1.0) / max(n_items, 1)
    b_corrected = b * bias_factor

    duration = time.time() - start_time

    item_params = [
        {'template_id': items[j], 'difficulty': float(round(b_corrected[j], 4))}
        for j in range(n_items)
    ]
    person_params = [
        {'student_anon': students[i], 'ability': float(round(theta[i], 4))}
        for i in range(n_students)
    ]

    return {
        'item_params': item_params,
        'person_params': person_params,
        'converged': converged,
        'iterations': it + 1,
        'duration_seconds': round(duration, 3),
        'bias_factor': round(bias_factor, 4),
    }
