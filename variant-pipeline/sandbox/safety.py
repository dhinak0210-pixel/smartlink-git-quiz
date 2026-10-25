# variant-pipeline/sandbox/safety.py
"""
Command allow-list and sanitizer.
Rejects anything that could escape the sandbox.
"""

import re
import shlex
from typing import Tuple

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


class UnsafeCommandError(Exception):
    """Raised when a command fails safety checks."""
    pass


class SecurityViolationError(UnsafeCommandError):
    """Raised when a command contains dangerous characters, flags, or injection attempts."""
    pass


def sanitize_command(command: str) -> Tuple[str, list[str]]:
    """
    Parse and validate a Git command string.
    Returns (subcommand, args_list) if safe.
    Raises UnsafeCommandError if unsafe.
    """
    command = command.strip()

    if not command:
        raise UnsafeCommandError("Empty command")

    # Check for shell metacharacters BEFORE splitting
    for char in config.BLOCKED_CHARS:
        if char in command:
            raise SecurityViolationError(
                f"Blocked character '{char}' in command: {command}"
            )

    # Split into tokens (no shell interpretation)
    try:
        tokens = shlex.split(command)
    except ValueError as e:
        raise SecurityViolationError(f"Cannot parse command: {e}")

    if not tokens:
        raise UnsafeCommandError("Empty command after parsing")

    # Must start with "git"
    if tokens[0] != 'git':
        raise SecurityViolationError(f"Command must start with 'git', got: {tokens[0]}")

    if len(tokens) < 2:
        raise UnsafeCommandError("No git subcommand specified")

    # Check for blocked flags before subcommand (e.g. git -c ...)
    if tokens[1] in config.BLOCKED_FLAGS or tokens[1].startswith('-c'):
        raise SecurityViolationError(f"Blocked flag '{tokens[1]}' in command")

    subcommand = tokens[1]

    if subcommand.startswith('-'):
        raise UnsafeCommandError(f"Expected subcommand, got flag: {subcommand}")

    # Check allow-list
    if subcommand not in config.ALLOWED_GIT_COMMANDS:
        raise UnsafeCommandError(
            f"Subcommand '{subcommand}' not in allow-list. "
            f"Allowed: {sorted(config.ALLOWED_GIT_COMMANDS)}"
        )

    # Check for blocked flags after subcommand
    for token in tokens[2:]:
        if token in {'--exec', '--upload-pack', '--receive-pack'}:
            raise SecurityViolationError(f"Blocked flag '{token}' in command")
        if (token == '-c' or token.startswith('-c')) and subcommand != 'switch':
            raise SecurityViolationError("Blocked flag '-c' (config injection risk)")



    if subcommand == 'config':
        allowed_config_keys = {
            'user.name', 'user.email', 'init.defaultBranch',
            'core.autocrlf', 'core.pager'
        }
        for token in tokens[2:]:
            if not token.startswith('-') and '.' in token:
                if token not in allowed_config_keys:
                    raise SecurityViolationError(
                        f"Config key '{token}' not allowed. "
                        f"Allowed: {allowed_config_keys}"
                    )

    return subcommand, tokens[1:]


def sanitize_setup_command(command: str) -> str:
    """
    Validates that setup commands do not contain network or escape attempts.
    """
    blocked_patterns = [
        r'\bcurl\b', r'\bwget\b', r'\bssh\b', r'\bscp\b',
        r'\brm\s+-rf\s+/', r'\bmkfs\b', r'\bdd\b',
        r'\bchmod\s+777\b', r'\bsudo\b', r'\bsu\b',
        r'/etc/', r'/root/',
        r'\bpython\b', r'\bnode\b', r'\bsmtp\b',
    ]

    for pattern in blocked_patterns:
        if re.search(pattern, command, re.IGNORECASE):
            raise SecurityViolationError(
                f"Setup command contains blocked pattern '{pattern}': {command}"
            )

    return command

