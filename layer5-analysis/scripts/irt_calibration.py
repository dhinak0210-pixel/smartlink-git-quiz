# layer5-analysis/scripts/irt_calibration.py
"""
Phase B: Item Response Theory calibration.

Fits a 1PL (Rasch) or 2PL model to estimate:
- Question difficulty parameters (compare with hand-labeled easy/medium/hard)
- Question discrimination parameters (2PL only)
- Student ability parameters

Uses pyirt if available, falling back to a logistic approach.

Usage:
    python irt_calibration.py --model 2PL
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def build_response_matrix(answers: pd.DataFrame) -> tuple[np.ndarray, list, list]:
    """
    Build a student x question binary response matrix.
    Returns (matrix, student_ids, question_ids).
    """
    students = sorted(answers['anon_student_id'].unique())
    questions = sorted(answers['question_id'].unique())

    student_idx = {s: i for i, s in enumerate(students)}
    question_idx = {q: i for i, q in enumerate(questions)}

    matrix = np.full((len(students), len(questions)), np.nan)

    for _, row in answers.iterrows():
        si = student_idx[row['anon_student_id']]
        qi = question_idx[row['question_id']]
        matrix[si, qi] = float(row['is_correct'])

    return matrix, students, questions


def fit_irt_pyirt(matrix: np.ndarray, model: str = '2PL') -> dict:
    """Fit IRT using pyirt if installed."""
    try:
        from pyirt import irt
    except ImportError:
        return None

    data = []
    for i in range(matrix.shape[0]):
        for j in range(matrix.shape[1]):
            if not np.isnan(matrix[i, j]):
                data.append((i, j, int(matrix[i, j])))

    if not data:
        return None

    try:
        item_params, person_params = irt(
            data,
            model=model.lower(),
            max_iter=config.IRT_ITERATIONS,
        )
        return {
            'item_params': item_params,
            'person_params': person_params,
        }
    except Exception as e:
        print(f"  pyirt fitting notice: {e}")
        return None


def fit_simple_logistic(matrix: np.ndarray) -> dict:
    """
    Fallback: Logistic difficulty estimation (1PL/Rasch proxy).
    Difficulty = -log(p / (1 - p)) where p = fraction correct.
    """
    n_questions = matrix.shape[1]
    difficulties = []

    for j in range(n_questions):
        col = matrix[:, j]
        valid = col[~np.isnan(col)]
        if len(valid) < 5:
            difficulties.append(0.0)
            continue
        p = valid.mean()
        p = np.clip(p, 0.01, 0.99)
        diff = -np.log(p / (1 - p))
        difficulties.append(round(float(diff), 4))

    return {
        'item_params': [{'difficulty': d, 'discrimination': 1.0} for d in difficulties],
        'person_params': None,
    }


def compare_with_labels(irt_difficulties: list, questions_df: pd.DataFrame,
                         question_ids: list) -> pd.DataFrame:
    """Compare IRT-calibrated difficulty with hand-labeled difficulty."""
    results = []
    for i, qid in enumerate(question_ids):
        q_row = questions_df[questions_df['id'] == qid]
        if len(q_row) == 0:
            continue

        label = q_row['difficulty'].iloc[0]
        topic = q_row['topic'].iloc[0]
        irt_diff = irt_difficulties[i] if i < len(irt_difficulties) else 0.0

        results.append({
            'question_id': qid,
            'label': label,
            'topic': topic,
            'irt_difficulty': irt_diff,
        })

    df = pd.DataFrame(results)

    print(f"\n  IRT Difficulty vs Hand Labels:")
    print(f"  {'Label':<10} {'Mean IRT':>10} {'Std':>8} {'Count':>6}")
    for label in ['easy', 'medium', 'hard']:
        subset = df[df['label'] == label]['irt_difficulty'].dropna()
        if len(subset) > 0:
            print(f"  {label:<10} {subset.mean():>10.3f} {subset.std():>8.3f} {len(subset):>6}")

    easy_mean = df[df['label'] == 'easy']['irt_difficulty'].mean()
    hard_mean = df[df['label'] == 'hard']['irt_difficulty'].mean()
    if easy_mean < hard_mean:
        print(f"\n  ✅ IRT difficulty ordering matches labels (easy < hard)")
    else:
        print(f"\n  ⚠️  IRT difficulty ordering does not match labels")

    return df


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, default=config.IRT_MODEL,
                        choices=['1PL', '2PL'], help='IRT model type')
    args = parser.parse_args()

    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — IRT Calibration ({args.model})")
    print(f"{'=' * 60}\n")

    answers = pd.read_csv(config.ANON_DIR / 'answers.csv')
    questions = pd.read_csv(config.ANON_DIR / 'questions.csv')

    print(f"Students: {answers['anon_student_id'].nunique()}")
    print(f"Questions: {answers['question_id'].nunique()}")
    print(f"Total responses: {len(answers)}\n")

    print("Building response matrix...")
    matrix, student_ids, question_ids = build_response_matrix(answers)
    print(f"  Matrix shape: {matrix.shape}")

    print(f"Fitting {args.model} model...")
    result = fit_irt_pyirt(matrix, model=args.model)

    if result is None:
        print("Using robust logistic difficulty estimation...")
        result = fit_simple_logistic(matrix)

    irt_difficulties = [p.get('difficulty', p.get('b', 0)) for p in result['item_params']]
    comparison = compare_with_labels(irt_difficulties, questions, question_ids)

    output_path = config.MODEL_DIR / 'irt_params.json'
    with open(output_path, 'w') as f:
        json.dump({
            'model': args.model,
            'n_students': len(student_ids),
            'n_questions': len(question_ids),
            'item_params': result['item_params'],
            'person_params_available': result['person_params'] is not None,
        }, f, indent=2)
    print(f"\n✅ IRT parameters saved to {output_path}")

    comparison_path = config.PUBLIC_DIR / 'irt_vs_labels.csv'
    comparison.to_csv(comparison_path, index=False)
    print(f"✅ Comparison saved to {comparison_path}")


if __name__ == '__main__':
    main()
