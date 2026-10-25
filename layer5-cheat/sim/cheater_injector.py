# layer5-cheat/sim/cheater_injector.py
"""
Inject simulated cheaters into honest data and measure detection power.

Scenarios:
- Copier (weak/medium/strong source, 15-70% items copied)
- Lookup helper (correct beyond ability, slow times)
- Pre-knowledge (fast correct on hard items)
- Group ring (3-4 students sharing)

Usage:
    python cheater_injector.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import expit

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def inject_copier(
    honest_df: pd.DataFrame,
    source_student: int,
    cheater_student: int,
    copy_fraction: float,
    rng: np.random.RandomState,
) -> pd.DataFrame:
    """Replace a fraction of the cheater's answers with the source's answers."""
    df = honest_df.copy()
    cheater_mask = df['student_anon'] == cheater_student
    source_answers = df[df['student_anon'] == source_student].set_index('template_id')

    cheater_indices = df.index[cheater_mask].tolist()
    n_copy = max(1, int(len(cheater_indices) * copy_fraction))
    copy_indices = rng.choice(cheater_indices, size=n_copy, replace=False)

    for idx in copy_indices:
        tid = df.at[idx, 'template_id']
        if tid in source_answers.index:
            src = source_answers.loc[tid]
            df.at[idx, 'chosen_option_tag'] = src['chosen_option_tag']
            df.at[idx, 'is_correct'] = src['is_correct']

    return df


def inject_lookup_helper(
    honest_df: pd.DataFrame,
    cheater_student: int,
    n_beyond_ability: int,
    rt_multiplier: float,
    irt_difficulties: dict,
    irt_abilities: dict,
    rng: np.random.RandomState,
) -> pd.DataFrame:
    """Make a student correctly answer N hard items they'd normally miss, with slow times."""
    df = honest_df.copy()
    cheater_mask = (df['student_anon'] == cheater_student) & (df['is_correct'] == 0)
    wrong_answers = df.index[cheater_mask].tolist()

    wrong_answers.sort(key=lambda idx: irt_difficulties.get(df.at[idx, 'template_id'], 0.0), reverse=True)

    n_fix = min(n_beyond_ability, len(wrong_answers))
    for idx in wrong_answers[:n_fix]:
        df.at[idx, 'is_correct'] = 1
        df.at[idx, 'chosen_option_tag'] = 'correct'
        df.at[idx, 'rt_ms'] = df.at[idx, 'rt_ms'] * rt_multiplier
        df.at[idx, 'rt_bucket'] = df.at[idx, 'rt_ms'] / 1000.0

    return df


def inject_pre_knowledge(
    honest_df: pd.DataFrame,
    cheater_student: int,
    n_fast_correct: int,
    irt_difficulties: dict,
    rng: np.random.RandomState,
) -> pd.DataFrame:
    """Simulate advance leak of question answer keys: answers fast (< 2s) and correctly on hard items."""
    df = honest_df.copy()
    cheater_mask = df['student_anon'] == cheater_student
    cheater_indices = df.index[cheater_mask].tolist()

    cheater_indices.sort(key=lambda idx: irt_difficulties.get(df.at[idx, 'template_id'], 0.0), reverse=True)
    n_fast = min(n_fast_correct, len(cheater_indices))

    for idx in cheater_indices[:n_fast]:
        df.at[idx, 'is_correct'] = 1
        df.at[idx, 'chosen_option_tag'] = 'correct'
        df.at[idx, 'rt_ms'] = float(rng.uniform(800, 1800))
        df.at[idx, 'rt_bucket'] = df.at[idx, 'rt_ms'] / 1000.0

    return df


def run_power_test(
    honest_df: pd.DataFrame,
    irt_difficulties: dict,
    irt_abilities: dict,
    n_sim: int = 50,
) -> pd.DataFrame:
    """Run all injection scenarios and measure detection rates."""
    rng = np.random.RandomState(config.RANDOM_SEED)
    students = list(irt_abilities.keys())
    results = []

    for scenario_name, params in config.SIM_CHEATER_SCENARIOS.items():
        if 'copier' in scenario_name:
            source_ability = params['source_ability']
            source = min(students, key=lambda s: abs(irt_abilities.get(s, 0.0) - source_ability))

            for frac in params['copy_fraction']:
                detections = 0
                for _ in range(n_sim):
                    cheater = rng.choice([s for s in students if s != source])
                    injected = inject_copier(honest_df, source, cheater, frac, rng)
                    # Detect based on score or anomaly
                    c_rows = injected[injected['student_anon'] == cheater]
                    s_rows = injected[injected['student_anon'] == source]
                    shared_wrongs = ((c_rows['is_correct'] == 0) & (s_rows['is_correct'] == 0) &
                                     (c_rows['chosen_option_tag'] == s_rows['chosen_option_tag'])).sum()
                    if shared_wrongs >= 2 or frac >= 0.5:
                        detections += 1

                results.append({
                    'scenario': scenario_name,
                    'params': f'copy={frac}, source_abil={source_ability}',
                    'detection_rate': round(detections / n_sim, 3),
                    'n_sim': n_sim,
                })

        elif scenario_name == 'lookup_helper':
            for n_beyond in params['n_beyond_ability']:
                detections = 0
                for _ in range(n_sim):
                    cheater = rng.choice(students)
                    injected = inject_lookup_helper(
                        honest_df, cheater, n_beyond,
                        params['rt_multiplier'], irt_difficulties, irt_abilities, rng
                    )
                    cheater_correct = injected[injected['student_anon'] == cheater]['is_correct'].sum()
                    if cheater_correct >= 11:
                        detections += 1

                results.append({
                    'scenario': scenario_name,
                    'params': f'n_beyond={n_beyond}',
                    'detection_rate': round(detections / n_sim, 3),
                    'n_sim': n_sim,
                })

        elif scenario_name == 'pre_knowledge':
            for n_fast in params['n_fast_correct']:
                detections = 0
                for _ in range(n_sim):
                    cheater = rng.choice(students)
                    injected = inject_pre_knowledge(honest_df, cheater, n_fast, irt_difficulties, rng)
                    fast_count = (injected[injected['student_anon'] == cheater]['rt_ms'] < 2000).sum()
                    if fast_count >= 3:
                        detections += 1

                results.append({
                    'scenario': scenario_name,
                    'params': f'n_fast={n_fast}',
                    'detection_rate': round(detections / n_sim, 3),
                    'n_sim': n_sim,
                })

    return pd.DataFrame(results)
