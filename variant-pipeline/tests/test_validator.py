# variant-pipeline/tests/test_validator.py
import pytest
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from instantiate.sampler import load_template, sample_variants
from instantiate.renderer import render_variant
from validate.variant_checker import validate_variant
from validate.cross_variant import cross_variant_leak_test


def test_validator_accepts_good_variant():
    template_path = BASE_DIR / 'templates' / 'q01_reset_soft.yaml'
    template = load_template(template_path)
    sampled = sample_variants(template, seed=42)

    report = validate_variant(template, sampled[0])
    assert report.status == 'verified', f"Expected verified, got {report.status}. Errors: {report.errors}"
    assert report.correct_passes
    assert all(not d['passes_goal'] for d in report.distractor_results)


def test_validator_rejects_wrong_key():
    fixture_path = BASE_DIR / 'tests' / 'fixtures' / 'bad_wrong_key.yaml'
    template = load_template(fixture_path)
    sampled = sample_variants(template, seed=42)

    report = validate_variant(template, sampled[0])
    assert report.status == 'wrong_key', f"Expected wrong_key, got {report.status}"
    assert not report.correct_passes


def test_validator_rejects_two_correct_answers():
    fixture_path = BASE_DIR / 'tests' / 'fixtures' / 'bad_two_correct.yaml'
    template = load_template(fixture_path)
    sampled = sample_variants(template, seed=42)

    report = validate_variant(template, sampled[0])
    assert report.status == 'ambiguous', f"Expected ambiguous, got {report.status}"
    assert any(d['passes_goal'] for d in report.distractor_results)


def test_validator_rejects_leaking_answer():
    fixture_path = BASE_DIR / 'tests' / 'fixtures' / 'bad_leaking.yaml'
    template = load_template(fixture_path)
    sampled = sample_variants(template, seed=42)

    # Render variants
    rendered_variants = [render_variant(template, p) for p in sampled]
    sibling_answers = [v['correct'] for v in rendered_variants]

    # Validate variant 1 with sibling answer from variant 2
    report = validate_variant(template, sampled[0], sibling_correct_answers=sibling_answers)
    assert report.status == 'leaks_across_variants', f"Expected leaks_across_variants, got {report.status}"

    # Also test cross_variant_leak_test
    leak_results = cross_variant_leak_test(template, rendered_variants)
    assert any(lr['leaks'] for lr in leak_results)


def test_validator_rejects_unsafe_command():
    fixture_path = BASE_DIR / 'tests' / 'fixtures' / 'bad_unsafe_command.yaml'
    template = load_template(fixture_path)
    sampled = sample_variants(template, seed=42)

    report = validate_variant(template, sampled[0])
    assert report.status == 'unsafe_command', f"Expected unsafe_command, got {report.status}"


def test_all_ten_templates_verified():
    template_files = sorted((BASE_DIR / 'templates').glob('q*.yaml'))
    assert len(template_files) == 10, f"Expected 10 templates, found {len(template_files)}"

    for tpath in template_files:
        template = load_template(tpath)
        sampled = sample_variants(template, seed=42)
        assert len(sampled) >= 2, f"Template {template['id']} has fewer than 2 variants"

        for v in sampled:
            report = validate_variant(template, v)
            assert report.status == 'verified', (
                f"Template {template['id']} variant {v} failed validation with "
                f"status '{report.status}'. Errors: {report.errors}"
            )

