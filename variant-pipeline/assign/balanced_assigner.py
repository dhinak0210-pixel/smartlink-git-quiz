# variant-pipeline/assign/balanced_assigner.py
"""
Fair, balanced variant assignment engine.
Ensures equal distribution of variants across the student cohort while
decorrelating adjacent seat assignments.
"""

import random
from typing import List, Dict

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def assign_variants_to_students(
    student_ids: List[str],
    templates_with_variants: Dict[str, List[dict]],
    seed: int = None
) -> List[dict]:
    """
    Distributes variants evenly across students.

    Returns:
    [
      {
        'student_id': str,
        'template_id': str,
        'variant_index': int,
        'variant_params': dict,
        'question_stem': str
      }, ...
    ]
    """
    seed = seed or config.SEED
    rng = random.Random(seed)

    assignments = []
    shuffled_students = list(student_ids)

    for template_id, variants in templates_with_variants.items():
        if not variants:
            continue

        n_variants = len(variants)
        # Create a repeating balanced list of variant indices
        variant_indices = []
        while len(variant_indices) < len(shuffled_students):
            block = list(range(n_variants))
            rng.shuffle(block)
            variant_indices.extend(block)

        variant_indices = variant_indices[:len(shuffled_students)]

        for i, s_id in enumerate(shuffled_students):
            v_idx = variant_indices[i]
            selected_variant = variants[v_idx]
            assignments.append({
                'student_id': s_id,
                'template_id': template_id,
                'variant_index': v_idx,
                'variant_params': selected_variant.get('params', {}),
                'question_stem': selected_variant.get('stem', '')
            })

    return assignments
