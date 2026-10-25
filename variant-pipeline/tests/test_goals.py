# variant-pipeline/tests/test_goals.py
import pytest
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from sandbox.git_runner import GitSandbox
from sandbox.goals import (
    check_commit_count,
    check_staged_files_count,
    check_worktree_clean,
    check_branch_exists,
    check_file_exists,
    parse_and_check_goal,
    all_goals_passed
)


def test_goal_commit_count():
    with GitSandbox(label="test_goal_commits") as sb:
        sb.run_git(['init'])
        (sb.repo_dir / 'a.txt').write_text("a")
        sb.run_git(['add', 'a.txt'])
        sb.run_git(['commit', '-m', 'commit a'])

        res_pass = check_commit_count(sb, 'main', 1)
        assert res_pass.passed

        res_fail = check_commit_count(sb, 'main', 2)
        assert not res_fail.passed


def test_goal_staged_and_worktree():
    with GitSandbox(label="test_goal_staged") as sb:
        sb.run_git(['init'])
        (sb.repo_dir / 'init.txt').write_text("init")
        sb.run_git(['add', 'init.txt'])
        sb.run_git(['commit', '-m', 'init'])

        (sb.repo_dir / 'staged.txt').write_text("staged content")
        sb.run_git(['add', 'staged.txt'])

        res_staged = check_staged_files_count(sb, 1)
        assert res_staged.passed

        # Working tree has staged changes, but no unstaged modifications
        res_worktree = check_worktree_clean(sb, True)
        assert res_worktree.passed


def test_parse_and_check_multi_goal():
    with GitSandbox(label="test_multi_goal") as sb:
        sb.run_git(['init'])
        (sb.repo_dir / 'doc.md').write_text("documentation")
        sb.run_git(['add', 'doc.md'])
        sb.run_git(['commit', '-m', 'add doc'])
        sb.run_git(['branch', 'feature-doc'])

        goal_str = "commit_count(main)==1 AND branch_exists(feature-doc)==true AND file_exists(doc.md)==true"
        results = parse_and_check_goal(sb, goal_str)
        assert all_goals_passed(results)

        failing_goal = "commit_count(main)==5 AND branch_exists(nonexistent)==true"
        fail_results = parse_and_check_goal(sb, failing_goal)
        assert not all_goals_passed(fail_results)
