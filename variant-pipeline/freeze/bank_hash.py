# variant-pipeline/freeze/bank_hash.py
"""
Cryptographic bank freeze & integrity hashing.
Computes SHA-256 digest over sorted, canonicalized question bank variants.
"""

import hashlib
import json
from pathlib import Path
from typing import Union, Dict, List


class BankHashResult(dict):
    """Dictionary holding hash result that stringifies to the digest."""
    def __str__(self):
        return self.get('hash', '')


def compute_bank_hash(bank_input: Union[Dict[str, List[dict]], Path, str] = None) -> BankHashResult:
    """
    Computes a canonical SHA-256 digest over the validated variant bank.
    Accepts either a dict of variants or a Path to the templates directory.
    """
    from instantiate.sampler import load_template, sample_variants
    from instantiate.renderer import render_variant

    if bank_input is None:
        from config import TEMPLATES_DIR
        bank_input = TEMPLATES_DIR

    canonical_items = []

    if isinstance(bank_input, (str, Path)):
        p = Path(bank_input)
        template_files = sorted(p.glob('*.yaml'))
        for tf in template_files:
            template = load_template(tf)
            tid = template['id']
            sampled = sample_variants(template, seed=42)
            sorted_variants = []
            for v_params in sampled:
                v = render_variant(template, v_params)
                sorted_variants.append({
                    'stem': v.get('stem', '').strip(),
                    'correct': v.get('correct', '').strip(),
                    'distractors': sorted([d['text'].strip() for d in v.get('distractors', [])]),
                    'params': {k: str(v['params'][k]) for k in sorted(v.get('params', {}).keys())}
                })
            canonical_items.append({
                'template_id': tid,
                'variants': sorted_variants
            })
    elif isinstance(bank_input, dict):
        for template_id in sorted(bank_input.keys()):
            variants = bank_input[template_id]
            sorted_variants = []
            for v in variants:
                sorted_variants.append({
                    'stem': v.get('stem', '').strip(),
                    'correct': v.get('correct', '').strip(),
                    'distractors': sorted([d['text'].strip() for d in v.get('distractors', [])]),
                    'params': {k: str(v['params'][k]) for k in sorted(v.get('params', {}).keys())}
                })
            canonical_items.append({
                'template_id': template_id,
                'variants': sorted_variants
            })

    serialized = json.dumps(canonical_items, sort_keys=True)
    digest = hashlib.sha256(serialized.encode('utf-8')).hexdigest()

    return BankHashResult({
        'hash': digest,
        'total_templates': len(canonical_items),
        'serialized': serialized
    })
