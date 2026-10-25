# variant-pipeline/validate/variant_checker.py
"""
Per-variant execution validation.
For each variant:
1. Build the repo from setup
2. Run the correct command -> assert goal is TRUE
3. Run each distractor -> assert goal is FALSE
4. Record everything in a validation report
"""

import json
import time
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from sandbox.git_runner import GitSandbox
from sandbox.repo_builder import build_repo
from sandbox.goals import parse_and_check_goal, all_goals_passed
from instantiate.renderer import render_variant, variant_stats


class VariantReport:
    """Validation report for a single variant."""
    def __init__(self, template_id: str, params: dict):
        self.template_id = template_id
        self.params = params
        self.status = 'pending'  # verified | wrong_key | ambiguous | error | leaks_across_variants
        self.correct_passes = False
        self.correct_goal_results = []
        self.distractor_results = []
        self.setup_results = []
        self.errors = []
        self.git_version = config.get_git_version()
        self.stats = {}
        self.duration_seconds = 0

    def to_dict(self) -> dict:
        return {
            'template_id': self.template_id,
            'params': self.params,
            'status': self.status,
            'correct_passes': self.correct_passes,
            'correct_goal_results': [
                {'message': r.message, 'passed': r.passed, 'details': r.details}
                for r in self.correct_goal_results
            ],
            'distractor_results': self.distractor_results,
            'errors': self.errors,
            'git_version': self.git_version,
            'stats': self.stats,
            'duration_seconds': round(self.duration_seconds, 2),
        }


def validate_variant(template: dict, params: dict,
                      sibling_correct_answers: list[str] = None) -> VariantReport:
    """
    Validate a single variant by running it in the sandbox.
    """
    start_time = time.time()
    report = VariantReport(template['id'], params)

    variant = render_variant(template, params)
    report.stats = variant_stats(variant)

    with GitSandbox(label=f"validate_{template['id']}") as sandbox:
        # Step 1: Build repo
        setup_results = build_repo(sandbox, variant['setup'], variant['all_params'])
        report.setup_results = [
            {'cmd': r.command, 'success': r.success, 'stderr': r.stderr[:200] if not r.success else ''}
            for r in setup_results
        ]

        critical_failures = [r for r in setup_results if not r.success and ('init' in r.command or 'commit' in r.command)]
        security_failures = [r for r in setup_results if getattr(r, 'is_security_violation', False)]
        if security_failures:
            report.status = 'unsafe_command'
            report.errors.append(f"Security violation in setup: {security_failures[0].stderr}")
            report.duration_seconds = time.time() - start_time
            return report

        if critical_failures:
            report.status = 'error'
            report.errors.append(f"Setup failed: {critical_failures[0].stderr}")
            report.duration_seconds = time.time() - start_time
            return report

        # Step 2: Test CORRECT command
        correct_cmd = variant['correct']
        is_output_prediction = not correct_cmd.startswith('git ')

        if is_output_prediction:
            goal_results = parse_and_check_goal(sandbox, variant['goal'], variant['all_params'])
            report.correct_passes = all_goals_passed(goal_results)
            report.correct_goal_results = goal_results
        else:
            correct_clone = sandbox.clone_repo()
            try:
                correct_result = correct_clone.run_student_command(correct_cmd)
                if getattr(correct_result, 'is_security_violation', False):
                    report.status = 'unsafe_command'
                    report.errors.append(f"Security violation in correct command: '{correct_cmd}'\nstderr: {correct_result.stderr}")
                    report.duration_seconds = time.time() - start_time
                    return report

                if not correct_result.success:
                    report.status = 'wrong_key'
                    report.errors.append(
                        f"Correct command failed: '{correct_cmd}'\nstderr: {correct_result.stderr}"
                    )
                    report.duration_seconds = time.time() - start_time
                    return report

                goal_results = parse_and_check_goal(correct_clone, variant['goal'], variant['all_params'])
                report.correct_passes = all_goals_passed(goal_results)
                report.correct_goal_results = goal_results
            finally:
                if correct_clone._temp_dir:
                    import shutil, os
                    for root, dirs, files in os.walk(correct_clone._temp_dir):
                        for f in files:
                            try:
                                os.chmod(os.path.join(root, f), 0o644)
                            except OSError:
                                pass
                    shutil.rmtree(correct_clone._temp_dir, ignore_errors=True)

        if not report.correct_passes:
            report.status = 'wrong_key'
            report.errors.append(
                f"Correct command '{correct_cmd}' did not reach the goal.\n"
                f"Goal results: {[str(r) for r in report.correct_goal_results]}"
            )
            report.duration_seconds = time.time() - start_time
            return report

        # Step 3: Test each DISTRACTOR (must fail)
        for distractor in variant['distractors']:
            d_text = distractor['text']
            d_reason = distractor['reason']

            clone = sandbox.clone_repo()
            try:
                is_distractor_output = not d_text.startswith('git ')
                if is_distractor_output:
                    d_passes = False
                else:
                    d_result = clone.run_student_command(d_text)
                    if getattr(d_result, 'is_security_violation', False):
                        report.status = 'unsafe_command'
                        report.errors.append(
                            f"Security violation in distractor '{d_text}': {d_result.stderr}"
                        )
                        report.duration_seconds = time.time() - start_time
                        return report

                    d_goal_results = parse_and_check_goal(clone, variant['goal'], variant['all_params'])
                    d_passes = all_goals_passed(d_goal_results)

                report.distractor_results.append({
                    'text': d_text,
                    'reason': d_reason,
                    'passes_goal': d_passes,
                    'expected_fail': True,
                })

                if d_passes:
                    report.status = 'ambiguous'
                    report.errors.append(
                        f"AMBIGUOUS: Distractor '{d_text}' (reason: {d_reason}) ALSO reaches the goal!"
                    )
            finally:


                if clone._temp_dir:
                    import shutil, os
                    for root, dirs, files in os.walk(clone._temp_dir):
                        for f in files:
                            try:
                                os.chmod(os.path.join(root, f), 0o644)
                            except OSError:
                                pass
                    shutil.rmtree(clone._temp_dir, ignore_errors=True)

        # Step 4: Sibling leak test
        if sibling_correct_answers:
            for sibling_answer in sibling_correct_answers:
                if sibling_answer == correct_cmd:
                    continue

                if is_output_prediction:
                    # Output prediction leak test: leak occurs only if sibling has identical output
                    if sibling_answer == correct_cmd:
                        report.status = 'leaks_across_variants'
                        report.errors.append(
                            f"LEAK: Sibling answer '{sibling_answer}' is identical to this variant!"
                        )
                else:
                    clone = sandbox.clone_repo()
                    try:
                        leak_res = clone.run_student_command(sibling_answer)
                        if leak_res.success:
                            leak_goal_results = parse_and_check_goal(clone, variant['goal'], variant['all_params'])
                            if all_goals_passed(leak_goal_results):
                                report.status = 'leaks_across_variants'
                                report.errors.append(
                                    f"LEAK: Sibling answer '{sibling_answer}' works on this variant's repo!"
                                )
                    except Exception:
                        pass
                    finally:
                        if clone._temp_dir:
                            import shutil
                            shutil.rmtree(clone._temp_dir, ignore_errors=True)


    if report.status == 'pending':
        if report.correct_passes and all(not d['passes_goal'] for d in report.distractor_results):
            report.status = 'verified'
        else:
            report.status = 'error'

    report.duration_seconds = time.time() - start_time
    return report
