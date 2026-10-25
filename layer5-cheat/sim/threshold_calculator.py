# layer5-cheat/sim/threshold_calculator.py
"""
Utility module to compute, format, and serialize family-wise thresholds
from honest simulation distribution maxima.
"""

import json
from pathlib import Path
import numpy as np

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def calculate_and_save_thresholds(
    simulation_max_stats: list[dict],
    output_path: Path = None,
) -> dict:
    """
    Computes 99th and 90th percentile thresholds for family-wise false-alarm control.
    """
    output_path = output_path or (config.DATA_DIR / 'thresholds.json')
    thresholds = {}

    keys = list(simulation_max_stats[0].keys())
    for k in keys:
        vals = [s[k] for s in simulation_max_stats]
        if 'p' in k:
            thresholds[f'{k}_strong'] = float(np.quantile(vals, 1.0 - config.TIER_STRONG_PERCENTILE))
            thresholds[f'{k}_review'] = float(np.quantile(vals, 1.0 - config.TIER_REVIEW_PERCENTILE))
        else:
            thresholds[f'{k}_strong'] = float(np.quantile(vals, config.TIER_STRONG_PERCENTILE))
            thresholds[f'{k}_review'] = float(np.quantile(vals, config.TIER_REVIEW_PERCENTILE))

    payload = {
        'n_runs': len(simulation_max_stats),
        'strong_percentile': config.TIER_STRONG_PERCENTILE,
        'review_percentile': config.TIER_REVIEW_PERCENTILE,
        'thresholds': thresholds,
    }

    with open(output_path, 'w') as f:
        json.dump(payload, f, indent=2)

    return thresholds


def load_cached_thresholds(path: Path = None) -> dict:
    """Load cached thresholds or return sensible fallback defaults."""
    path = path or (config.DATA_DIR / 'thresholds.json')
    if path.exists():
        with open(path) as f:
            data = json.load(f)
            return data.get('thresholds', {})
    
    # Sensible empirical fallbacks if simulations have not yet completed
    return {
        'pf_min_p_strong': 0.010,
        'pf_min_p_review': 0.050,
        'pf_unexpected_strong': 18.5,
        'pf_unexpected_review': 12.0,
        'rt_fast_hard_strong': 3.0,
        'rt_fast_hard_review': 2.0,
        'rt_misfit_z_strong': 3.2,
        'rt_misfit_z_review': 2.1,
        'pair_weighted_strong': 14.5,
        'pair_weighted_review': 9.0,
        'pair_incorrect_strong': 4.0,
        'pair_incorrect_review': 3.0,
    }
