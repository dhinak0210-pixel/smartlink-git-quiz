# layer3-ai/validate/validator.py
# Runs all validation steps: Git repo execution, blind checking, manual flagging.
# Run: python validate/validator.py

import json
import logging
import sys
from pathlib import Path

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import GENERATE_DIR, VALIDATE_DIR
from validate.git_repo_runner import validate_all_questions
from validate.blind_checker import BlindChecker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def run_validation():
    # 1. Load candidates
    candidates_path = GENERATE_DIR / "output" / "candidates_raw.json"
    if not candidates_path.exists():
        logger.error(f"❌ Candidates file not found at {candidates_path}. Run generator first.")
        return []

    with open(candidates_path) as f:
        candidates = json.load(f)

    logger.info(f"📋 Loaded {len(candidates)} candidates for validation")

    # 2. Git repo validation (command-choice and scenario questions)
    logger.info("\n🔧 Step 1: Git repo execution validation...")
    git_results = validate_all_questions(candidates)

    # 3. Blind LLM check (concept questions + any git-validated mismatches)
    logger.info("\n🤖 Step 2: Blind LLM answer check...")
    checker = BlindChecker()
    needs_blind = [
        q for q, r in zip(candidates, git_results)
        if r.status in ("needs_manual_check", "mismatch")
    ]
    logger.info(f"   {len(needs_blind)} questions routed to blind checking")
    blind_results = checker.check_all(needs_blind)

    # 4. Merge results
    logger.info("\n📊 Step 3: Merging validation results...")
    final_results = []
    blind_map = {r["question_id"]: r for r in blind_results}

    for q, git_r in zip(candidates, git_results):
        q_id = q.get("id", q["question_text"][:30])

        if git_r.status == "verified":
            status = "verified"
            method = "git_execution"
        elif git_r.status == "mismatch":
            # Check if blind check resolved it
            blind = blind_map.get(q_id)
            if blind and blind.get("matches"):
                status = "verified"
                method = "blind_check_override"
            else:
                status = "mismatch"
                method = "git_execution"
        else:
            # needs_manual_check → use blind result
            blind = blind_map.get(q_id)
            if blind and blind.get("matches") and blind.get("confidence") in ("high", "medium"):
                status = "verified"
                method = "blind_check"
            elif blind and blind.get("matches"):
                status = "needs_manual_check"
                method = "blind_check_low_confidence"
            else:
                status = "mismatch"
                method = "blind_check"

        final_results.append({
            "question": q,
            "status": status,
            "method": method,
            "git_details": git_r.details,
            "blind_details": blind_map.get(q_id, {}),
        })

    # 5. Summary
    verified = [r for r in final_results if r["status"] == "verified"]
    mismatch = [r for r in final_results if r["status"] == "mismatch"]
    manual = [r for r in final_results if r["status"] == "needs_manual_check"]

    logger.info(f"\n🎯 Validation Summary:")
    logger.info(f"   ✅ Verified: {len(verified)}")
    logger.info(f"   ❌ Mismatch: {len(mismatch)}")
    logger.info(f"   ⚠️  Manual check needed: {len(manual)}")

    # 6. Save results
    output_path = VALIDATE_DIR / "output" / "validation_results.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(final_results, f, indent=2)

    logger.info(f"   Saved to: {output_path}")
    return final_results


if __name__ == "__main__":
    run_validation()
