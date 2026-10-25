# layer5-cheat/detectors/response_time.py
"""
Detector B: Response Time Signals.

Signals per student:
1. Fast-and-correct on hard items (pre-knowledge)
2. Slow-and-correct with tab hidden (lookup)
3. Overall timing misfit

Usage:
    python response_time.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from models.response_time_model import fit_response_time_model


def compute_timing_signals(
    rt_df: pd.DataFrame,
    events_df: pd.DataFrame,
    irt_difficulties: dict,
    irt_abilities: dict,
) -> pd.DataFrame:
    """
    Compute response-time signals for each student.

    Returns DataFrame with:
    student_anon, n_fast_correct_hard, n_slow_correct_tab, timing_misfit,
    misfit_z, fast_correct_details, slow_correct_details
    """
    rt_model = fit_response_time_model(rt_df)
    residuals = rt_model['residuals']

    if len(residuals) == 0:
        return pd.DataFrame()

    answers = rt_df[['student_anon', 'variant_id', 'template_id', 'is_correct']].drop_duplicates()
    merged = residuals.merge(answers, on=['student_anon', 'variant_id', 'template_id'], how='left')
    merged['difficulty'] = merged['template_id'].map(irt_difficulties).fillna(0.0)
    merged['ability'] = merged['student_anon'].map(irt_abilities).fillna(0.0)

    # Parse tab-hidden events
    tab_hidden = {}
    if events_df is not None and len(events_df) > 0:
        hidden_events = events_df[events_df['event_type'].isin(['visibility_hidden', 'tab_switch', 'window_blur'])]
        for _, row in hidden_events.iterrows():
            sid = row.get('student_anon', row.get('anon_student_id'))
            if sid not in tab_hidden:
                tab_hidden[sid] = []
            try:
                meta_raw = row.get('safe_metadata', row.get('metadata', '{}'))
                meta = json.loads(meta_raw) if isinstance(meta_raw, str) else meta_raw
                if isinstance(meta, dict):
                    qid = meta.get('question_id', meta.get('template_id'))
                    if qid:
                        tab_hidden[sid].append(qid)
            except (json.JSONDecodeError, TypeError):
                pass

    results = []

    for sid, group in merged.groupby('student_anon'):
        ability = irt_abilities.get(sid, 0.0)

        # --- Signal 1: Fast and correct on hard items ---
        hard_correct = group[(group['is_correct'] == 1) & (group['difficulty'] > ability)]
        fast_hard_correct = hard_correct[hard_correct['standardized'] < config.RT_FAST_RESIDUAL_CUTOFF]

        n_fast_correct_hard = len(fast_hard_correct)
        fast_details = []
        for _, row in fast_hard_correct.iterrows():
            fast_details.append({
                'template_id': row['template_id'],
                'difficulty': round(float(row['difficulty']), 2),
                'rt_ms': round(float(row['rt_ms'])),
                'z_score': round(float(row['standardized']), 2),
            })

        # --- Signal 2: Slow and correct with tab hidden ---
        student_tabs = set(tab_hidden.get(sid, []))
        slow_correct = group[(group['is_correct'] == 1) &
                             (group['standardized'] > config.RT_SLOW_RESIDUAL_CUTOFF)]

        n_slow_tab = 0
        slow_details = []
        for _, row in slow_correct.iterrows():
            if row['template_id'] in student_tabs or len(student_tabs) > 0:
                n_slow_tab += 1
                slow_details.append({
                    'template_id': row['template_id'],
                    'rt_ms': round(float(row['rt_ms'])),
                    'z_score': round(float(row['standardized']), 2),
                })

        # --- Signal 3: Overall timing misfit ---
        timing_misfit = float((group['standardized'] ** 2).sum())
        n_items = len(group)
        misfit_z = float((timing_misfit - n_items) / np.sqrt(2 * n_items)) if n_items > 0 else 0.0

        results.append({
            'student_anon': sid,
            'n_fast_correct_hard': n_fast_correct_hard,
            'n_slow_correct_tab': n_slow_tab,
            'timing_misfit': round(timing_misfit, 2),
            'misfit_z': round(misfit_z, 2),
            'fast_correct_details': fast_details,
            'slow_correct_details': slow_details,
        })

    return pd.DataFrame(results)
