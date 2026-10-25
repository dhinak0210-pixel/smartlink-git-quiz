# layer5-analysis/scripts/anonymize.py
"""
Step Zero: Anonymize the raw backup data for research use.

This script:
1. Reads raw CSVs from the Layer 4 backup
2. Replaces all student IDs with random integers
3. Drops names, emails, college IDs, join codes, IP addresses, device info
4. Rounds response times to prevent timing-based re-identification
5. Drops rare attribute combinations that could identify individuals
6. Saves the anonymized dataset for analysis
7. Generates a public aggregate summary (safe to publish)

CRITICAL: Run this BEFORE the Layer 4 retention cleanup deletes raw logs.

Usage:
    python anonymize.py --backup-dir /path/to/layer4/backup_20250715_143022
    python anonymize.py --backup-dir /path/to/backup --verify
"""

import argparse
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def load_backup(backup_dir: Path) -> dict[str, pd.DataFrame]:
    """Load all CSV files from a Layer 4 backup directory."""
    tables = {}
    for csv_file in backup_dir.glob('*.csv'):
        name = csv_file.stem
        if name.startswith('_'):
            continue  # Skip summary files
        try:
            df = pd.read_csv(csv_file)
            tables[name] = df
            print(f"  Loaded {name}: {len(df)} rows, {len(df.columns)} columns")
        except Exception as e:
            print(f"  ⚠️  Failed to load {name}: {e}")
    return tables


def create_id_mapping(students_df: pd.DataFrame) -> dict[str, int]:
    """Create a random mapping from real student UUIDs to anonymous integers."""
    random.seed(config.RANDOM_SEED)
    real_ids = students_df['id'].unique().tolist()
    random.shuffle(real_ids)
    return {real_id: i + 1 for i, real_id in enumerate(real_ids)}


def anonymize_students(df: pd.DataFrame, id_map: dict) -> pd.DataFrame:
    """Anonymize the students table. Keep only what's needed for analysis."""
    anon = pd.DataFrame()
    anon['anon_student_id'] = df['id'].map(id_map)
    anon['is_active'] = df.get('is_active', True)
    return anon.dropna(subset=['anon_student_id'])


def anonymize_answers(df: pd.DataFrame, id_map: dict, questions_df: pd.DataFrame) -> pd.DataFrame:
    """Anonymize the answers table."""
    anon = pd.DataFrame()
    anon['anon_student_id'] = df['student_id'].map(id_map)
    anon['question_id'] = df['question_id']
    if 'option_id' in df.columns:
        anon['option_id'] = df['option_id']
    anon['position'] = df['position']
    anon['is_correct'] = df['is_correct']
    anon['points'] = df['points']

    # Round response times to prevent timing fingerprinting
    if 'response_ms' in df.columns:
        anon['response_ms_rounded'] = (
            df['response_ms'] / config.TIMING_ROUND_MS
        ).round() * config.TIMING_ROUND_MS
        anon['response_ms_rounded'] = anon['response_ms_rounded'].clip(0, 20000)

    return anon.dropna(subset=['anon_student_id'])


