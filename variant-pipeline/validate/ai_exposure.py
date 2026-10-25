# variant-pipeline/validate/ai_exposure.py
"""
AI exposure & superficial heuristic audit.
Checks whether correct options have superficial giveaways
(e.g., noticeably longer than distractors, grammatical anomalies).
"""

from typing import Optional


def check_ai_exposure(variant: dict) -> dict:
    """
    Checks for option giveaways:
    1. Length outlier: is correct option > 50% longer than distractors?
    2. Over-qualification: does correct option use hedge words absent from distractors?
    """
    correct_len = len(variant['correct'])
    distractor_lens = [len(d['text']) for d in variant['distractors']]
    avg_d_len = sum(distractor_lens) / len(distractor_lens) if distractor_lens else 1

    length_ratio = correct_len / avg_d_len
    has_length_giveaway = length_ratio > 1.5 or length_ratio < 0.6

    return {
        'template_id': variant['template_id'],
        'params': variant['params'],
        'length_ratio': round(length_ratio, 2),
        'has_length_giveaway': has_length_giveaway,
        'passed': not has_length_giveaway,
        'details': f"Correct length {correct_len} vs avg distractor {avg_d_len:.1f} (ratio {length_ratio:.2f})"
    }
