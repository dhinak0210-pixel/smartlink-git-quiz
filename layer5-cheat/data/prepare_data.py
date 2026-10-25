# layer5-cheat/data/prepare_data.py
"""
Load and clean data for all three detectors.
Applies pre-specified cleaning rules.

Usage:
    python prepare_data.py --irt-params path/to/irt_params.json
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def load_cleaning_rules() -> dict:
    path = config.DATA_DIR / 'cleaning_rules.yaml'
    with open(path) as f:
        return yaml.safe_load(f)


def load_irt_params(path: Path) -> dict:
    """Load Rasch difficulties and abilities from the IRT clean pass."""
    with open(path) as f:
        return json.load(f)


def load_accommodations() -> set:
    """Load the list of students with approved timing accommodations."""
    path = config.DATA_DIR / 'accommodations.csv'
    if path.exists():
        df = pd.read_csv(path)
        return set(df['student_anon'].values)
    return set()


def prepare_detector_data(
    response_path: Path,
    irt_params: dict,
    rules: dict,
) -> dict:
    """
    Prepare cleaned datasets for each detector.

    Returns:
        {
            'person_fit': DataFrame,    # Cleaned for person-fit
            'timing': DataFrame,        # Cleaned for response time
            'pairs': DataFrame,         # Cleaned for pair similarity
            'all_responses': DataFrame, # All valid responses (for supporting signals)
            'irt_difficulties': dict,   # {question_id: difficulty_logit}
            'irt_abilities': dict,      # {student_anon: ability_logit}
            'accommodations': set,      # Student IDs with accommodations
            'metadata': dict,           # Counts and exclusions
        }
    """
    df = pd.read_csv(response_path)
    original_count = len(df)
    metadata = {'original': original_count}

    accommodations = load_accommodations()

    # --- Universal cleaning ---

    # Remove not_reached
    if 'status' in df.columns:
        df = df[df['status'] != 'not_reached'].copy()
    metadata['after_not_reached'] = len(df)

    # Remove reserve questions
    if 'position' in df.columns:
        df = df[df['position'] <= config.N_QUESTIONS].copy()
    metadata['after_reserve'] = len(df)

    # Remove questions with flagged keys (if any listed)
    flagged_keys_path = config.DATA_DIR / 'flagged_keys.json'
    if flagged_keys_path.exists():
        with open(flagged_keys_path) as f:
            flagged_keys = set(json.load(f))
        col = 'template_id' if 'template_id' in df.columns else 'question_id'
        df = df[~df[col].isin(flagged_keys)].copy()
        metadata['after_flagged_keys'] = len(df)

    # Ensure consistent column naming: student_anon, template_id, variant_id, is_correct, chosen_option_tag
    if 'anon_student_id' in df.columns and 'student_anon' not in df.columns:
        df['student_anon'] = df['anon_student_id']
    if 'question_id' in df.columns and 'template_id' not in df.columns:
        df['template_id'] = df['question_id']
    if 'variant_id' not in df.columns:
        df['variant_id'] = df['template_id']
    if 'chosen_option_tag' not in df.columns:
        df['chosen_option_tag'] = df.get('option_id', df.get('chosen_label', 'A'))
    if 'status' not in df.columns:
        df['status'] = 'answered'

    # --- IRT parameters ---
    irt_difficulties = {}
    irt_abilities = {}

    if 'item_params' in irt_params:
        for i, p in enumerate(irt_params['item_params']):
            qid = irt_params.get('templates', [f'q{i+1}'])[i] if i < len(irt_params.get('templates', [])) else f'q{i+1}'
            irt_difficulties[qid] = p.get('difficulty', p.get('b', 0))

    if 'person_params' in irt_params and irt_params['person_params']:
        for i, p in enumerate(irt_params['person_params']):
            sid = irt_params.get('students', [i+1])[i] if i < len(irt_params.get('students', [])) else i + 1
            irt_abilities[sid] = p.get('ability', p.get('theta', 0))

    # If IRT abilities not available, estimate from raw scores
    if not irt_abilities:
        scores = df[df['status'].isin(['answered', 'timed_out'])].groupby('student_anon')['is_correct'].mean()
        # Simple logit transform as fallback
        for sid, p in scores.items():
            p_clipped = np.clip(p, 0.05, 0.95)
            irt_abilities[sid] = float(np.log(p_clipped / (1 - p_clipped)))

    # --- Person-fit dataset ---
    pf_rules = rules['student_exclusion']['person_fit']
    pf_df = df[df['status'].isin(['answered', 'timed_out'])].copy()
    pf_df['is_correct'] = pf_df['is_correct'].fillna(0).astype(int)

    # Exclude timed_out for person-fit (treat as missing)
    pf_df = pf_df[pf_df['status'] == 'answered'].copy()

    # Min responses
    student_counts = pf_df.groupby('student_anon').size()
    valid_pf_students = set(student_counts[student_counts >= pf_rules['min_responses']].index)

    # Exclude perfect and zero
    student_scores = pf_df.groupby('student_anon')['is_correct'].sum()
    if pf_rules.get('exclude_perfect'):
        perfect = set(student_scores[student_scores >= config.N_QUESTIONS].index)
        valid_pf_students -= perfect
        metadata['excluded_perfect'] = len(perfect)
    if pf_rules.get('exclude_zero'):
        zeros = set(student_scores[student_scores == 0].index)
        valid_pf_students -= zeros
        metadata['excluded_zero'] = len(zeros)

    pf_df = pf_df[pf_df['student_anon'].isin(valid_pf_students)]
    metadata['person_fit_students'] = len(valid_pf_students)
    metadata['person_fit_responses'] = len(pf_df)

    # --- Timing dataset ---
    rt_rules = rules['student_exclusion']['timing']
    rt_df = df[df['status'] == 'answered'].copy()

    if 'rt_bucket' in rt_df.columns:
        rt_df['rt_ms'] = rt_df['rt_bucket'] * 1000  # Convert seconds to ms
    elif 'response_ms_rounded' in rt_df.columns:
        rt_df['rt_ms'] = rt_df['response_ms_rounded']
    else:
        rt_df['rt_ms'] = 8000  # Fallback

    # Exclude accommodations
    if rt_rules.get('exclude_accommodations'):
        rt_df = rt_df[~rt_df['student_anon'].isin(accommodations)]
        metadata['excluded_accommodations'] = len(accommodations)

    # Min responses
    rt_counts = rt_df.groupby('student_anon').size()
    valid_rt_students = set(rt_counts[rt_counts >= rt_rules['min_responses']].index)
    rt_df = rt_df[rt_df['student_anon'].isin(valid_rt_students)]
    metadata['timing_students'] = len(valid_rt_students)

    # --- Pair similarity dataset ---
    pair_df = df[df['status'] == 'answered'].copy()
    metadata['pair_responses'] = len(pair_df)

    print(f"Data preparation complete:")
    for k, v in metadata.items():
        print(f"  {k}: {v}")

    return {
        'person_fit': pf_df,
        'timing': rt_df,
        'pairs': pair_df,
        'all_responses': df,
        'irt_difficulties': irt_difficulties,
        'irt_abilities': irt_abilities,
        'accommodations': accommodations,
        'metadata': metadata,
    }
