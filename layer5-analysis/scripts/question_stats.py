# layer5-analysis/scripts/question_stats.py
"""
Phase A: Classical item analysis for every question.

Computes:
- Difficulty (p-value): fraction of students who answered correctly
- Discrimination (point-biserial correlation with total score)
- Distractor analysis: which wrong options attracted which students
- Flawed-question detection: flags questions with very low discrimination
  or where strong students prefer a wrong option

Usage:
    python question_stats.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def load_anonymized_data() -> dict[str, pd.DataFrame]:
    """Load the anonymized dataset."""
    data = {}
    for name in ['answers', 'questions', 'options', 'student_questions']:
        path = config.ANON_DIR / f'{name}.csv'
        if path.exists():
            data[name] = pd.read_csv(path)
        else:
            print(f"⚠️  Missing: {path}")
    return data


def compute_difficulty(answers: pd.DataFrame) -> pd.DataFrame:
    """Fraction correct per question (p-value). Higher = easier."""
    diff = answers.groupby('question_id').agg(
        attempts=('is_correct', 'count'),
        correct=('is_correct', 'sum'),
    ).reset_index()
    diff['p_value'] = (diff['correct'] / diff['attempts']).round(4)
    return diff


def compute_discrimination(answers: pd.DataFrame) -> pd.DataFrame:
    """
    Point-biserial correlation between each question (correct/incorrect)
    and the student's total score. High positive = good discriminator.
    Near zero or negative = flawed question.
    """
    total_scores = answers.groupby('anon_student_id')['points'].sum()

    results = []
    for qid, group in answers.groupby('question_id'):
        if len(group) < 10:
            results.append({
                'question_id': qid,
                'discrimination': np.nan,
                'p_value_disc': np.nan,
                'n': len(group)
            })
            continue

        correct = group['is_correct'].astype(float).values
        student_ids = group['anon_student_id'].values
        this_question_points = group.set_index('anon_student_id')['points']
        adjusted_totals = total_scores.reindex(student_ids).values - this_question_points.values

        # Point-biserial correlation
        try:
            if np.std(correct) == 0 or np.std(adjusted_totals) == 0:
                r, p = 0.0, 1.0
            else:
                r, p = stats.pointbiserialr(correct, adjusted_totals)
            results.append({
                'question_id': qid,
                'discrimination': round(float(r), 4),
                'p_value_disc': round(float(p), 4),
                'n': len(group)
            })
        except Exception:
            results.append({
                'question_id': qid,
                'discrimination': np.nan,
                'p_value_disc': np.nan,
                'n': len(group)
            })

    return pd.DataFrame(results)


def compute_distractor_analysis(answers: pd.DataFrame, options: pd.DataFrame) -> pd.DataFrame:
    """
    For each question, count how many students chose each option,
    broken down by high/low scorers (top/bottom 27%).
    """
    total_scores = answers.groupby('anon_student_id')['points'].sum()
    n_students = len(total_scores)
    cutoff_n = max(1, int(n_students * 0.27))

    high_scorers = set(total_scores.nlargest(cutoff_n).index)
    low_scorers = set(total_scores.nsmallest(cutoff_n).index)

    if 'option_id' not in answers.columns:
        return pd.DataFrame()

    merged = answers.merge(
        options[['id', 'question_id', 'text', 'is_correct', 'label']],
        left_on='option_id',
        right_on='id',
        suffixes=('', '_opt')
    )

    results = []
    for qid, group in merged.groupby('question_id'):
        for opt_id, opt_group in group.groupby('option_id'):
            opt_text = opt_group['text'].iloc[0]
            opt_label = opt_group['label'].iloc[0]
            is_correct = opt_group['is_correct'].iloc[0]

            choosers = set(opt_group['anon_student_id'].values)
            high_chose = len(choosers & high_scorers)
            low_chose = len(choosers & low_scorers)

            results.append({
                'question_id': qid,
                'option_label': opt_label,
                'option_text': opt_text[:80],
                'is_correct': is_correct,
                'total_chosen': len(choosers),
                'high_scorers_chosen': high_chose,
                'low_scorers_chosen': low_chose,
            })

    return pd.DataFrame(results)


def detect_flawed_questions(difficulty: pd.DataFrame, discrimination: pd.DataFrame,
                             distractors: pd.DataFrame) -> pd.DataFrame:
    """
    Flag potentially flawed questions based on psychometric standards.
    """
    merged = difficulty.merge(discrimination, on='question_id', how='left')
    merged['flaw_reason'] = ''
    merged['is_flawed'] = False

    for idx, row in merged.iterrows():
        reasons = []
        disc = row.get('discrimination', np.nan)
        p_val = row.get('p_value', 0.5)

        if pd.notna(disc):
            if disc < 0:
                reasons.append(f'NEGATIVE discrimination ({disc:.3f})')
            elif disc < 0.15:
                reasons.append(f'Low discrimination ({disc:.3f})')

        if p_val > 0.95 and pd.notna(disc) and disc < 0.2:
            reasons.append(f'Too easy ({p_val:.2f}) with low discrimination')

        if p_val < 0.05:
            reasons.append(f'Too hard ({p_val:.2f}) — possible error in answer key')

        if not distractors.empty:
            q_distractors = distractors[distractors['question_id'] == row['question_id']]
            correct_opt = q_distractors[q_distractors['is_correct'] == True]
            wrong_opts = q_distractors[q_distractors['is_correct'] == False]

            if len(correct_opt) > 0 and len(wrong_opts) > 0:
                correct_high = correct_opt['high_scorers_chosen'].sum()
                for _, wrong in wrong_opts.iterrows():
                    if wrong['high_scorers_chosen'] > correct_high and correct_high > 0:
                        reasons.append(
                            f"Distractor '{wrong['option_label']}' attracts more high scorers "
                            f"({wrong['high_scorers_chosen']}) than correct answer ({correct_high})"
                        )

        if reasons:
            merged.at[idx, 'flaw_reason'] = '; '.join(reasons)
            merged.at[idx, 'is_flawed'] = True

    return merged


def main():
    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Question Statistics")
    print(f"{'=' * 60}\n")

    data = load_anonymized_data()
    if 'answers' not in data or 'questions' not in data:
        print("❌ Missing required data. Run anonymize.py first.")
        return

    answers = data['answers']
    questions = data['questions']
    options = data.get('options', pd.DataFrame())

    print(f"Students: {answers['anon_student_id'].nunique()}")
    print(f"Questions: {answers['question_id'].nunique()}")
    print(f"Total answers: {len(answers)}\n")

    print("Computing difficulty (p-values)...")
    difficulty = compute_difficulty(answers)

    print("Computing discrimination (point-biserial)...")
    discrimination = compute_discrimination(answers)

    print("Computing distractor analysis...")
    distractors = compute_distractor_analysis(answers, options) if len(options) > 0 else pd.DataFrame()

    print("Detecting flawed questions...")
    flawed = detect_flawed_questions(difficulty, discrimination, distractors)

    q_meta = questions[['id', 'text', 'difficulty', 'topic']].rename(columns={'id': 'question_id'})
    flawed = flawed.merge(q_meta, on='question_id', how='left')
    flawed = flawed.sort_values('discrimination', ascending=True)

    output_path = config.PUBLIC_DIR / 'question_statistics.csv'
    flawed.to_csv(output_path, index=False)
    print(f"\n✅ Saved to {output_path}")

    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"{'=' * 60}")

    print(f"\nDifficulty distribution:")
    for label in ['easy', 'medium', 'hard']:
        subset = flawed[flawed['difficulty'] == label]
        if len(subset) > 0:
            print(f"  {label}: mean p={subset['p_value'].mean():.2f}, "
                  f"range [{subset['p_value'].min():.2f}, {subset['p_value'].max():.2f}]")

    print(f"\nDiscrimination distribution:")
    valid_disc = flawed['discrimination'].dropna()
    print(f"  Mean: {valid_disc.mean():.3f}")
    print(f"  Median: {valid_disc.median():.3f}")
    print(f"  Range: [{valid_disc.min():.3f}, {valid_disc.max():.3f}]")

    n_flawed = flawed['is_flawed'].sum()
    print(f"\n🚨 Flawed questions detected: {n_flawed}/{len(flawed)}")
    if n_flawed > 0:
        for _, row in flawed[flawed['is_flawed']].head(5).iterrows():
            print(f"  Q {str(row['question_id'])[:8]}... ({row['difficulty']}, {row['topic']})")
            print(f"    → {row['flaw_reason']}")

    if len(distractors) > 0:
        dist_path = config.PUBLIC_DIR / 'distractor_analysis.csv'
        distractors.to_csv(dist_path, index=False)
        print(f"\n✅ Distractor analysis saved to {dist_path}")


if __name__ == '__main__':
    main()
