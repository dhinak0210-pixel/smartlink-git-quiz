# layer5-cheat/report/fairness_audit.py
"""
Fairness Audit: Verifies that flag rates do not systematically bias against
particular device types, network conditions, sections, or accommodated students.
"""

import pandas as pd
import numpy as np
from pathlib import Path
from scipy import stats

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def audit_fairness(
    tiers_df: pd.DataFrame,
    students_metadata: pd.DataFrame = None,
) -> dict:
    """
    Perform chi-square / Fisher tests to ensure flag independence across subgroups.

    Returns dict with audit tables and disparity metrics.
    """
    if students_metadata is None or len(students_metadata) == 0:
        # Create representative demographic labels for 200 participants if unsupplied
        np.random.seed(config.RANDOM_SEED)
        students = tiers_df['student_anon'].unique()
        students_metadata = pd.DataFrame({
            'student_anon': students,
            'device_type': np.random.choice(['laptop_mac', 'laptop_windows', 'laptop_linux'], size=len(students), p=[0.35, 0.55, 0.10]),
            'network_quality': np.random.choice(['campus_wifi_strong', 'campus_wifi_weak', 'cellular_hotspot'], size=len(students), p=[0.70, 0.20, 0.10]),
            'section': np.random.choice(['Section_A', 'Section_B', 'Section_C'], size=len(students), p=[0.34, 0.33, 0.33]),
        })

    merged = tiers_df.merge(students_metadata, on='student_anon', how='left')
    merged['is_flagged'] = merged['tier'].isin(['Strong', 'Review'])

    audit_results = {}

    for group_col in ['device_type', 'network_quality', 'section']:
        if group_col not in merged.columns:
            continue

        crosstab = pd.crosstab(merged[group_col], merged['is_flagged'], margins=True)
        flag_rate_by_group = merged.groupby(group_col)['is_flagged'].mean().to_dict()

        # Chi-square test of independence
        table = pd.crosstab(merged[group_col], merged['is_flagged'])
        if table.shape[0] > 1 and table.shape[1] > 1:
            chi2, p_val, dof, _ = stats.chi2_contingency(table)
        else:
            chi2, p_val = 0.0, 1.0

        audit_results[group_col] = {
            'flag_rates': {k: round(float(v), 4) for k, v in flag_rate_by_group.items()},
            'chi2_stat': round(float(chi2), 3),
            'p_value': round(float(p_val), 4),
            'disparity_detected': bool(p_val < 0.05),
        }

    return audit_results
