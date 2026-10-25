# variant-pipeline/sandbox/goals.py
"""
Goal predicate library.
Each predicate checks a specific aspect of the repo state.
Used by the validator to verify correct answers and reject distractors.
"""

import re
from typing import Optional

from sandbox.git_runner import GitSandbox, SandboxResult


class GoalCheckResult:
    def __init__(self, passed: bool, message: str, details: str = ''):
        self.passed = passed
        self.message = message
        self.details = details

    def __repr__(self):
        return f"{'✅' if self.passed else '❌'} {self.message}"


def check_commit_count(sandbox: GitSandbox, branch: str, expected: int) -> GoalCheckResult:
    """Check that a branch has exactly N commits."""
    result = sandbox.run_git(['rev-list', '--count', branch])
    if not result.success:
        return GoalCheckResult(False, f"Cannot count commits on {branch}", result.stderr)

    actual = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
    passed = actual == expected
    return GoalCheckResult(
        passed,
        f"commit_count({branch}) == {expected}",
        f"actual={actual}"
    )


def check_head_offset(sandbox: GitSandbox, branch: str, expected_offset: int) -> GoalCheckResult:
    """Check that HEAD has been moved by the expected offset."""
    result = sandbox.run_git(['rev-list', '--count', 'HEAD'])
    actual = int(result.stdout.strip()) if result.success and result.stdout.strip().isdigit() else 0
    return GoalCheckResult(
        True,
        f"head_offset({branch}): HEAD has {actual} commits",
        f"expected_offset={expected_offset}"
    )


def check_staged_files(sandbox: GitSandbox, expected_files: list[str]) -> GoalCheckResult:
    """Check that exactly these files are staged."""
    result = sandbox.run_git(['diff', '--cached', '--name-only'])
    if not result.success:
        return GoalCheckResult(False, "Cannot check staged files", result.stderr)

    actual = sorted([f for f in result.stdout.strip().split('\n') if f])
    expected = sorted(expected_files)
    passed = actual == expected
    return GoalCheckResult(
        passed,
        f"staged_files == {expected}",
        f"actual={actual}"
    )


def check_staged_files_count(sandbox: GitSandbox, expected_count: int) -> GoalCheckResult:
    """Check the number of staged files."""
    result = sandbox.run_git(['diff', '--cached', '--name-only'])
    if not result.success:
        return GoalCheckResult(False, "Cannot check staged files", result.stderr)

    actual = len([f for f in result.stdout.strip().split('\n') if f])
    passed = actual == expected_count
    return GoalCheckResult(
        passed,
        f"staged_files_count == {expected_count}",
        f"actual={actual}"
    )


def check_unstaged_files(sandbox: GitSandbox, expected_files: list[str]) -> GoalCheckResult:
    """Check that exactly these files have unstaged changes."""
    result = sandbox.run_git(['diff', '--name-only'])
    if not result.success:
        return GoalCheckResult(False, "Cannot check unstaged files", result.stderr)

    actual = sorted([f for f in result.stdout.strip().split('\n') if f])
    expected = sorted(expected_files)
    passed = actual == expected
    return GoalCheckResult(
        passed,
        f"unstaged_files == {expected}",
        f"actual={actual}"
    )


def check_worktree_clean(sandbox: GitSandbox, expected: bool = True) -> GoalCheckResult:
    """Check that the working tree is clean."""
    result = sandbox.run_git(['status', '--porcelain'])
    if not result.success:
        return GoalCheckResult(False, "Cannot check worktree", result.stderr)

    # Clean if porcelain output has no unstaged files (lines with second char != ' ')
    # For --soft reset, index has staged files (M  file) but worktree is clean
    lines = [l for l in result.stdout.strip().split('\n') if l]
    # Worktree dirty if there are unstaged changes (' M', '??', etc.)
    worktree_dirty = any(len(l) > 1 and l[1] != ' ' for l in lines)
    is_clean = not worktree_dirty

    passed = is_clean == expected
    return GoalCheckResult(
        passed,
        f"worktree_clean == {expected}",
        f"actual_clean={is_clean}"
    )


def check_branch_exists(sandbox: GitSandbox, name: str, expected: bool = True) -> GoalCheckResult:
    """Check that a branch exists (or doesn't)."""
    result = sandbox.run_git(['branch', '--list', name])
    exists = name in result.stdout
    passed = exists == expected
    return GoalCheckResult(
        passed,
        f"branch_exists({name}) == {expected}",
        f"actual_exists={exists}"
    )


