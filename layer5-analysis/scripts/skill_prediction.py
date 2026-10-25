# layer5-analysis/scripts/skill_prediction.py
"""
Phase B: Predict final score/tier from the first 5 answers.

Models:
1. Baseline: predict mean score
2. Linear regression on first-5 accuracy
3. Gradient boosting (XGBoost) on first-5 features

Evaluation: MAE and R2 with student-level CV.

Usage:
    python skill_prediction.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from scripts.evaluation import (
    student_level_cv, compute_baseline_mae, confidence_interval, report_model_comparison
)


def build_student_features(answers: pd.DataFrame, n_first: int = 5) -> pd.DataFrame:
    """
    Build feature vectors per student from their first N answers.
    Features:
    - accuracy_first_n: fraction correct in first N
    - avg_response_first_n: mean response time in first N
    - correct_first_n: correct count in first N
    - total_score: actual final score (target)
    """
    features = []

    for sid, group in answers.groupby('anon_student_id'):
        group = group.sort_values('position')
        first_n = group.head(n_first)
        all_answers = group

        if len(first_n) < n_first:
            continue

        resp_col = 'response_ms_rounded' if 'response_ms_rounded' in first_n.columns else 'response_ms'
        avg_resp = first_n[resp_col].mean() if resp_col in first_n.columns else 0.0

        feat = {
            'anon_student_id': sid,
            'accuracy_first_n': float(first_n['is_correct'].mean()),
            'avg_response_first_n': float(avg_resp),
            'correct_first_n': int(first_n['is_correct'].sum()),
            'total_score': float(all_answers['points'].sum()),
            'total_correct': int(all_answers['is_correct'].sum()),
        }
        features.append(feat)

    return pd.DataFrame(features)


def predict_with_linear(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Linear regression: first-5 accuracy -> total score."""
    feature_cols = ['accuracy_first_n', 'avg_response_first_n', 'correct_first_n']
    X_train = train[feature_cols].values
    y_train = train['total_score'].values
    X_test = test[feature_cols].values
    y_test = test['total_score'].values

    model = LinearRegression()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    return {
        'mae': float(mean_absolute_error(y_test, y_pred)),
        'r2': float(r2_score(y_test, y_pred)),
        'y_test': y_test,
        'y_pred': y_pred,
    }


def predict_with_xgboost(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Gradient boosting: first-5 features -> total score."""
    try:
        from xgboost import XGBRegressor
    except ImportError:
        return None

    feature_cols = ['accuracy_first_n', 'avg_response_first_n', 'correct_first_n']
    X_train = train[feature_cols].values
    y_train = train['total_score'].values
    X_test = test[feature_cols].values
    y_test = test['total_score'].values

    model = XGBRegressor(
        n_estimators=50,
        max_depth=3,
        learning_rate=0.1,
        random_state=config.RANDOM_SEED,
        verbosity=0,
    )
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    return {
        'mae': float(mean_absolute_error(y_test, y_pred)),
        'r2': float(r2_score(y_test, y_pred)),
        'y_test': y_test,
        'y_pred': y_pred,
    }


def main():
    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Skill Prediction")
    print(f"{'=' * 60}\n")

    answers = pd.read_csv(config.ANON_DIR / 'answers.csv')
    print(f"Students: {answers['anon_student_id'].nunique()}")
    print(f"Total answers: {len(answers)}\n")

    print("Building student features from first 5 answers...")
    features = build_student_features(answers, n_first=5)
    print(f"  Students with complete first-5: {len(features)}")
    print(f"  Score range: {features['total_score'].min()} – {features['total_score'].max()}\n")

    print("Running student-level cross-validation...\n")

    baseline_maes = []
    linear_maes = []
    linear_r2s = []
    xgb_maes = []
    xgb_r2s = []

    for fold, train_df, test_df in student_level_cv(features):
        baseline_mae = compute_baseline_mae(train_df['total_score'], test_df['total_score'])
        baseline_maes.append(baseline_mae)

        lin_result = predict_with_linear(train_df, test_df)
        linear_maes.append(lin_result['mae'])
        linear_r2s.append(lin_result['r2'])

        xgb_result = predict_with_xgboost(train_df, test_df)
        if xgb_result:
            xgb_maes.append(xgb_result['mae'])
            xgb_r2s.append(xgb_result['r2'])

    results = {}

    bm, bl, bh = confidence_interval(baseline_maes)
    results['Baseline (mean score)'] = {
        'metric': bm, 'ci_low': bl, 'ci_high': bh, 'baseline': bm,
        'note': 'MAE (lower is better)'
    }

    lm, ll, lh = confidence_interval(linear_maes)
    results['Linear Regression'] = {
        'metric': lm, 'ci_low': ll, 'ci_high': lh, 'baseline': bm,
    }

    if xgb_maes:
        xm, xl, xh = confidence_interval(xgb_maes)
        results['XGBoost'] = {
            'metric': xm, 'ci_low': xl, 'ci_high': xh, 'baseline': bm,
        }

    print(f"\n{'=' * 60}")
    print(f"RESULTS: Skill Prediction (MAE, lower is better)")
    print(f"{'=' * 60}")
    report_model_comparison(results)

    if linear_r2s:
        rm, rl, rh = confidence_interval(linear_r2s)
        print(f"\nLinear R²: {rm:.3f} [{rl:.3f}, {rh:.3f}]")
    if xgb_r2s:
        xm_r2, xl_r2, xh_r2 = confidence_interval(xgb_r2s)
        print(f"XGBoost R²: {xm_r2:.3f} [{xl_r2:.3f}, {xh_r2:.3f}]")

    print(f"\n📝 HONEST ASSESSMENT:")
    if linear_maes and xgb_maes:
        if min(np.mean(linear_maes), np.mean(xgb_maes)) < np.mean(baseline_maes) * 0.95:
            print("  The models beat the baseline with early-signal predictability.")
        else:
            print("  The models do not substantially beat the mean baseline.")
            print("  With ~200 students and short 15-question assessments, variation is high.")

    output = {
        'task': 'skill_prediction',
        'n_students': len(features),
        'n_first_answers': 5,
        'cv_folds': config.CV_FOLDS,
        'results': {k: {'mae': v['metric'], 'ci': [v['ci_low'], v['ci_high']]}
                     for k, v in results.items()},
    }
    output_path = config.PUBLIC_DIR / 'skill_prediction_results.json'
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\n✅ Results saved to {output_path}")


if __name__ == '__main__':
    main()
