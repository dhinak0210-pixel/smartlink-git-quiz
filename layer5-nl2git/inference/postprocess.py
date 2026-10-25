"""
Post-processing for generated Git commands.
- Strip markdown formatting
- Validate basic syntax
- Attach risk warnings
- Flag suspicious outputs
"""
import os
import re
import sys
from pathlib import Path

try:
    from model import NL2GitResult
    from risk_taxonomy import assess_risk
except ImportError:
    try:
        from .model import NL2GitResult
        from .risk_taxonomy import assess_risk
    except ImportError:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from model import NL2GitResult
        from risk_taxonomy import assess_risk


def clean_command(command: str) -> str:
    """Remove common LLM artifacts from the command string."""
    cmd = command.strip()
    # Strip markdown code fences
    cmd = re.sub(r"^```(?:bash|sh|git)?\s*", "", cmd, flags=re.MULTILINE)
    cmd = re.sub(r"\s*```$", "", cmd, flags=re.MULTILINE)
    # Strip leading $ or >
    cmd = re.sub(r"^[\$>]\s*", "", cmd)
    # Strip trailing semicolons
    cmd = cmd.rstrip(";").strip()
    return cmd


def validate_output(result: NL2GitResult) -> NL2GitResult:
    """Final validation pass on the result."""
    result.command = clean_command(result.command)

    # Re-assess risk after cleaning
    risk = assess_risk(result.command, result.risk_level.value)
    result.risk_level = risk.level
    result.warning = risk.warning
    result.reversible = risk.reversible

    # Flag empty or non-git commands
    if not result.command.startswith("git "):
        result.warning += "\n⚠️ Generated command does not start with 'git'. Verify manually."

    return result