def check_current_branch(sandbox: GitSandbox, expected: str) -> GoalCheckResult:
    """Check the current branch name."""
    result = sandbox.run_git(['branch', '--show-current'])
    actual = result.stdout.strip()
    passed = actual == expected
    return GoalCheckResult(
        passed,
        f"current_branch == {expected}",
        f"actual={actual}"
    )


def check_stash_count(sandbox: GitSandbox, expected: int) -> GoalCheckResult:
    """Check the number of stash entries."""
    result = sandbox.run_git(['stash', 'list'])
    lines = [l for l in result.stdout.strip().split('\n') if l]
    actual = len(lines)
    passed = actual == expected
    return GoalCheckResult(
        passed,
        f"stash_count == {expected}",
        f"actual={actual}"
    )


def check_branch_exists(sandbox: GitSandbox, name: str, expected: bool = True) -> GoalCheckResult:
    """Check that a branch exists (or doesn't)."""
    result = sandbox.run_git(['branch', '--list', name])
    branch_names = [line.strip().lstrip('* ').strip() for line in result.stdout.split('\n') if line.strip()]
    exists = name in branch_names
    passed = exists == expected
    return GoalCheckResult(
        passed,
        f"branch_exists({name}) == {expected}",
        f"actual_exists={exists}"
    )



def check_file_exists(sandbox: GitSandbox, path: str, expected: bool = True) -> GoalCheckResult:
    """Check that a file exists in the working tree."""
    full_path = sandbox.repo_dir / path
    exists = full_path.exists()
    passed = exists == expected
    return GoalCheckResult(
        passed,
        f"file_exists({path}) == {expected}",
        f"actual_exists={exists}"
    )


def check_file_content(sandbox: GitSandbox, path: str, expected: str) -> GoalCheckResult:
    """Check file content in the working tree."""
    full_path = sandbox.repo_dir / path
    if not full_path.exists():
        return GoalCheckResult(False, f"file_content({path})", "file does not exist")

    actual = full_path.read_text(errors='ignore').strip()
    passed = actual == expected.strip()
    return GoalCheckResult(
        passed,
        f"file_content({path}) == '{expected[:50]}'",
        f"actual='{actual[:50]}'"
    )


def check_branch_not_exists(sandbox: GitSandbox, name: str, expected: bool = True) -> GoalCheckResult:
    """Check that a branch does not exist."""
    res = check_branch_exists(sandbox, name, expected=False)
    passed = res.passed if expected else not res.passed
    return GoalCheckResult(passed, f"branch_not_exists({name}) == {expected}", res.details)


def check_tag_exists(sandbox: GitSandbox, name: str, expected: bool = True) -> GoalCheckResult:
    """Check that a tag exists."""
    result = sandbox.run_git(['tag', '--list', name])
    tags = [l.strip() for l in result.stdout.split('\n') if l.strip()]
    exists = name in tags
    passed = exists == expected
    return GoalCheckResult(
        passed,
        f"tag_exists({name}) == {expected}",
        f"actual_exists={exists}"
    )


def check_annotated_tag_exists(sandbox: GitSandbox, name: str, expected: bool = True) -> GoalCheckResult:

    """Check that a tag exists and is an annotated tag (not lightweight)."""
    if getattr(sandbox, '_has_native_git', False):
        res = sandbox.run_git(['cat-file', '-t', name])
        is_annotated = res.success and res.stdout.strip() == 'tag'
    else:
        v = getattr(sandbox, '_vstate', None)
        is_annotated = name in getattr(v, 'annotated_tags', set()) if v else False
    passed = is_annotated == expected
    return GoalCheckResult(passed, f"annotated_tag_exists({name}) == {expected}", f"actual_annotated={is_annotated}")


def check_stdout_lines(sandbox: GitSandbox, expected_lines: int) -> GoalCheckResult:
    """Check line count in the stdout of the last executed command."""
    last_res = getattr(sandbox, 'last_result', None)
    if not last_res or not last_res.success:
        return GoalCheckResult(False, f"stdout_lines == {expected_lines}", "No successful command executed")
    lines = [l for l in last_res.stdout.split('\n') if l.strip()]
    actual = len(lines)
    passed = actual == expected_lines
    return GoalCheckResult(passed, f"stdout_lines == {expected_lines}", f"actual_lines={actual}")


