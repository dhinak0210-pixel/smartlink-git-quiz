# layer5-cheat/sim/honest_simulator.py
"""
Simulate honest classes to calibrate detection thresholds.

For each of N runs:
1. Generate 200 honest students from the fitted Rasch + RT models
2. Run all three detectors
3. Record the MAXIMUM statistic per detector across all students/pairs

The 99th percentile of each maximum -> Strong threshold
The 90th percentile -> Review threshold

This directly controls the family-wise false alarm rate.

Usage:
    python honest_simulator.py --runs 1000 --output thresholds.json
    python honest_simulator.py --runs 300 --output thresholds_fast.json  # Event day
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import expit

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from detectors.person_fit import run_person_fit_detector
from detectors.response_time import compute_timing_signals
from detectors.pair_similarity import compute_pair_similarity
from models.option_probabilities import estimate_option_probabilities


def simulate_honest_class(
    irt_difficulties: dict,
    irt_abilities: dict,
    variant_assignments: dict,
    option_probs: dict,
    rt_model: dict,
    seed: int,
) -> dict:
    """
    Simulate one honest class of 200 students.

    Returns the maximum statistic per detector across all students and pairs.
    """
    rng = np.random.RandomState(seed)

    templates = list(irt_difficulties.keys())
    students = list(irt_abilities.keys())

    rows = []
    for sid in students:
        ability = irt_abilities[sid]

        for tid in templates:
            diff = irt_difficulties[tid]
            vid = variant_assignments.get((sid, tid), tid)

            p_correct = expit(ability - diff)
            correct = int(rng.random() < p_correct)

            lambda_j = rt_model['item_intensity'].get(vid, 9.0)
            tau_i = rt_model['student_speed'].get(sid, 0.0)
            sigma_j = rt_model['item_sigma'].get(vid, 0.4)
            log_rt = lambda_j - tau_i + rng.normal(0, sigma_j)
            rt_ms = max(500.0, np.exp(log_rt))

            if correct:
                option = 'correct'
            else:
                band = min(int((ability + 3.0) / 6.0 * config.PAIR_ABILITY_BANDS),
                           config.PAIR_ABILITY_BANDS - 1)
                band = max(band, 0)
                if vid in option_probs and band in option_probs[vid]:
                    wrong_opts = {k: v for k, v in option_probs[vid][band].items() if k != 'correct'}
                    if wrong_opts:
                        opts = list(wrong_opts.keys())
                        probs = np.array(list(wrong_opts.values()), dtype=float)
                        probs /= probs.sum()
                        option = rng.choice(opts, p=probs)
                    else:
                        option = 'wrong'
                else:
                    option = 'wrong'

            rows.append({
                'student_anon': sid,
                'template_id': tid,
                'variant_id': vid,
                'chosen_option_tag': option,
                'is_correct': correct,
                'status': 'answered',
                'rt_ms': rt_ms,
                'rt_bucket': rt_ms / 1000.0,
                'review_status': 'clear',
                'topic': 'simulated',
                'difficulty_label': 'medium',
                'position': templates.index(tid) + 1,
            })

    sim_df = pd.DataFrame(rows)

    max_stats = {}

    # 1. Person-fit
    pf_results = run_person_fit_detector(sim_df, irt_difficulties)
    if len(pf_results) > 0:
        max_stats['pf_min_p'] = float(pf_results['min_p'].min())
        max_stats['pf_unexpected'] = float(pf_results['unexpected_hit'].max())
    else:
        max_stats['pf_min_p'] = 1.0
        max_stats['pf_unexpected'] = 0.0

    # 2. Response time
    rt_results = compute_timing_signals(sim_df, pd.DataFrame(), irt_difficulties, irt_abilities)
    if len(rt_results) > 0:
        max_stats['rt_fast_hard'] = int(rt_results['n_fast_correct_hard'].max())
        max_stats['rt_misfit_z'] = float(rt_results['misfit_z'].max())
    else:
        max_stats['rt_fast_hard'] = 0
        max_stats['rt_misfit_z'] = 0.0

    # 3. Pair similarity
    opt_probs_sim = estimate_option_probabilities(sim_df, irt_abilities)
    pair_results = compute_pair_similarity(sim_df, irt_abilities, opt_probs_sim)
    if len(pair_results) > 0:
        max_stats['pair_weighted'] = float(pair_results['weighted_match_score'].max())
        max_stats['pair_incorrect'] = int(pair_results['incorrect_matches'].max())
    else:
        max_stats['pair_weighted'] = 0.0
        max_stats['pair_incorrect'] = 0

    return max_stats


def compute_thresholds(
    all_max_stats: list[dict],
) -> dict:
    """
    Compute Strong and Review thresholds from simulation maxima.
    """
    thresholds = {}

    for key in all_max_stats[0].keys():
        values = [s[key] for s in all_max_stats]

        if 'p' in key:
            thresholds[f'{key}_strong'] = float(np.quantile(values, 1.0 - config.TIER_STRONG_PERCENTILE))
            thresholds[f'{key}_review'] = float(np.quantile(values, 1.0 - config.TIER_REVIEW_PERCENTILE))
        else:
            thresholds[f'{key}_strong'] = float(np.quantile(values, config.TIER_STRONG_PERCENTILE))
            thresholds[f'{key}_review'] = float(np.quantile(values, config.TIER_REVIEW_PERCENTILE))

    return thresholds


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runs', type=int, default=config.SIM_HONEST_RUNS_FAST)
    parser.add_argument('--output', type=str, default='thresholds.json')
    args = parser.parse_args()

    print(f"{'=' * 60}")
    print(f"HONEST-CLASS SIMULATION ({args.runs} runs)")
    print(f"{'=' * 60}")

    irt_path = config.DATA_DIR / 'irt_params.json'
    if irt_path.exists():
        with open(irt_path) as f:
            irt_data = json.load(f)
        difficulties = {f'q{i+1}': p.get('difficulty', 0.0)
                        for i, p in enumerate(irt_data.get('item_params', []))}
        abilities = {i+1: p.get('ability', 0.0)
                     for i, p in enumerate(irt_data.get('person_params', []) or [])}
    else:
        print("⚠️  No IRT params found. Using standard parameters.")
        difficulties = {f'q{i+1}': float(np.linspace(-2, 2, 15)[i]) for i in range(15)}
        abilities = {i+1: float(np.random.normal(0, 1)) for i in range(200)}

    if not abilities:
        abilities = {i+1: float(np.random.normal(0, 1)) for i in range(200)}

    variant_assignments = {(sid, tid): tid for sid in abilities for tid in difficulties}

    rt_model = {
        'item_intensity': {tid: 9.0 for tid in difficulties},
        'student_speed': {sid: 0.0 for sid in abilities},
        'item_sigma': {tid: 0.4 for tid in difficulties},
    }
    option_probs = {}

    print(f"Students: {len(abilities)}, Questions: {len(difficulties)}")
    print(f"Running {args.runs} simulations...\n")

    all_max_stats = []
    for run in range(args.runs):
        if (run + 1) % 50 == 0:
            print(f"  Run {run + 1}/{args.runs}")

        stats = simulate_honest_class(
            difficulties, abilities, variant_assignments,
            option_probs, rt_model, seed=config.RANDOM_SEED + run
        )
        all_max_stats.append(stats)

    thresholds = compute_thresholds(all_max_stats)

    output_path = config.DATA_DIR / args.output
    with open(output_path, 'w') as f:
        json.dump({
            'n_runs': args.runs,
            'n_students': len(abilities),
            'n_questions': len(difficulties),
            'thresholds': thresholds,
        }, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"THRESHOLDS (family-wise)")
    print(f"{'=' * 60}")
    for k, v in sorted(thresholds.items()):
        print(f"  {k}: {v:.4f}")
    print(f"\n✅ Saved to {output_path}")


if __name__ == '__main__':
    main()
