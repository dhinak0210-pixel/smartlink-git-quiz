# layer5-cheat/models/response_time_model.py
"""
Lognormal response-time model.

log(RT_ij) = λ_j - τ_i + ε_ij

Where:
  λ_j = time intensity of item j (per variant, shrunk toward template mean)
  τ_i = speed of student i (robust estimate)
  ε_ij ~ N(0, σ²_j)

Estimated via iterated least squares (fast enough for event day).
"""

import numpy as np
import pandas as pd

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def fit_response_time_model(rt_df: pd.DataFrame) -> dict:
    """
    Fit the lognormal RT model.

    Args:
        rt_df: DataFrame with columns [student_anon, variant_id, template_id, rt_ms]

    Returns:
        {
            'item_intensity': {variant_id: lambda_j},
            'student_speed': {student_anon: tau_i},
            'item_sigma': {variant_id: sigma_j},
            'residuals': DataFrame with [student_anon, variant_id, template_id, rt_ms, residual, standardized],
        }
    """
    df = rt_df[rt_df['rt_ms'] > config.RT_MIN_MS].copy()

    if len(df) == 0:
        return {'item_intensity': {}, 'student_speed': {}, 'item_sigma': {}, 'residuals': pd.DataFrame()}

    # Log-transform
    df['log_rt'] = np.log(df['rt_ms'])

    # --- Iterative estimation ---
    item_intensity = df.groupby('variant_id')['log_rt'].mean().to_dict()
    student_speed = {}

    for iteration in range(5):  # 5 iterations is enough for convergence
        df['item_lambda'] = df['variant_id'].map(item_intensity)
        df['raw_residual'] = df['log_rt'] - df['item_lambda']

        # Student speed = negative median residual (faster student = lower RT = higher speed)
        student_speed = (-df.groupby('student_anon')['raw_residual'].median()).to_dict()

        # Re-estimate item intensity with student speed removed
        df['tau'] = df['student_anon'].map(student_speed).fillna(0)
        df['adjusted_log_rt'] = df['log_rt'] + df['tau']
        item_intensity = df.groupby('variant_id')['adjusted_log_rt'].mean().to_dict()

    # --- Shrink variant intensities toward template mean ---
    variant_to_template = df[['variant_id', 'template_id']].drop_duplicates().set_index('variant_id')['template_id']
    template_means = {}
    for tid, group in df.groupby('template_id'):
        template_means[tid] = group['adjusted_log_rt'].mean()

    shrinkage = 0.3  # Shrink 30% toward template mean
    for vid in item_intensity:
        tid = variant_to_template.get(vid)
        if tid and tid in template_means:
            item_intensity[vid] = (1 - shrinkage) * item_intensity[vid] + shrinkage * template_means[tid]

    # --- Compute final residuals ---
    df['item_lambda'] = df['variant_id'].map(item_intensity)
    df['tau'] = df['student_anon'].map(student_speed).fillna(0)
    df['residual'] = df['log_rt'] - df['item_lambda'] + df['tau']

    # Item-level standard deviations
    item_sigma = df.groupby('variant_id')['residual'].std().to_dict()
    global_sigma = df['residual'].std() if len(df) > 1 else 0.4
    if np.isnan(global_sigma) or global_sigma == 0:
        global_sigma = 0.4

    for vid in item_intensity:
        if vid not in item_sigma or np.isnan(item_sigma[vid]) or item_sigma[vid] == 0:
            item_sigma[vid] = global_sigma

    # Standardized residuals
    df['sigma'] = df['variant_id'].map(item_sigma).fillna(global_sigma)
    df['standardized'] = df['residual'] / df['sigma']

    residuals = df[['student_anon', 'variant_id', 'template_id', 'rt_ms',
                     'residual', 'standardized']].copy()

    return {
        'item_intensity': item_intensity,
        'student_speed': student_speed,
        'item_sigma': item_sigma,
        'residuals': residuals,
    }