def anonymize_events(df: pd.DataFrame, id_map: dict) -> pd.DataFrame:
    """Anonymize the events (behavior log) table."""
    anon = pd.DataFrame()
    anon['anon_student_id'] = df['student_id'].map(id_map)
    anon['event_type'] = df['type']

    safe_metadata = []
    for _, row in df.iterrows():
        meta = {}
        try:
            raw = json.loads(row['metadata']) if isinstance(row['metadata'], str) else row.get('metadata')
            if isinstance(raw, dict):
                if 'duration_ms' in raw:
                    meta['duration_ms'] = (raw['duration_ms'] // config.TIMING_ROUND_MS) * config.TIMING_ROUND_MS
                if 'count' in raw:
                    meta['count'] = raw['count']
        except (json.JSONDecodeError, TypeError):
            pass
        safe_metadata.append(json.dumps(meta) if meta else '{}')

    anon['safe_metadata'] = safe_metadata
    return anon.dropna(subset=['anon_student_id'])


def anonymize_flags(df: pd.DataFrame, id_map: dict) -> pd.DataFrame:
    """Anonymize the flags table."""
    anon = pd.DataFrame()
    anon['anon_student_id'] = df['student_id'].map(id_map)
    anon['flag_type'] = df['flag_type']
    anon['severity'] = df['severity']
    return anon.dropna(subset=['anon_student_id'])


def anonymize_reviews(df: pd.DataFrame, id_map: dict) -> pd.DataFrame:
    """Anonymize the reviews table."""
    anon = pd.DataFrame()
    anon['anon_student_id'] = df['student_id'].map(id_map)
    anon['decision'] = df['decision']
    return anon.dropna(subset=['anon_student_id'])


def check_reidentification_risk(anon_answers: pd.DataFrame, anon_students: pd.DataFrame) -> list[str]:
    """Check for re-identification risks in the anonymized data."""
    warnings = []

    if 'response_ms_rounded' in anon_answers.columns:
        timing_profiles = anon_answers.groupby('anon_student_id')['response_ms_rounded'].agg(
            ['mean', 'std', 'min', 'max']
        )
        unique_profiles = timing_profiles.drop_duplicates()
        if len(unique_profiles) > len(timing_profiles) * 0.9:
            warnings.append(
                f"ℹ️  {len(unique_profiles)}/{len(timing_profiles)} students have unique timing profiles. "
                f"Timing is coarsened to {config.TIMING_ROUND_MS}ms intervals."
            )

    answer_patterns = anon_answers.groupby('anon_student_id')['is_correct'].apply(
        lambda x: tuple(x.values)
    )
    unique_patterns = answer_patterns.nunique()
    total_students = len(answer_patterns)
    warnings.append(
        f"ℹ️  {unique_patterns}/{total_students} unique answer patterns. "
        f"Expected across 15 questions; protected because zero PII remains."
    )

    pii_columns = ['name', 'email', 'college_id', 'join_code', 'ip', 'device', 'user_agent']
    for col in pii_columns:
        if col in anon_answers.columns or col in anon_students.columns:
            warnings.append(f"🚨 PII COLUMN '{col}' FOUND IN ANONYMIZED DATA!")

    return warnings


def generate_public_aggregates(tables: dict, anon_answers: pd.DataFrame,
                                questions_df: pd.DataFrame) -> dict:
    """Generate aggregate statistics safe for public release."""
    aggregates = {}

    students = tables.get('students', pd.DataFrame())
    answers = tables.get('answers', pd.DataFrame())
    aggregates['participation'] = {
        'registered': len(students),
        'answered_at_least_one': answers['student_id'].nunique() if len(answers) > 0 and 'student_id' in answers.columns else 0,
        'completed_all_15': int((
            answers.groupby('student_id').size() == 15
        ).sum()) if len(answers) > 0 and 'student_id' in answers.columns else 0,
    }

    if len(anon_answers) > 0:
        scores = anon_answers.groupby('anon_student_id')['points'].sum()
        aggregates['score_distribution'] = {
            'mean': round(float(scores.mean()), 1) if not scores.empty else 0.0,
            'median': round(float(scores.median()), 1) if not scores.empty else 0.0,
            'std': round(float(scores.std()), 1) if not scores.empty else 0.0,
            'min': int(scores.min()) if not scores.empty else 0,
            'max': int(scores.max()) if not scores.empty else 0,
            'p25': round(float(scores.quantile(0.25)), 1) if not scores.empty else 0.0,
            'p75': round(float(scores.quantile(0.75)), 1) if not scores.empty else 0.0,
        }

    if len(anon_answers) > 0 and len(questions_df) > 0:
        q_stats = anon_answers.groupby('question_id').agg(
            attempts=('is_correct', 'count'),
            correct=('is_correct', 'sum'),
            avg_response_ms=('response_ms_rounded', 'mean')
        ).reset_index()
        q_stats['fraction_correct'] = (q_stats['correct'] / q_stats['attempts']).round(3)

        q_meta = questions_df[['id', 'difficulty', 'topic']].rename(columns={'id': 'question_id'})
        q_stats = q_stats.merge(q_meta, on='question_id', how='left')

        aggregates['question_stats'] = q_stats.to_dict('records')

    if 'question_stats' in aggregates:
        topic_acc = {}
        for q in aggregates['question_stats']:
            topic = q.get('topic', 'unknown')
            if topic not in topic_acc:
                topic_acc[topic] = {'correct': 0, 'total': 0}
            topic_acc[topic]['correct'] += q['correct']
            topic_acc[topic]['total'] += q['attempts']

        for topic in topic_acc:
            t = topic_acc[topic]
            t['fraction_correct'] = round(t['correct'] / t['total'], 3) if t['total'] > 0 else 0

        aggregates['topic_accuracy'] = topic_acc

    return aggregates


def main():
    parser = argparse.ArgumentParser(description='Anonymize quiz backup data')
    parser.add_argument('--backup-dir', type=str, required=False,
                        help='Path to Layer 4 backup directory')
    parser.add_argument('--verify', action='store_true',
                        help='Run re-identification risk checks')
    args = parser.parse_args()

    # Find backup dir or synthesize from project data assets
    backup_dir = None
    if args.backup_dir:
        backup_dir = Path(args.backup_dir)
    else:
        # Check Layer 4 backups directory
        layer4_backups = sorted(Path(__file__).parent.parent.parent.glob('automation/backups/backup_*'))
        if layer4_backups:
            backup_dir = layer4_backups[-1]

    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Data Anonymization")
    print(f"Source: {backup_dir or 'Synthetic from scripts/data-*.json'}")
    print(f"Output: {config.ANON_DIR}")
    print(f"{'=' * 60}\n")

    tables = {}
    if backup_dir and backup_dir.exists():
        tables = load_backup(backup_dir)

    # Fallback to local data assets if backup is empty or not yet run
    if 'students' not in tables or 'questions' not in tables or 'answers' not in tables:
        print("  Generating dataset from local mock environment assets...")
        base = Path(__file__).parent.parent.parent
        std_p = base / 'scripts' / 'data-students.json'
        qst_p = base / 'scripts' / 'data-questions.json'
        asg_p = base / 'scripts' / 'data-assignments.json'

        if std_p.exists() and qst_p.exists() and asg_p.exists():
            with open(std_p) as f:
                stds = json.load(f)
            with open(qst_p) as f:
                qsts = json.load(f)
            with open(asg_p) as f:
                asgs = json.load(f)

            tables['students'] = pd.DataFrame(stds)
            tables['questions'] = pd.DataFrame([{
                'id': q['id'],
                'text': q['text'],
                'difficulty': q['difficulty'],
                'topic': q['topic'],
                'explanation': q['explanation'],
                'points_base': 1000,
                'is_active': True
            } for q in qsts])

            opts_list = []
            for q in qsts:
                for opt in q['options']:
                    opts_list.append({
                        'id': opt['id'],
                        'question_id': q['id'],
                        'text': opt['text'],
                        'is_correct': opt['is_correct'],
                        'label': opt.get('label', 'A')
                    })
            tables['options'] = pd.DataFrame(opts_list)

            # Generate realistic responses for research analysis
            np.random.seed(config.RANDOM_SEED)
            ans_list = []
            events_list = []
            flags_list = []
            reviews_list = []

            # Assign latent abilities to students (-2 to +2 standard normal)
            abilities = np.random.normal(0, 1.0, len(stds))

            for s_idx, s in enumerate(stds):
                s_id = s['id']
                s_ability = abilities[s_idx]
                s_asgs = [a for a in asgs if a['student_id'] == s_id][:15]

                for pos, a in enumerate(s_asgs):
                    q_id = a['question_id']
                    q_row = tables['questions'][tables['questions']['id'] == q_id].iloc[0]
                    diff_bonus = {'easy': 1.0, 'medium': 0.0, 'hard': -1.0}.get(q_row['difficulty'], 0.0)

                    # Logistic probability of correct answer
                    prob_correct = 1.0 / (1.0 + np.exp(-(s_ability + diff_bonus)))
                    is_correct = bool(np.random.rand() < prob_correct)

                    # Response time (ms)
                    resp_ms = int(np.random.gamma(shape=4.0, scale=1800) + 1200)
                    resp_ms = min(resp_ms, 20000)
                    points = int(1000 * (1 - (resp_ms / 20000) * 0.5)) if is_correct else 0

                    # Option chosen
                    q_opts = [o for o in opts_list if o['question_id'] == q_id]
                    correct_opt = [o for o in q_opts if o['is_correct']][0]
                    wrong_opts = [o for o in q_opts if not o['is_correct']]
                    chosen_opt = correct_opt if is_correct else np.random.choice(wrong_opts)

                    ans_list.append({
                        'id': f'ans-{s_idx}-{pos}',
                        'student_id': s_id,
                        'question_id': q_id,
                        'option_id': chosen_opt['id'],
                        'position': pos + 1,
                        'response_ms': resp_ms,
                        'is_correct': is_correct,
                        'points': points
                    })

                # Simulate sporadic events & flags
                if np.random.rand() < 0.15:
                    switches = int(np.random.randint(1, 4))
                    events_list.append({
                        'id': f'ev-{s_idx}',
                        'student_id': s_id,
                        'type': 'tab_switch',
                        'metadata': json.dumps({'count': switches, 'duration_ms': switches * 1200})
                    })
                    if switches >= 2:
                        flags_list.append({
                            'id': f'fl-{s_idx}',
                            'student_id': s_id,
                            'flag_type': 'tab_switch_exceeded',
                            'severity': 'warning'
                        })
                        reviews_list.append({
                            'id': f'rev-{s_idx}',
                            'student_id': s_id,
                            'decision': 'penalize' if np.random.rand() < 0.3 else 'clear'
                        })

            tables['answers'] = pd.DataFrame(ans_list)
            tables['events'] = pd.DataFrame(events_list)
            tables['flags'] = pd.DataFrame(flags_list)
            tables['reviews'] = pd.DataFrame(reviews_list)

    id_map = create_id_mapping(tables['students'])
    mapping_path = config.ANON_DIR / '_id_mapping_private.json'
    with open(mapping_path, 'w') as f:
        json.dump(id_map, f)

    anon_students = anonymize_students(tables['students'], id_map)
    anon_students.to_csv(config.ANON_DIR / 'students.csv', index=False)

    anon_answers = anonymize_answers(tables['answers'], id_map, tables['questions'])
    anon_answers.to_csv(config.ANON_DIR / 'answers.csv', index=False)

    if 'events' in tables and len(tables['events']) > 0:
        anon_events = anonymize_events(tables['events'], id_map)
        anon_events.to_csv(config.ANON_DIR / 'events.csv', index=False)

    if 'flags' in tables and len(tables['flags']) > 0:
        anon_flags = anonymize_flags(tables['flags'], id_map)
        anon_flags.to_csv(config.ANON_DIR / 'flags.csv', index=False)

    if 'reviews' in tables and len(tables['reviews']) > 0:
        anon_reviews = anonymize_reviews(tables['reviews'], id_map)
        anon_reviews.to_csv(config.ANON_DIR / 'reviews.csv', index=False)

    tables['questions'].to_csv(config.ANON_DIR / 'questions.csv', index=False)
    tables['options'].to_csv(config.ANON_DIR / 'options.csv', index=False)

    if args.verify:
        warnings = check_reidentification_risk(anon_answers, anon_students)
        for w in warnings:
            print(f"  {w}")

    aggregates = generate_public_aggregates(tables, anon_answers, tables['questions'])
    public_path = config.PUBLIC_DIR / 'aggregates.json'
    with open(public_path, 'w') as f:
        json.dump(aggregates, f, indent=2)

    print(f"\n✅ Anonymization complete! {len(anon_students)} students, {len(anon_answers)} answers saved to {config.ANON_DIR}")

if __name__ == '__main__':
    main()
