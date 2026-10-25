"""
Risk taxonomy for generated Git commands.
Every command gets exactly one risk level and a plain-language warning.
"""
from enum import Enum
from dataclasses import dataclass
import re

class RiskLevel(str, Enum):
    SAFE = "SAFE"
    CAUTION = "CAUTION"
    DANGEROUS = "DANGEROUS"
    CRITICAL = "CRITICAL"

@dataclass
class RiskAssessment:
    level: RiskLevel
    warning: str
    reversible: bool

# --- Pattern-based risk detection (used as safety net over model output) ---

CRITICAL_PATTERNS = [
    r"git\s+clean\s+-f",
    r"git\s+branch\s+-D",
    r"git\s+reflog\s+expire",
    r"git\s+gc\s+--prune",
    r"git\s+push\s+.*--force-with-lease.*--force",  # double force
    r"rm\s+-rf\s+\.git",
]

DANGEROUS_PATTERNS = [
    r"git\s+reset\s+--hard",
    r"git\s+rebase\s+-i",
    r"git\s+rebase\s+--onto",
    r"git\s+push\s+--force",
    r"git\s+push\s+-f\b",
    r"git\s+commit\s+--amend",
    r"git\s+cherry-pick\s+.*--strategy",
    r"git\s+filter-branch",
    r"git\s+filter-repo",
    r"git\s+stash\s+drop",
    r"git\s+stash\s+clear",
]

CAUTION_PATTERNS = [
    r"git\s+checkout\b",
    r"git\s+switch\b",
    r"git\s+restore\b",
    r"git\s+branch\s+-d\b",
    r"git\s+revert\b",
    r"git\s+reset\s+--mixed",
    r"git\s+reset\s+--soft",
    r"git\s+reset\s+HEAD",
    r"git\s+stash\b",
    r"git\s+merge\b",
    r"git\s+pull\s+--rebase",
    r"git\s+add\s+-A",
    r"git\s+add\s+\.",
]

WARNING_TEMPLATES = {
    RiskLevel.SAFE: "This is a read-only command. It will not change your repository.",
    RiskLevel.CAUTION: (
        "This changes your working tree or staging area. "
        "Uncommitted work may be affected. Run `git status` first."
    ),
    RiskLevel.DANGEROUS: (
        "⚠️ This rewrites history or discards changes. "
        "Recovery is possible via `git reflog` but not guaranteed. "
        "Do NOT use on shared branches without team agreement."
    ),
    RiskLevel.CRITICAL: (
        "🚨 This can PERMANENTLY delete data with no easy recovery. "
        "Make a full backup (`git bundle` or clone) before proceeding."
    ),
}

def assess_risk(command: str, model_risk: str | None = None) -> RiskAssessment:
    """
    Determine risk level. Pattern-based detection overrides model output
    when the model underestimates risk (safety-first).
    """
    cmd = command.strip().lower()

    # Pattern scan (always runs, acts as safety net)
    pattern_level = RiskLevel.SAFE
    for pat in CRITICAL_PATTERNS:
        if re.search(pat, cmd):
            pattern_level = RiskLevel.CRITICAL
            break
    if pattern_level != RiskLevel.CRITICAL:
        for pat in DANGEROUS_PATTERNS:
            if re.search(pat, cmd):
                pattern_level = RiskLevel.DANGEROUS
                break
    if pattern_level not in (RiskLevel.CRITICAL, RiskLevel.DANGEROUS):
        for pat in CAUTION_PATTERNS:
            if re.search(pat, cmd):
                pattern_level = RiskLevel.CAUTION
                break

    # Resolve: take the HIGHER of model prediction and pattern scan
    level_order = [RiskLevel.SAFE, RiskLevel.CAUTION, RiskLevel.DANGEROUS, RiskLevel.CRITICAL]
    try:
        model_enum = RiskLevel(model_risk.upper()) if model_risk else RiskLevel.SAFE
    except ValueError:
        model_enum = RiskLevel.SAFE

    final_level = max(model_enum, pattern_level, key=lambda x: level_order.index(x))
    reversible = final_level in (RiskLevel.SAFE, RiskLevel.CAUTION)

    return RiskAssessment(
        level=final_level,
        warning=WARNING_TEMPLATES[final_level],
        reversible=reversible,
    )
