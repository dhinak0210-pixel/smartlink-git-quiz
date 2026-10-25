# variant-pipeline/config.py

import os
import shutil
import subprocess
from pathlib import Path

# --- Paths ---
BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / 'templates'
REPORTS_DIR = BASE_DIR / 'reports'
TESTS_DIR = BASE_DIR / 'tests'
FIXTURES_DIR = TESTS_DIR / 'fixtures'

for d in [TEMPLATES_DIR, REPORTS_DIR, TESTS_DIR, FIXTURES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# --- Determinism ---
SEED = 42
GIT_VERSION_REQUIRED = None

# --- Sandbox ---
SANDBOX_TIMEOUT_SECONDS = 10
SANDBOX_MAX_REPO_SIZE_MB = 10
ALLOWED_GIT_COMMANDS = {
    'init', 'add', 'commit', 'switch', 'checkout', 'branch',
    'reset', 'revert', 'stash', 'merge', 'rebase', 'cherry-pick',
    'restore', 'log', 'status', 'diff', 'tag', 'rm', 'mv',
    'config', 'rev-list', 'show-branch'
}
BLOCKED_FLAGS = {'--exec', '--upload-pack', '--receive-pack'}
BLOCKED_CHARS = {';', '&', '|', '$', '`', '(', ')', '{', '}', '>', '<', '\\', '!', '#'}

# --- Variant Generation ---
VARIANTS_PER_QUESTION = 3
RESERVE_VARIANTS = 2
MAX_PARAMETER_RANGE = 5

# --- Quality Gates ---
MAX_STEM_LENGTH_DIFF_PCT = 15   # Max % difference in stem word count across siblings
MAX_OPTION_LENGTH_DIFF_PCT = 15 # Max % difference in option length across siblings
MAX_SOLVE_TIME_DIFF_PCT = 25

# --- LLM ---
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = 'gemini-2.0-flash'
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# --- Supabase ---
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

# --- Git Environment (deterministic) ---
GIT_AUTHOR_NAME = 'Quiz Student'
GIT_AUTHOR_EMAIL = 'student@quiz.local'
GIT_COMMITTER_NAME = 'Quiz Student'
GIT_COMMITTER_EMAIL = 'student@quiz.local'
GIT_DEFAULT_BRANCH = 'main'
GIT_FIXED_DATE = '2025-01-15T10:00:00+05:30'


def get_git_version() -> str:
    """Get the installed Git version string."""
    try:
        # Check PATH or common bins
        git_cmd = shutil.which('git') or 'git'
        result = subprocess.run(
            [git_cmd, '--version'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return 'git version 2.43.0 (pure-python-sandbox)'


def verify_git_version():
    """Check that Git is available and optionally matches required version."""
    version = get_git_version()
    print(f"Git execution engine: {version}")
    if GIT_VERSION_REQUIRED and GIT_VERSION_REQUIRED not in version:
        raise RuntimeError(
            f"Git version mismatch! Required: {GIT_VERSION_REQUIRED}, "
            f"Found: {version}."
        )
    return version
