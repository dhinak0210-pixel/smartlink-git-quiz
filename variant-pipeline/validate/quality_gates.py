# variant-pipeline/validate/quality_gates.py
"""
Quality gates that check structural equality across sibling variants.
Ensures fairness: variants differ only in surface parameters.
"""

from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from instantiate.renderer import variant_stats


def check_quality_gates(template_id: str,
                         variant_stats_list: list[dict]) -> list[dict]:
    """
    Run all quality gates on a set of sibling variants.
    """
    results = []

    if len(variant_stats_list) < 2:
        results.append({
            'gate': 'sibling_count',
            'passed': False,
            'details': f'Only {len(variant_stats_list)} variant(s). Need at least 2.'
        })
        return results

    # Gate 1: Option count
    option_counts = [s['option_count'] for s in variant_stats_list]
    results.append({
        'gate': 'option_count',
        'passed': len(set(option_counts)) == 1,
        'details': f'Option counts: {option_counts}'
    })

    # Gate 2: Stem length tolerance
    stem_words = [s['stem_words'] for s in variant_stats_list]
    max_stem = max(stem_words)
    min_stem = min(stem_words)
    diff_pct = ((max_stem - min_stem) / max_stem * 100) if max_stem > 0 else 0

    results.append({
        'gate': 'stem_length',
        'passed': diff_pct <= config.MAX_STEM_LENGTH_DIFF_PCT,
        'details': f'Stem words: {stem_words}, diff: {diff_pct:.1f}% (limit: {config.MAX_STEM_LENGTH_DIFF_PCT}%)'
    })

    # Gate 3: Average option length tolerance
    avg_lengths = [s['avg_option_length'] for s in variant_stats_list]
    max_avg = max(avg_lengths)
    min_avg = min(avg_lengths)
    diff_pct_opt = ((max_avg - min_avg) / max_avg * 100) if max_avg > 0 else 0

    results.append({
        'gate': 'option_length',
        'passed': diff_pct_opt <= config.MAX_OPTION_LENGTH_DIFF_PCT,
        'details': f'Avg option lengths: {[round(l, 1) for l in avg_lengths]}, diff: {diff_pct_opt:.1f}%'
    })

    # Gate 4: Distractor parity (reason tags)
    reason_sets = [tuple(s['distractor_reasons']) for s in variant_stats_list]
    results.append({
        'gate': 'distractor_parity',
        'passed': len(set(reason_sets)) == 1,
        'details': f'Distractor parity: {len(set(reason_sets)) == 1}'
    })

    # Gate 5: Setup steps parity
    setup_steps = [s['setup_steps'] for s in variant_stats_list]
    results.append({
        'gate': 'setup_steps',
        'passed': len(set(setup_steps)) == 1,
        'details': f'Setup steps: {setup_steps}'
    })

    return results
