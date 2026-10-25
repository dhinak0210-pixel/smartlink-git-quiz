# variant-pipeline/tests/test_git_runner.py
import pytest
from pathlib import Path
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

from sandbox.git_runner import GitSandbox, SandboxResult
from sandbox.safety import sanitize_command, UnsafeCommandError, SecurityViolationError


def test_sandbox_lifecycle():
    with GitSandbox(label="test_cycle") as sb:
        assert sb.repo_dir.exists()
        repo_path = sb.repo_dir
    # Sandbox temp dir should be cleaned up after exit
    assert not repo_path.exists()


def test_sandbox_git_init_and_commit():
    with GitSandbox(label="test_commit") as sb:
        res_init = sb.run_git(['init'])
        assert res_init.success

        # Write test file
        test_file = sb.repo_dir / 'hello.txt'
        test_file.write_text("Hello Git Sandbox\n")

        res_add = sb.run_git(['add', 'hello.txt'])
        assert res_add.success

        res_commit = sb.run_git(['commit', '-m', 'Initial commit'])
        assert res_commit.success

        res_count = sb.run_git(['rev-list', '--count', 'HEAD'])
        assert res_count.success
        assert int(res_count.stdout.strip()) == 1


def test_sandbox_safety_enforcement():
    with GitSandbox(label="test_safety") as sb:
        sb.run_git(['init'])

        # Command starting with non-git
        res1 = sb.run_student_command("rm -rf /")
        assert not res1.success
        assert res1.is_security_violation

        # Blocked character ;
        res2 = sb.run_student_command("git status; echo hacked")
        assert not res2.success
        assert res2.is_security_violation

        # Blocked flag -c
        res3 = sb.run_student_command("git -c user.email=bad status")
        assert not res3.success
        assert res3.is_security_violation


def test_sandbox_clone():
    with GitSandbox(label="test_orig") as sb:
        sb.run_git(['init'])
        f = sb.repo_dir / 'file.txt'
        f.write_text("orig")
        sb.run_git(['add', 'file.txt'])
        sb.run_git(['commit', '-m', 'orig commit'])

        clone = sb.clone_repo()
        try:
            assert clone.repo_dir.exists()
            assert (clone.repo_dir / 'file.txt').exists()
            res = clone.run_git(['rev-list', '--count', 'HEAD'])
            assert int(res.stdout.strip()) == 1
        finally:
            if clone._temp_dir:
                import shutil
                shutil.rmtree(clone._temp_dir, ignore_errors=True)
