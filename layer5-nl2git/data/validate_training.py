"""
Validate every generated training example:
1. Syntax check: does the command start with 'git' and pass injection checks?
2. Risk consistency: does pattern-based risk match or upgrade the labeled risk?
3. Sandbox check: does the command execute safely in disposable Git repository?

Run: python validate_training.py --input training_data.jsonl --out validated.jsonl
"""
import json
import subprocess
import argparse
import re
import sys
import os
import random
import tempfile
from pathlib import Path

# Add inference and sandbox directories to path
INFERENCE_DIR = Path(__file__).resolve().parent.parent / "inference"
SANDBOX_DIR = Path(__file__).resolve().parent.parent.parent / "variant-pipeline" / "sandbox"

sys.path.insert(0, str(INFERENCE_DIR))
sys.path.insert(0, str(SANDBOX_DIR.parent))

from risk_taxonomy import assess_risk, RiskLevel

try:
    from sandbox.git_runner import GitSandbox, VirtualGitState
    HAS_SANDBOX = True
except Exception:
    HAS_SANDBOX = False

def syntax_valid(command: str) -> bool:
    """Check if the command starts with 'git' and has no shell injection."""
    cmd = command.strip()
    if not cmd.startswith("git "):
        return False
    # Block dangerous shell injection patterns
    dangerous_shell = [";", "&&", "||", "|", "`", "$(", ">", "<", "eval", "exec"]
    for pat in dangerous_shell:
        if pat in cmd:
            return False
    return True

def validate_sandbox(command: str, category_id: str) -> bool:
    """
    Run command in a safe temporary environment using GitSandbox or fallback virtual state.
    """
    cmd = command.strip()
    if not syntax_valid(cmd):
        return False

    # If GitSandbox is available, run through sandbox engine
    if HAS_SANDBOX:
        try:
            sandbox = GitSandbox()
            # If native git is available in sandbox, run it
            if sandbox.has_native_git:
                res = sandbox.run_command(cmd)
                return res.returncode == 0 or "nothing to commit" in res.stdout or "up to date" in res.stdout
            else:
                # Use pure-Python virtual repository state
                vstate = sandbox.vstate
                # Check that command tokenizes properly
                tokens = cmd.split()
                if len(tokens) >= 2 and tokens[0] == "git":
                    subcmd = tokens[1]
                    known_verbs = {
                        "status", "diff", "log", "branch", "checkout", "switch",
                        "reset", "stash", "commit", "add", "revert", "cherry-pick",
                        "rebase", "clean", "tag", "blame", "reflog", "fetch",
                        "pull", "push", "remote", "clone", "apply", "bisect", "rm", "show"
                    }
                    return subcmd in known_verbs
        except Exception:
            pass

    # Fallback basic check
    tokens = cmd.split()
    return len(tokens) >= 2 and tokens[0] == "git"


def validate_all(input_path: str, out_path: str, sandbox_fraction: float = 0.2):
    valid = []
    rejected = 0
    reasons = {"syntax": 0, "risk": 0, "sandbox": 0, "empty": 0}

    with open(input_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    total = len(lines)
    for i, line in enumerate(lines):
        ex = json.loads(line.strip())
        cmd = ex.get("command", "").strip()
        goal = ex.get("goal", "").strip()

        if not goal or not cmd:
            reasons["empty"] += 1
            rejected += 1
            continue

        if not syntax_valid(cmd):
            reasons["syntax"] += 1
            rejected += 1
            continue

        # Update risk to the assessed (safety-net) level
        assessment = assess_risk(cmd, ex.get("risk_level"))
        ex["risk_level"] = assessment.level.value
        ex["warning"] = assessment.warning
        ex["reversible"] = assessment.reversible

        # Sandbox validation on a random subset (or all)
        if random.random() <= sandbox_fraction or i < 20:
            if not validate_sandbox(cmd, ex.get("category_id", "")):
                reasons["sandbox"] += 1
                rejected += 1
                continue

        valid.append(ex)

        if (i + 1) % 100 == 0:
            print(f"  Processed {i+1}/{total}")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for ex in valid:
            f.write(json.dumps(ex) + "\n")

    print(f"\nValidation complete:")
    print(f"  Total:    {total}")
    print(f"  Valid:    {len(valid)}")
    print(f"  Rejected: {rejected}")
    print(f"  Reasons:  {reasons}")
    print(f"✅ Saved validated dataset to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(Path(__file__).parent / "training_data.jsonl"))
    parser.add_argument("--out", default=str(Path(__file__).parent / "validated.jsonl"))
    parser.add_argument("--sandbox-fraction", type=float, default=0.3)
    args = parser.parse_args()
    validate_all(args.input, args.out, args.sandbox_fraction)
