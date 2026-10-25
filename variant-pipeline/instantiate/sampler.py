# variant-pipeline/instantiate/sampler.py
"""
Deterministic parameter sampling with constraint checking.
Produces a list of parameter sets for each template.
"""

import random
import itertools
from typing import Optional
from pathlib import Path

import yaml

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from instantiate.constraints import check_constraints


def load_template(path: Path) -> dict:
    """Load a YAML template file."""
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def compute_derived_params(params: dict, template: dict) -> dict:
    """
    Compute derived parameters that the renderer needs.
    """
    derived = dict(params)

    for k, v in params.items():
        if isinstance(v, int):
            derived[f'{k}_minus_1'] = v - 1
            derived[f'{k}_plus_1'] = v + 1

    template_id = template.get('id', '')

    if 'rebase_count' in template_id:
        base = params.get('main_commits', 0)
        feat = params.get('feature_commits', 0)
        total = 1 + base + feat
        derived['total_after_rebase'] = total
        derived['wrong_count_1'] = total - 1
        derived['wrong_count_2'] = total + 1
        derived['wrong_count_3'] = total + 2

    return derived


def sample_variants(template: dict, seed: int = None) -> list[dict]:
    """
    Generate parameter sets for a template deterministically.
    """
    seed = seed or config.SEED
    rng = random.Random(seed + hash(template['id']))

    params_spec = template.get('parameters', [])
    constraints = template.get('constraints', [])
    n_variants = template.get('variant_count', config.VARIANTS_PER_QUESTION)

    if template.get('type') == 'static' or not params_spec:
        return [{}]

    has_paired = any('paired(' in c for c in constraints)

    if has_paired:
        param_names = [p['name'] for p in params_spec]
        param_values = [p['values'] for p in params_spec]

        min_len = min(len(v) for v in param_values)
        indices = list(range(min_len))
        rng.shuffle(indices)

        variants = []
        for idx in indices:
            params = {name: values[idx] for name, values in zip(param_names, param_values)}
            if check_constraints(params, constraints):
                variants.append(params)
                if len(variants) >= n_variants:
                    break
        return variants

    # Cartesian product sampling
    param_names = [p['name'] for p in params_spec]
    param_values = [p['values'] for p in params_spec]

    all_combos = list(itertools.product(*param_values))
    rng.shuffle(all_combos)

    variants = []
    for combo in all_combos:
        params = dict(zip(param_names, combo))
        if check_constraints(params, constraints):
            variants.append(params)
            if len(variants) >= n_variants:
                break

    return variants
