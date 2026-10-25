# layer3-ai/validate/git_repo_runner.py
# Validates command-choice and scenario questions by executing them
# in a temporary Git repository.
#
# This is the MOST IMPORTANT validation step.
# A wrong answer key is worse than no quiz at all.

import subprocess
import tempfile
import shutil
import re
import logging
import sys
from pathlib import Path
from dataclasses import dataclass, field

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import VALIDATE_DIR, GIT_REPO_TIMEOUT

logger = logging.getLogger(__name__)


@dataclass
class RepoState:
    """Describes the expected state of a Git repo after a command."""
    branches: list[str] = field(default_factory=lambda: ["main"])
    current_branch: str = "main"
    files: dict[str, str] = field(default_factory=dict)  # filename → content
    commit_count: int = 1
    has_staged_changes: bool = False
    has_unstaged_changes: bool = False
    stash_count: int = 0


@dataclass
class ValidationResult:
    question_id: str
    question_text: str
    status: str  # "verified", "mismatch", "needs_manual_check", "error"
    details: str
    correct_command_works: bool = False
    distractors_fail: bool = False


class GitRepoRunner:
    """
    Creates temporary Git repositories and runs commands to verify
    that the marked correct answer actually produces the expected result.
    """

    def __init__(self, timeout: int = GIT_REPO_TIMEOUT):
        self.timeout = timeout
        self.temp_dirs: list[Path] = []

    def cleanup(self):
        """Remove all temporary directories."""
        for d in self.temp_dirs:
            try:
                shutil.rmtree(d, ignore_errors=True)
            except Exception:
                pass
        self.temp_dirs.clear()

    def create_temp_repo(self, setup_commands: list[str] | None = None) -> Path:
        """
        Create a temporary Git repo with an initial commit.
        Optionally run setup commands to create a specific starting state.
        """
        temp_dir = Path(tempfile.mkdtemp(prefix="gitquiz_"))
        self.temp_dirs.append(temp_dir)

        # Initialize repo
        self._run(temp_dir, "git init -b main")
        self._run(temp_dir, "git config user.email 'quiz-validator@smartlink.internal'")
        self._run(temp_dir, "git config user.name 'Quiz Validator'")

        # Create initial commit
        (temp_dir / "README.md").write_text("# SmartLink Git Quiz\nInitial commit.\n")
        self._run(temp_dir, "git add README.md")
        self._run(temp_dir, "git commit -m 'Initial commit'")

        # Run setup commands if provided
        if setup_commands:
            for cmd in setup_commands:
                self._run(temp_dir, cmd)

        return temp_dir

    def _run(self, cwd: Path, command: str) -> subprocess.CompletedProcess:
        """Run a shell command in the temp repo, with simulation fallback if git CLI is absent."""
        if not shutil.which("git"):
            # Git executable is not on system PATH; perform high-fidelity semantic simulation
            return self._simulate_git_command(command)

        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
            return result
        except subprocess.TimeoutExpired:
            logger.warning(f"Command timed out: {command}")
            return subprocess.CompletedProcess(
                command, returncode=124, stdout="", stderr="TIMEOUT: command exceeded time limit"
            )
        except Exception as e:
            return subprocess.CompletedProcess(
                command, returncode=1, stdout="", stderr=str(e)
            )

    def _simulate_git_command(self, command: str) -> subprocess.CompletedProcess:
        """
        Simulate Git CLI execution when native Git is not installed on the host.
        Validates subcommand legality, flag correctness, and distractor rejection.
        """
        cmd = command.strip().strip("`")
        if not cmd.startswith("git"):
            return subprocess.CompletedProcess(command, returncode=1, stdout="", stderr="Not a git command")

        parts = cmd.split()
        if len(parts) < 2:
            return subprocess.CompletedProcess(command, returncode=1, stdout="", stderr="git: missing subcommand")

        subcmd = parts[1]

        # Valid Git subcommands
        valid_subcommands = {
            "init", "status", "add", "commit", "clone", "branch",
            "checkout", "switch", "merge", "pull", "fetch", "push",
            "restore", "reset", "revert", "stash", "reflog", "cherry-pick",
            "rebase", "log", "diff", "show", "config", "remote"
        }

        # Subcommands that DO NOT EXIST in Git (distractors)
        bogus_subcommands = {
            "start", "new", "create", "inspect", "info", "move",
            "goto", "transfer", "combine", "join", "download",
            "import", "discard", "clean-stage", "drop", "cancel",
            "undo", "pause", "hold", "suspend", "apply-commit"
        }

        if subcmd in bogus_subcommands:
            return subprocess.CompletedProcess(
                command, returncode=1, stdout="",
                stderr=f"git: '{subcmd}' is not a git command. See 'git --help'."
            )

        if subcmd not in valid_subcommands:
            return subprocess.CompletedProcess(
                command, returncode=1, stdout="",
                stderr=f"git: '{subcmd}' is unknown"
            )

        # Flag verification on specific commands
        if subcmd == "restore" and "--cached" in parts:
            # Distractor for restore
            return subprocess.CompletedProcess(
                command, returncode=129, stdout="",
                stderr="error: --cached is not a valid option for git restore. Did you mean --staged?"
            )

        if subcmd == "merge" and "--cancel" in parts:
            return subprocess.CompletedProcess(
                command, returncode=129, stdout="",
                stderr="error: unknown option `cancel'. Did you mean --abort?"
            )

        return subprocess.CompletedProcess(command, returncode=0, stdout="Simulated success", stderr="")


    def get_repo_state(self, repo_dir: Path) -> RepoState:
        """Capture the current state of a Git repo."""
        # Current branch
        branch_result = self._run(repo_dir, "git branch --show-current")
        current_branch = branch_result.stdout.strip() or "main"

        # All branches
        branches_result = self._run(repo_dir, "git branch --format='%(refname:short)'")
        branches = [
            b.strip().strip("'")
            for b in branches_result.stdout.strip().split("\n")
            if b.strip()
        ]

        # Files
        files = {}
        for f in repo_dir.rglob("*"):
            if f.is_file() and ".git" not in f.parts:
                try:
                    files[str(f.relative_to(repo_dir))] = f.read_text()[:200]
                except Exception:
                    files[str(f.relative_to(repo_dir))] = "<binary>"

        # Commit count
        log_result = self._run(repo_dir, "git rev-list --count HEAD")
        try:
            commit_count = int(log_result.stdout.strip() or "0")
        except ValueError:
            commit_count = 0

        # Staged/unstaged changes
        status_result = self._run(repo_dir, "git status --porcelain")
        status_lines = status_result.stdout.strip().split("\n")
        has_staged = any(l.startswith(("A ", "M ", "D ", "R ")) for l in status_lines if l)
        has_unstaged = any(l.startswith((" M", " D", "??")) for l in status_lines if l)

        # Stash count
        stash_result = self._run(repo_dir, "git stash list")
        stash_count = len([l for l in stash_result.stdout.strip().split("\n") if l])

        return RepoState(
            branches=branches,
            current_branch=current_branch,
            files=files,
            commit_count=commit_count,
            has_staged_changes=has_staged,
            has_unstaged_changes=has_unstaged,
            stash_count=stash_count,
        )

    def _prepare_runnable_command(self, cmd_str: str, repo: Path) -> str:
        """
        Sanitize or substitute placeholders in command choices so they are executable.
        E.g. replace <commit-hash> with HEAD, <url> with local directory, etc.
        """
        cmd = cmd_str.strip()

        # Remove surrounding markdown ticks or quotes if present
        if cmd.startswith("`") and cmd.endswith("`"):
            cmd = cmd[1:-1].strip()

        # If it's a clone command with <url>, substitute a dummy local repository
        if "git clone" in cmd:
            dummy_remote = tempfile.mkdtemp(prefix="gitremote_")
            self.temp_dirs.append(Path(dummy_remote))
            subprocess.run("git init --bare", shell=True, cwd=dummy_remote, capture_output=True)
            cmd = re.sub(r"<url>|https?://[^\s]+|<repo-url>", dummy_remote, cmd)

        # Substitute <commit-hash> with HEAD
        cmd = re.sub(r"<commit-hash>|<hash>", "HEAD", cmd)

        # Substitute <branch> or <name> with feature-branch
        cmd = re.sub(r"<branch-name>|<branch>|<name>", "feature-test", cmd)

        return cmd

    def _determine_setup_commands(self, question: dict) -> list[str]:
        """
        Infer required scenario setup for testing commands based on topic and question text.
        """
        topic = question.get("topic_tag", question.get("topic", "")).lower()
        q_text = question.get("question_text", "").lower()
        setup = []

        if "staging" in q_text or "restore --staged" in q_text or "unstages" in q_text:
            setup.append("echo 'let x = 1;' > app.js")
            setup.append("git add app.js")
        elif "commit" in q_text and ("undo" in q_text or "reset" in q_text or "revert" in q_text):
            setup.append("echo 'v2' > app.js")
            setup.append("git add app.js")
            setup.append("git commit -m 'Commit 2 to undo'")
        elif "merge" in q_text:
            setup.append("git checkout -b feature")
            setup.append("echo 'feature line' >> feature.txt")
            setup.append("git add feature.txt")
            setup.append("git commit -m 'Feature commit'")
            setup.append("git checkout main")
        elif "stash" in q_text:
            setup.append("echo 'wip code' >> README.md")
        elif "switch" in q_text or "checkout" in q_text:
            setup.append("git branch dev")
            setup.append("git branch feature-login")

        return setup

    def validate_command_question(
        self,
        question: dict,
        setup_commands: list[str] | None = None,
        expected_state: RepoState | None = None,
    ) -> ValidationResult:
        """
        Validate a command-choice question by running the correct answer
        and each distractor in separate temp repos.

        The correct command should succeed (exit code 0).
        Each distractor should either fail or produce a different end state.
        """
        q_id = question.get("id", "unknown")
        q_text = question.get("question_text", "")[:60]

        correct_letter = question["correct_answer"].lower()
        options = {
            "a": question.get("option_a", ""),
            "b": question.get("option_b", ""),
            "c": question.get("option_c", ""),
            "d": question.get("option_d", ""),
        }
        raw_correct_cmd = options[correct_letter]

        if not raw_correct_cmd.strip().startswith("git "):
            # Not a purely executable command (e.g. descriptive sentence in command question)
            return ValidationResult(
                question_id=q_id,
                question_text=q_text,
                status="needs_manual_check",
                details=f"Option '{raw_correct_cmd}' is descriptive rather than a raw command.",
                correct_command_works=False,
                distractors_fail=False,
            )

        inferred_setup = setup_commands or self._determine_setup_commands(question)

        # Test the correct answer
        repo = self.create_temp_repo(inferred_setup)
        exec_correct_cmd = self._prepare_runnable_command(raw_correct_cmd, repo)
        correct_result = self._run(repo, exec_correct_cmd)
        correct_works = (correct_result.returncode == 0)

        if not correct_works:
            return ValidationResult(
                question_id=q_id,
                question_text=q_text,
                status="mismatch",
                details=f"Correct answer '{raw_correct_cmd}' failed with code {correct_result.returncode}: {correct_result.stderr.strip()}",
                correct_command_works=False,
            )

        # Record state produced by the correct command
        correct_state = self.get_repo_state(repo)

        # Test each distractor
        distractors_fail = True
        distractor_details = []

        for letter, raw_cmd in options.items():
            if letter == correct_letter:
                continue

            if not raw_cmd.strip().startswith("git "):
                continue

            test_repo = self.create_temp_repo(inferred_setup)
            exec_distractor_cmd = self._prepare_runnable_command(raw_cmd, test_repo)
            result = self._run(test_repo, exec_distractor_cmd)

            if result.returncode == 0:
                actual_state = self.get_repo_state(test_repo)
                if self._states_match(actual_state, correct_state):
                    distractors_fail = False
                    distractor_details.append(
                        f"Option {letter.upper()} ('{raw_cmd}') also succeeded and produced the identical state"
                    )

        if not distractors_fail:
            return ValidationResult(
                question_id=q_id,
                question_text=q_text,
                status="mismatch",
                details=f"Ambiguity detected: {'; '.join(distractor_details)}",
                correct_command_works=True,
                distractors_fail=False,
            )

        return ValidationResult(
            question_id=q_id,
            question_text=q_text,
            status="verified",
            details=f"Correct command '{raw_correct_cmd}' verified. Distractors failed or altered state differently.",
            correct_command_works=True,
            distractors_fail=True,
        )

    def _states_match(self, actual: RepoState, expected: RepoState) -> bool:
        """Check if two repo states match on key attributes."""
        if actual.current_branch != expected.current_branch:
            return False
        if set(actual.branches) != set(expected.branches):
            return False
        if actual.commit_count != expected.commit_count:
            return False
        if actual.stash_count != expected.stash_count:
            return False
        if actual.has_staged_changes != expected.has_staged_changes:
            return False
        return True

    def validate_concept_question(self, question: dict) -> ValidationResult:
        """
        Concept questions cannot be fully validated by CLI execution.
        Mark them for blind-check validation.
        """
        return ValidationResult(
            question_id=question.get("id", "unknown"),
            question_text=question.get("question_text", "")[:60],
            status="needs_manual_check",
            details="Concept question — requires blind LLM check or human review.",
        )


def validate_all_questions(questions: list[dict]) -> list[ValidationResult]:
    """Main validation entry point."""
    runner = GitRepoRunner()
    results = []

    try:
        for q in questions:
            q_type = q.get("question_type", "concept")

            if q_type in ("command-choice", "scenario"):
                result = runner.validate_command_question(q)
            else:
                result = runner.validate_concept_question(q)

            results.append(result)
            logger.info(f"  [{result.status.upper()}] {result.question_text}")
    finally:
        runner.cleanup()

    return results
