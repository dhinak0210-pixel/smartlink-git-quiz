# variant-pipeline/tests/test_sampler.py
import pytest
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from instantiate.sampler import (
    sample_variants,
    check_constraints,
    compute_derived_params,
    load_template,
)


def test_sampler_determinism():
    template_path = BASE_DIR / 'templates' / 'q01_reset_soft.yaml'
    template = load_template(template_path)

    variants_run1 = sample_variants(template, seed=42)
    variants_run2 = sample_variants(template, seed=42)

    assert variants_run1 == variants_run2
    assert len(variants_run1) == 3


def test_sampler_paired_constraints():
    template_path = BASE_DIR / 'templates' / 'q02_branch_rename.yaml'
    template = load_template(template_path)

    variants = sample_variants(template, seed=42)
    assert len(variants) == 3
    for v in variants:
        assert v['old_name'] != v['new_name']
        assert v['new_name'].startswith(v['old_name']) or 'fix' in v['new_name'] or 'v2' in v['new_name'] or 'redesign' in v['new_name'] or 'update' in v['new_name'] or 'page' in v['new_name']


def test_derived_params():
    template_path = BASE_DIR / 'templates' / 'q03_rebase_count.yaml'
    template = load_template(template_path)

    params = {'main_commits': 4, 'feature_commits': 2}
    derived = compute_derived_params(params, template)

    # 1 (base) + 4 (main) + 2 (feature) = 7
    assert derived['total_after_rebase'] == 7
    assert 'wrong_count_1' in derived
    assert 'wrong_count_2' in derived
    assert 'wrong_count_3' in derived
    assert derived['wrong_count_1'] != 7
    assert derived['wrong_count_2'] != 7
    assert derived['wrong_count_3'] != 7
