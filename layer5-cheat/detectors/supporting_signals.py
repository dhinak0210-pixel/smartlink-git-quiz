# layer5-cheat/detectors/supporting_signals.py
"""
Supporting Signals:
1. Leak decoy options (canary distractors)
2. Telemetry events (tab switches, window blur)
3. Rapid guesses (< 1500ms)
4. Unsupervised anomaly detection (Isolation Forest)
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def compute_supporting_signals(
    responses_df: pd.DataFrame,
    events_df: pd.DataFrame = None,
    decoy_options: set = None,
) -> pd.DataFrame:
    """
    Extract auxiliary signals for each student.

    Returns DataFrame with:
    student_anon, tab_switch_count, blur_count, decoy_count,
    rapid_guess_count, iso_anomaly_flag, iso_anomaly_score
    """
    students = sorted(responses_df['student_anon'].unique())
    decoy_options = decoy_options or set()

    # 1. Event telemetry
    tab_counts = {s: 0 for s in students}
    blur_counts = {s: 0 for s in students}

    if events_df is not None and len(events_df) > 0:
        s_col = 'student_anon' if 'student_anon' in events_df.columns else 'anon_student_id'
        t_col = 'event_type' if 'event_type' in events_df.columns else 'type'

        for sid, group in events_df.groupby(s_col):
            if sid in tab_counts:
                types = group[t_col].values
                tab_counts[sid] = int(np.sum(np.isin(types, ['tab_switch', 'visibility_hidden'])))
                blur_counts[sid] = int(np.sum(types == 'window_blur'))

    # 2. Response based features
    student_records = []
    features_for_ml = []

    for sid, group in responses_df.groupby('student_anon'):
        rt_col = 'rt_ms' if 'rt_ms' in group.columns else ('response_ms_rounded' if 'response_ms_rounded' in group.columns else 'rt_bucket')
        times = group[rt_col].values if rt_col in group.columns else np.array([8000])
        if rt_col == 'rt_bucket':
            times = times * 1000.0

        n_rapid = int(np.sum(times < 1500))
        decoy_hits = 0
        if decoy_options and 'chosen_option_tag' in group.columns:
            decoy_hits = int(group['chosen_option_tag'].isin(decoy_options).sum())

        mean_rt = float(np.mean(times))
        std_rt = float(np.std(times)) if len(times) > 1 else 0.0
        acc = float(group['is_correct'].mean())

        student_records.append({
            'student_anon': sid,
            'tab_switch_count': tab_counts.get(sid, 0),
            'blur_count': blur_counts.get(sid, 0),
            'decoy_count': decoy_hits,
            'rapid_guess_count': n_rapid,
            'mean_rt': mean_rt,
            'std_rt': std_rt,
            'accuracy': acc,
        })

        features_for_ml.append([mean_rt, std_rt, acc, tab_counts.get(sid, 0), n_rapid])

    res_df = pd.DataFrame(student_records)

    # 3. Isolation Forest
    if len(features_for_ml) >= 10:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(features_for_ml)
        iso = IsolationForest(
            n_estimators=100,
            contamination=0.08,
            random_state=config.RANDOM_SEED
        )
        preds = iso.fit_predict(X_scaled)
        scores = iso.decision_function(X_scaled)
        res_df['iso_anomaly_flag'] = (preds == -1)
        res_df['iso_anomaly_score'] = np.round(scores, 4)
    else:
        res_df['iso_anomaly_flag'] = False
        res_df['iso_anomaly_score'] = 0.0

    return res_df