def check_merge_in_progress(sandbox: GitSandbox, expected: bool = True) -> GoalCheckResult:
    """Check if a git merge is currently in progress."""
    if getattr(sandbox, '_has_native_git', False):
        merge_head = sandbox.repo_dir / '.git' / 'MERGE_HEAD'
        in_progress = merge_head.exists()
    else:
        v = getattr(sandbox, '_vstate', None)
        in_progress = getattr(v, 'is_merging', False) if v else False
    passed = in_progress == expected
    return GoalCheckResult(passed, f"merge_in_progress == {expected}", f"actual={in_progress}")


def check_reverted_commit(sandbox: GitSandbox, target: str, expected: bool = True) -> GoalCheckResult:
    """Check that the latest commit is a revert of the target commit."""
    if getattr(sandbox, '_has_native_git', False):
        res = sandbox.run_git(['log', '-1', '--pretty=%B'])
        actual_msg = res.stdout.strip()
    else:
        v = getattr(sandbox, '_vstate', None)
        actual_msg = v.commits[-1]['message'] if (v and v.commits) else ''
    matches = target in actual_msg
    passed = matches == expected
    return GoalCheckResult(passed, f"reverted_commit({target}) == {expected}", f"actual_msg='{actual_msg}'")


PREDICATE_MAP = {
    'commit_count': check_commit_count,
    'head_offset': check_head_offset,
    'staged_files': check_staged_files,
    'staged_files_count': check_staged_files_count,
    'unstaged_files': check_unstaged_files,
    'worktree_clean': check_worktree_clean,
    'branch_exists': check_branch_exists,
    'branch_not_exists': check_branch_not_exists,
    'current_branch': check_current_branch,
    'stash_count': check_stash_count,
    'tag_exists': check_tag_exists,
    'annotated_tag_exists': check_annotated_tag_exists,
    'stdout_lines': check_stdout_lines,
    'last_command_stdout_lines': check_stdout_lines,
    'merge_in_progress': check_merge_in_progress,
    'reverted_commit': check_reverted_commit,
    'file_exists': check_file_exists,
    'file_content': check_file_content,
}




def parse_and_check_goal(sandbox: GitSandbox, goal_string: str,
                          params: dict = None) -> list[GoalCheckResult]:
    """Parse a goal string and evaluate all predicates."""
    params = params or {}
    results = []

    sub_goals = [g.strip() for g in goal_string.split(' AND ')]

    for sub_goal in sub_goals:
        # Match predicate(args)==expected or predicate==expected
        match = re.match(r'(\w+)(?:\(([^)]*)\))?\s*==\s*(.+)', sub_goal)
        if not match:
            results.append(GoalCheckResult(
                False, f"Cannot parse goal: '{sub_goal}'",
                "Expected format: predicate(args)==expected"
            ))
            continue

        predicate_name = match.group(1)
        args_str = match.group(2) or ''
        expected_str = match.group(3).strip()

        for k, v in params.items():
            args_str = args_str.replace(f'{{{k}}}', str(v))
            expected_str = expected_str.replace(f'{{{k}}}', str(v))

        if expected_str.lower() == 'true':
            expected = True
        elif expected_str.lower() == 'false':
            expected = False
        elif expected_str.isdigit():
            expected = int(expected_str)
        elif expected_str.startswith('[') and expected_str.endswith(']'):
            expected = [x.strip() for x in expected_str[1:-1].split(',') if x.strip()]
        else:
            expected = expected_str.strip('"').strip("'")

        args = [a.strip() for a in args_str.split(',') if a.strip()]

        if predicate_name not in PREDICATE_MAP:
            results.append(GoalCheckResult(
                False, f"Unknown predicate: '{predicate_name}'",
                f"Available: {list(PREDICATE_MAP.keys())}"
            ))
            continue

        try:
            predicate_fn = PREDICATE_MAP[predicate_name]
            if len(args) == 0:
                result = predicate_fn(sandbox, expected)
            elif len(args) == 1 and isinstance(expected, bool):
                result = predicate_fn(sandbox, args[0], expected)
            elif len(args) == 1:
                result = predicate_fn(sandbox, args[0], expected)
            else:
                result = predicate_fn(sandbox, *args)

            results.append(result)
        except Exception as e:
            results.append(GoalCheckResult(
                False, f"Error evaluating {predicate_name}", str(e)
            ))

    return results


def all_goals_passed(results: list[GoalCheckResult]) -> bool:
    """Check if all goal results passed."""
    return all(r.passed for r in results)
