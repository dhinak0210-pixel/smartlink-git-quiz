# variant-pipeline/validate/cross_variant.py
"""
Cross-variant leak test.
For every pair of sibling variants (A, B):
  Build B's repo, run A's correct command, assert goal is FALSE.
If it passes, the answer leaks across variants.
"""

import itertools
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from sandbox.git_runner import GitSandbox
from sandbox.repo_builder import build_repo
from sandbox.goals import parse_and_check_goal, all_goals_passed
from instantiate.renderer import render_variant


def cross_variant_leak_test(template: dict,
                             variants: list[dict]) -> list[dict]:
    """
    Test every pair of variants for answer leakage.
    """
    results = []
    variant_pairs = list(itertools.permutations(range(len(variants)), 2))

    for i, j in variant_pairs:
        var_a = variants[i]
        var_b = variants[j]

        correct_a = var_a['correct']
        is_output = not correct_a.startswith('git ')

        if is_output:
            leak = (correct_a == var_b['correct'])
            results.append({
                'variant_a_params': var_a['params'],
                'variant_b_params': var_b['params'],
                'answer_a': correct_a,
                'leaks': leak,
                'reason': 'same_output_value' if leak else 'different_output',
            })
            continue

        if correct_a == var_b['correct']:
            # Identical correct answers across siblings is an automatic leak
            results.append({
                'variant_a_params': var_a['params'],
                'variant_b_params': var_b['params'],
                'answer_a': correct_a,
                'command_succeeded': True,
                'passes_b_goal': True,
                'leaks': True,
                'goal_details': ['identical_correct_answer'],
            })
            continue

        with GitSandbox(label=f"leak_{i}_{j}") as sandbox:
            build_repo(sandbox, var_b['setup'], var_b['all_params'])
            result = sandbox.run_student_command(correct_a)
            passes_b_goal = False
            goal_details = []
            if result.success:
                goal_results = parse_and_check_goal(
                    sandbox, var_b['goal'], var_b['all_params']
                )
                passes_b_goal = all_goals_passed(goal_results)
                goal_details = [str(r) for r in goal_results]

            results.append({
                'variant_a_params': var_a['params'],
                'variant_b_params': var_b['params'],
                'answer_a': correct_a,
                'command_succeeded': result.success,
                'passes_b_goal': passes_b_goal,
                'leaks': passes_b_goal,
                'goal_details': goal_details,
            })


    return results
