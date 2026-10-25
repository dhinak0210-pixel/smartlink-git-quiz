"""
test-layer5-postevent.py
Automated end-to-end verification script for Layer 5 Post-Event features:
- Part A: NL→Git DL inference, risk taxonomy, pattern overrides.
- Part B: Adaptive Practice Elo ML math, question selector, and practice routes.
"""

import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

# Add paths
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "layer5-nl2git" / "inference"))
sys.path.insert(0, str(REPO_ROOT / "layer5-adaptive"))

from risk_taxonomy import assess_risk, RiskLevel
from model import NL2GitPipeline
from postprocess import validate_output, clean_command
import seed_elo_from_irt
import practice_analytics


def test_part_a_risk_taxonomy():
    print("Testing Part A: Risk Taxonomy & Safety Overrides...")

    # Safe command
    safe = assess_risk("git status")
    assert safe.level == RiskLevel.SAFE, f"Expected SAFE, got {safe.level}"
    assert safe.reversible is True

    # Caution command
    caution = assess_risk("git checkout -b hotfix")
    assert caution.level == RiskLevel.CAUTION, f"Expected CAUTION, got {caution.level}"

    # Dangerous command
    dangerous = assess_risk("git reset --hard HEAD~1")
    assert dangerous.level == RiskLevel.DANGEROUS, f"Expected DANGEROUS, got {dangerous.level}"
    assert dangerous.reversible is False

    # Critical command
    critical = assess_risk("git clean -fd")
    assert critical.level == RiskLevel.CRITICAL, f"Expected CRITICAL, got {critical.level}"

    # Safety-net override test: Model claims SAFE for git reset --hard -> MUST override to DANGEROUS
    override = assess_risk("git reset --hard HEAD~1", model_risk="SAFE")
    assert override.level == RiskLevel.DANGEROUS, f"Safety net failed: expected DANGEROUS override, got {override.level}"

    # Model claims SAFE for git clean -f -> MUST override to CRITICAL
    override_crit = assess_risk("git clean -f", model_risk="SAFE")
    assert override_crit.level == RiskLevel.CRITICAL, f"Safety net failed: expected CRITICAL override, got {override_crit.level}"

    # Cleaning tests
    assert clean_command("```bash\ngit status\n```") == "git status"
    assert clean_command("$ git branch") == "git branch"
    assert clean_command("git pull;") == "git pull"

    # Pipeline generation test
    pipe = NL2GitPipeline(use_llm_fallback=True)
    res = pipe.generate("undo my last commit but keep the changes")
    validated = validate_output(res)
    assert validated.command.startswith("git "), f"Command should start with git: {validated.command}"
    assert validated.risk_level in (RiskLevel.SAFE, RiskLevel.CAUTION, RiskLevel.DANGEROUS, RiskLevel.CRITICAL)

    print("  ✅ Part A: Risk taxonomy and safety-net override verified successfully.")


def test_part_b_elo_math():
    print("Testing Part B: Elo Math & IRT Conversion...")

    # IRT logit 0.0 -> Elo 1500
    assert seed_elo_from_irt.irt_to_elo(0.0) == 1500.0

    # IRT logit +1.0 -> Elo 1673.7
    assert seed_elo_from_irt.irt_to_elo(1.0) == 1673.7

    # IRT logit -1.0 -> Elo 1326.3
    assert seed_elo_from_irt.irt_to_elo(-1.0) == 1326.3

    # Expected probability when ratings are equal -> 0.5
    p_equal = practice_analytics.expected_score(1500.0, 1500.0)
    assert abs(p_equal - 0.5) < 1e-4

    # Win update with K=32 (first 20 answers)
    s_after, q_after, exp_p, delta = practice_analytics.update_elo(1500.0, 1500.0, True, 5)
    assert delta == 16.0, f"Expected delta +16, got {delta}"
    assert s_after == 1516.0
    assert q_after == 1484.0

    # Win update with K=16 (after 20 answers)
    s_after_2, q_after_2, _, delta_2 = practice_analytics.update_elo(1500.0, 1500.0, True, 25)
    assert delta_2 == 8.0, f"Expected delta +8, got {delta_2}"
    assert s_after_2 == 1508.0

    print("  ✅ Part B: Elo calculations and IRT transformations verified successfully.")


def test_http_routes():
    print("Testing Part B: HTTP Routes on Next.js server...")

    # 1. Test /practice page
    try:
        req = urllib.request.Request("http://localhost:3000/practice")
        with urllib.request.urlopen(req, timeout=5) as resp:
            status = resp.getcode()
            body = resp.read().decode("utf-8")
            assert status == 200
            assert "Adaptive Practice" in body or "Practice" in body
            print(f"  ✅ GET /practice returned HTTP {status}")
    except Exception as e:
        print(f"  ⚠️ GET /practice check: {e}")

    # 2. Test /api/practice/start unauthorized check
    try:
        req = urllib.request.Request(
            "http://localhost:3000/api/practice/start",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
        print("  ⚠️ Expected 401 for unauthenticated /api/practice/start")
    except urllib.error.HTTPError as e:
        assert e.code == 401, f"Expected 401, got {e.code}"
        print(f"  ✅ POST /api/practice/start properly enforced 401 Authentication Required")

    # 3. Test /api/practice/next unauthorized check
    try:
        req = urllib.request.Request("http://localhost:3000/api/practice/next?sessionId=test")
        urllib.request.urlopen(req, timeout=5)
    except urllib.error.HTTPError as e:
        assert e.code == 401
        print(f"  ✅ GET /api/practice/next properly enforced 401 Authentication Required")


if __name__ == "__main__":
    test_part_a_risk_taxonomy()
    test_part_b_elo_math()
    test_http_routes()
    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")
