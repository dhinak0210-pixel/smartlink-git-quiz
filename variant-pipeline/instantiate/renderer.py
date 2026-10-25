# variant-pipeline/instantiate/renderer.py
"""
Render a template + parameter set into a concrete variant.
Fills in all {param} placeholders in stem, correct, distractors, explanation.
"""

import re
from typing import Optional
from instantiate.sampler import compute_derived_params


def render_string(template_str: str, params: dict) -> str:
    """Replace all {param} placeholders with their values."""
    result = str(template_str)
    for key, value in params.items():
        result = result.replace(f'{{{key}}}', str(value))
    return result


def render_variant(template: dict, params: dict) -> dict:
    """
    Render a complete variant from a template and parameter set.
    """
    all_params = compute_derived_params(params, template)

    variant = {
        'template_id': template['id'],
        'params': params,
        'all_params': all_params,
        'topic': template['topic'],
        'difficulty': template['difficulty'],
        'type': template.get('type', 'variant'),
    }

    variant['stem'] = render_string(template['stem'], all_params)
    variant['correct'] = render_string(template['correct'], all_params)

    variant['distractors'] = []
    for d in template.get('distractors', []):
        variant['distractors'].append({
            'text': render_string(d['text'], all_params),
            'reason': d['reason'],
        })

    variant['setup'] = [
        render_string(cmd, all_params)
        for cmd in template.get('setup', [])
    ]

    variant['goal'] = render_string(template['goal'], all_params)
    variant['explanation'] = render_string(
        template.get('explanation', ''), all_params
    )

    return variant


def count_words(text: str) -> int:
    """Count words in a string (for quality gate checks)."""
    clean = re.sub(r'`[^`]+`', 'X', text)
    return len(clean.split())


def variant_stats(variant: dict) -> dict:
    """Compute structural stats for quality gate comparison."""
    option_texts = [variant['correct']] + [d['text'] for d in variant['distractors']]
    option_lengths = [len(t) for t in option_texts]

    return {
        'stem_words': count_words(variant['stem']),
        'stem_chars': len(variant['stem']),
        'option_count': len(option_texts),
        'option_lengths': option_lengths,
        'avg_option_length': sum(option_lengths) / len(option_lengths) if option_lengths else 0,
        'distractor_reasons': sorted([d['reason'] for d in variant['distractors']]),
        'setup_steps': len(variant['setup']),
    }
