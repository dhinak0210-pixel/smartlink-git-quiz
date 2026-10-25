# variant-pipeline/tests/test_quality.py
import pytest
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from instantiate.sampler import load_template, sample_variants
from instantiate.renderer import render_variant, variant_stats
from validate.quality_gates import check_quality_gates


def test_quality_gates_on_q01():
    template_path = BASE_DIR / 'templates' / 'q01_reset_soft.yaml'
    template = load_template(template_path)
    sampled = sample_variants(template, seed=42)

    stats_list = []
    for params in sampled:
        variant = render_variant(template, params)
        stats_list.append(variant_stats(variant))

    gates = check_quality_gates('q01_reset_soft', stats_list)

    # Option count parity, distractor parity, setup steps parity, stem length diff tolerance
    for g in gates:
        assert g['passed'], f"Gate {g['gate']} failed: {g['details']}"


def test_quality_gates_reject_distractor_mismatch():
    stats_list = [
        {
            'stem_words': 12,
            'stem_chars': 60,
            'option_count': 4,
            'option_lengths': [20, 20, 20, 20],
            'avg_option_length': 20.0,
            'distractor_reasons': ['destroys_changes', 'leaves_unstaged', 'wrong_count'],
            'setup_steps': 2,
        },
        {
            'stem_words': 12,
            'stem_chars': 60,
            'option_count': 4,
            'option_lengths': [20, 20, 20, 20],
            'avg_option_length': 20.0,
            'distractor_reasons': ['destroys_changes', 'wrong_flag', 'wrong_count'],  # mismatch!
            'setup_steps': 2,
        }
    ]

    gates = check_quality_gates('test_mismatch', stats_list)
    distractor_gate = next(g for g in gates if g['gate'] == 'distractor_parity')
    assert not distractor_gate['passed']
