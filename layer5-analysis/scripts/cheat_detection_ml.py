# layer5-analysis/scripts/cheat_detection_ml.py
"""
Phase B: Compare rule-based cheat detection (Layer 2) with unsupervised ML.

IMPORTANT: We have almost no true labels. The "labels" are admin review
decisions, which are themselves heuristic. This script reports AGREEMENT
between methods, not "accuracy."

Models:
1. Rules (Layer 2): the flags already in the database
2. Isolation Forest on timing + answer features
3. DBSCAN on the same features

Evaluation:
- Agreement with rule-based flags
- Agreement with admin-reviewed outcomes
- False positive count (students flagged by ML but cleared by admin)
- NO inflated accuracy claims

Usage:
    python cheat_detection_ml.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def build_cheat_features(answers: pd.DataFrame, events: pd.DataFrame = None) -> pd.DataFrame:
    """
    Build per-student features for cheat detection.
    All features are derived from answer patterns and timing.
    """
    features = []

    for sid, group in answers.groupby('anon_student_id'):
        group = group.sort_values('position')

        feat = {
            'anon_student_id': sid,
            'total_correct': int(group['is_correct'].sum()),
            'total_score': float(group['points'].sum()),
            'n_answers': len(group),
        }

        # Timing features
        if 'response_ms_rounded' in group.columns:
            times = group['response_ms_rounded'].values
            feat['mean_response_ms'] = float(np.mean(times))
            feat['std_response_ms'] = float(np.std(times)) if len(times) > 1 else 0.0
            feat['min_response_ms'] = float(np.min(times))
            feat['n_fast_answers'] = int(np.sum(times < 3000))
            feat['n_very_fast_answers'] = int(np.sum(times < 2000))
        else:
            feat['mean_response_ms'] = 0.0
            feat['std_response_ms'] = 0.0
            feat['min_response_ms'] = 0.0
            feat['n_fast_answers'] = 0
            feat['n_very_fast_answers'] = 0

        # Pattern features
        feat['accuracy'] = float(group['is_correct'].mean())
        correct_by_pos = group.set_index('position')['is_correct']
        feat['early_accuracy'] = float(correct_by_pos.reindex(range(1, 6)).mean()) if len(correct_by_pos) >= 5 else feat['accuracy']
        feat['late_accuracy'] = float(correct_by_pos.reindex(range(11, 16)).mean()) if len(correct_by_pos) >= 11 else feat['accuracy']
        feat['accuracy_trend'] = feat['late_accuracy'] - feat['early_accuracy']

        feat['easy_accuracy'] = feat['early_accuracy']
        feat['hard_accuracy'] = feat['late_accuracy']
        feat['hard_minus_easy'] = feat['hard_accuracy'] - feat['easy_accuracy']

        features.append(feat)

    df = pd.DataFrame(features)

    # Add tab-switch counts from events if available
    if events is not None and len(events) > 0 and 'event_type' in events.columns:
        tab_switches = events[events['event_type'] == 'tab_switch'].groupby('anon_student_id').size()
        df['tab_switch_count'] = df['anon_student_id'].map(tab_switches).fillna(0).astype(int)
    else:
        df['tab_switch_count'] = 0

    return df


def run_isolation_forest(df: pd.DataFrame, feature_cols: list[str]) -> np.ndarray:
    """Detect anomalies using Isolation Forest."""
    X = df[feature_cols].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    iso = IsolationForest(
        n_estimators=100,
        contamination=0.10,
        random_state=config.RANDOM_SEED
    )
    preds = iso.fit_predict(X_scaled)
    # -1 is anomaly, 1 is normal -> convert to boolean True=anomaly
    return preds == -1


def run_dbscan(df: pd.DataFrame, feature_cols: list[str]) -> np.ndarray:
    """Detect anomalies using DBSCAN noise points (-1)."""
    X = df[feature_cols].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    db = DBSCAN(eps=2.0, min_samples=3)
    labels = db.fit_predict(X_scaled)
    # -1 is noise (outlier)
    return labels == -1


def jaccard_similarity(set_a: set, set_b: set) -> float:
    """Compute Jaccard similarity index between two sets."""
    if not set_a and not set_b:
        return 1.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return float(intersection / union) if union > 0 else 0.0


def main():
    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Cheat Detection: Rules vs ML")
    print(f"{'=' * 60}\n")

    answers = pd.read_csv(config.ANON_DIR / 'answers.csv')
    events = pd.read_csv(config.ANON_DIR / 'events.csv') if (config.ANON_DIR / 'events.csv').exists() else None
    flags = pd.read_csv(config.ANON_DIR / 'flags.csv') if (config.ANON_DIR / 'flags.csv').exists() else None
    reviews = pd.read_csv(config.ANON_DIR / 'reviews.csv') if (config.ANON_DIR / 'reviews.csv').exists() else None

    # 1. Build features
    features_df = build_cheat_features(answers, events)
    feature_cols = [
        'mean_response_ms', 'std_response_ms', 'min_response_ms',
        'n_fast_answers', 'n_very_fast_answers', 'accuracy',
        'accuracy_trend', 'hard_minus_easy', 'tab_switch_count'
    ]

    # 2. Rule-based flagged students
    rule_flagged = set()
    if flags is not None and len(flags) > 0:
        rule_flagged = set(flags['anon_student_id'].unique())

    # Admin review penalized / disqualified students
    admin_penalized = set()
    admin_cleared = set()
    if reviews is not None and len(reviews) > 0:
        admin_penalized = set(reviews[reviews['decision'].isin(['penalize', 'disqualify'])]['anon_student_id'].unique())
        admin_cleared = set(reviews[reviews['decision'] == 'clear']['anon_student_id'].unique())

    # 3. Fit unsupervised ML models
    iso_anomalies = run_isolation_forest(features_df, feature_cols)
    iso_students = set(features_df.loc[iso_anomalies, 'anon_student_id'].values)

    dbscan_anomalies = run_dbscan(features_df, feature_cols)
    dbscan_students = set(features_df.loc[dbscan_anomalies, 'anon_student_id'].values)

    # 4. Compare agreement
    j_iso_rules = jaccard_similarity(iso_students, rule_flagged)
    j_dbscan_rules = jaccard_similarity(dbscan_students, rule_flagged)
    j_iso_dbscan = jaccard_similarity(iso_students, dbscan_students)

    print(f"Method Comparison Summary:")
    print(f"  • Total cohort: {len(features_df)} students")
    print(f"  • Rule-based flagged: {len(rule_flagged)}")
    print(f"  • Isolation Forest flagged: {len(iso_students)}")
    print(f"  • DBSCAN flagged: {len(dbscan_students)}")
    print(f"  • Admin reviewed penalized: {len(admin_penalized)}")
    print(f"  • Admin reviewed cleared: {len(admin_cleared)}\n")

    print(f"Jaccard Overlap Indices:")
    print(f"  • Rules ∩ Isolation Forest: {j_iso_rules:.3f} ({len(rule_flagged & iso_students)} shared)")
    print(f"  • Rules ∩ DBSCAN:           {j_dbscan_rules:.3f} ({len(rule_flagged & dbscan_students)} shared)")
    print(f"  • Isolation Forest ∩ DBSCAN: {j_iso_dbscan:.3f} ({len(iso_students & dbscan_students)} shared)\n")

    # False positive indicators relative to admin reviews
    iso_fp = len(iso_students & admin_cleared)
    db_fp = len(dbscan_students & admin_cleared)
    print(f"False Alarm Check (Flagged by ML but Cleared by Admin):")
    print(f"  • Isolation Forest False Alarms: {iso_fp}")
    print(f"  • DBSCAN False Alarms:           {db_fp}")

    print(f"\n📝 CRITICAL CONCLUSION:")
    print(f"  Zero ground-truth exists. Heuristic rules remain the primary event safeguard.")
    print(f"  Unsupervised ML provides supplementary auditing without automated disqualification.")

    # Save comparison metrics
    out_data = {
        'total_students': len(features_df),
        'rule_flagged_count': len(rule_flagged),
        'iso_forest_flagged_count': len(iso_students),
        'dbscan_flagged_count': len(dbscan_students),
        'admin_penalized_count': len(admin_penalized),
        'admin_cleared_count': len(admin_cleared),
        'jaccard_similarity': {
            'rules_vs_iso_forest': round(j_iso_rules, 4),
            'rules_vs_dbscan': round(j_dbscan_rules, 4),
            'iso_forest_vs_dbscan': round(j_iso_dbscan, 4)
        },
        'false_positive_cleared_by_admin': {
            'iso_forest': iso_fp,
            'dbscan': db_fp
        }
    }

    out_file = config.PUBLIC_DIR / 'cheat_detection_comparison.json'
    with open(out_file, 'w') as f:
        json.dump(out_data, f, indent=2)
    print(f"\n✅ Results saved to {out_file}")


if __name__ == '__main__':
    main()
