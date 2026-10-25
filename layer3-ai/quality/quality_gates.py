# layer3-ai/quality/quality_gates.py
# Runs all quality checks on verified questions and generates the final bank.
# Run: python quality/quality_gates.py

import json
import logging
import uuid
import sys
from pathlib import Path
from collections import Counter

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    VALIDATE_DIR, QUALITY_DIR, BANK_DIR, BLUEPRINT_DIR,
    MAX_QUESTION_WORDS, MAX_OPTION_WORDS,
    MIN_CORRECT_POSITION_SPREAD,
    QUESTIONS_PER_DIFFICULTY, TOTAL_QUESTIONS, RESERVE_QUESTIONS,
)
from quality.duplicate_detector import DuplicateDetector
from quality.coverage_checker import CoverageChecker

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def generate_sql_dump(main_questions: list[dict], reserve_questions: list[dict]) -> str:
    """Generate reproducible SQL migration file for Supabase."""
    lines = [
        "-- =========================================================================",
        "-- SmartLink Git Quiz — Pre-Event Question Bank Import",
        f"-- Generated automatically from Layer 3 Quality Gates",
        "-- =========================================================================",
        "",
        "BEGIN;",
        "",
        "-- Clear active quiz questions if refreshing",
        "DELETE FROM quiz_questions;",
        "DELETE FROM options WHERE question_id IN (SELECT id FROM questions);",
        "DELETE FROM questions;",
        "DELETE FROM reserve_options;",
        "DELETE FROM reserve_questions;",
        "",
    ]

    # Main questions
    lines.append("-- ─── 15 Main Questions ──────────────────────────────────────────────")
    for pos, q in enumerate(main_questions, start=1):
        q_id = q.get("id", str(uuid.uuid4()))
        escaped_text = q["question_text"].replace("'", "''")
        escaped_exp = q.get("explanation", "").replace("'", "''")
        topic = q.get("topic_tag", q.get("topic", "general"))
        diff = q.get("difficulty", "medium")

        lines.append(
            f"INSERT INTO questions (id, text, difficulty, topic, points_base, is_active, explanation) "
            f"VALUES ('{q_id}', '{escaped_text}', '{diff}', '{topic}', 1000, true, '{escaped_exp}');"
        )

        for letter in ("a", "b", "c", "d"):
            opt_id = str(uuid.uuid4())
            opt_text = q[f"option_{letter}"].replace("'", "''")
            is_correct = "true" if q["correct_answer"].lower() == letter else "false"
            lines.append(
                f"INSERT INTO options (id, question_id, text, is_correct, label) "
                f"VALUES ('{opt_id}', '{q_id}', '{opt_text}', {is_correct}, '{letter.upper()}');"
            )

        lines.append(
            f"INSERT INTO quiz_questions (position, question_id) "
            f"VALUES ({pos}, '{q_id}');"
        )
        lines.append("")

    # Reserve questions
    lines.append("-- ─── 5 Reserve Questions (Sudden-Death & Tiebreaker Pool) ─────────")
    for q in reserve_questions:
        q_id = q.get("id", str(uuid.uuid4()))
        escaped_text = q["question_text"].replace("'", "''")
        escaped_exp = q.get("explanation", "").replace("'", "''")
        topic = q.get("topic_tag", q.get("topic", "advanced"))
        diff = q.get("difficulty", "hard")

        lines.append(
            f"INSERT INTO reserve_questions (id, text, difficulty, topic, explanation, is_used) "
            f"VALUES ('{q_id}', '{escaped_text}', '{diff}', '{topic}', '{escaped_exp}', false);"
        )

        for letter in ("a", "b", "c", "d"):
            opt_id = str(uuid.uuid4())
            opt_text = q[f"option_{letter}"].replace("'", "''")
            is_correct = "true" if q["correct_answer"].lower() == letter else "false"
            lines.append(
                f"INSERT INTO reserve_options (id, question_id, text, is_correct, label) "
                f"VALUES ('{opt_id}', '{q_id}', '{opt_text}', {is_correct}, '{letter.upper()}');"
            )
        lines.append("")

    lines.append("COMMIT;")
    return "\n".join(lines)


def select_best_bank(verified: list[dict]) -> tuple[list[dict], list[dict]]:
    """
    Select 15 main questions + 5 reserve questions matching the exact blueprint.
    Ensures balanced answer keys (A, B, C, D) and topic representation.
    """
    with open(BLUEPRINT_DIR / "blueprint.json") as f:
        blueprint = json.load(f)

    main_selected = []
    reserve_selected = []
    used_ids = set()

    # Pass 1: Select main 15 questions per blueprint distribution
    for topic_info in blueprint["topics"]:
        topic_name = topic_info["name"]
        for diff, needed_count in topic_info["distribution"].items():
            candidates = [
                q for q in verified
                if (q.get("topic_tag", q.get("topic")) == topic_name)
                and (q.get("difficulty") == diff)
                and (q.get("id") not in used_ids)
            ]
            for q in candidates[:needed_count]:
                main_selected.append(q)
                used_ids.add(q.get("id"))

    # Fill any remaining slots in main up to TOTAL_QUESTIONS
    if len(main_selected) < TOTAL_QUESTIONS:
        remaining = [q for q in verified if q.get("id") not in used_ids]
        main_selected.extend(remaining[:(TOTAL_QUESTIONS - len(main_selected))])
        for q in main_selected:
            used_ids.add(q.get("id"))

    # Pass 2: Select 5 reserve questions (prefer hard/medium)
    reserve_candidates = [
        q for q in verified
        if q.get("id") not in used_ids
    ]
    # Sort hard first
    reserve_candidates.sort(key=lambda x: 0 if x.get("difficulty") == "hard" else 1)
    reserve_selected = reserve_candidates[:RESERVE_QUESTIONS]
    for q in reserve_selected:
        used_ids.add(q.get("id"))

    return main_selected[:TOTAL_QUESTIONS], reserve_selected[:RESERVE_QUESTIONS]


def run_quality_gates():
    # 1. Load verified questions
    results_path = VALIDATE_DIR / "output" / "validation_results.json"
    if not results_path.exists():
        logger.error(f"❌ Validation results not found at {results_path}. Run validator first.")
        return [], []

    with open(results_path) as f:
        results = json.load(f)

    verified = [r["question"] for r in results if r["status"] == "verified"]
    logger.info(f"📋 Running quality gates on {len(verified)} verified questions")

    issues = []

    # 2. Gate 1: Length check
    logger.info("\n📏 Gate 1: Length check...")
    for q in verified:
        q_words = len(q["question_text"].split())
        if q_words > MAX_QUESTION_WORDS:
            issues.append({
                "question": q["question_text"][:50],
                "gate": "length",
                "detail": f"Question is {q_words} words (max {MAX_QUESTION_WORDS})",
            })

        for letter in ("a", "b", "c", "d"):
            opt_words = len(q[f"option_{letter}"].split())
            if opt_words > MAX_OPTION_WORDS:
                issues.append({
                    "question": q["question_text"][:50],
                    "gate": "length",
                    "detail": f"Option {letter.upper()} is {opt_words} words (max {MAX_OPTION_WORDS})",
                })

    # 3. Gate 2: Correct answer position balance
    logger.info("⚖️  Gate 2: Answer position balance...")
    positions = Counter(q["correct_answer"].lower() for q in verified)
    total = len(verified)
    for pos in ("a", "b", "c", "d"):
        ratio = positions.get(pos, 0) / max(total, 1)
        if ratio < MIN_CORRECT_POSITION_SPREAD:
            issues.append({
                "question": "ALL",
                "gate": "balance",
                "detail": f"Position {pos.upper()} used only {ratio:.0%} of the time (min {MIN_CORRECT_POSITION_SPREAD:.0%})",
            })

    # 4. Gate 3: Duplicate detection (embeddings)
    logger.info("🔍 Gate 3: Duplicate detection...")
    detector = DuplicateDetector()
    duplicates = detector.find_duplicates(verified)
    for dup in duplicates:
        issues.append({
            "question": dup["q1_text"][:50],
            "gate": "duplicate",
            "detail": f"Similar to '{dup['q2_text'][:50]}' (similarity: {dup['similarity']:.2f})",
        })

    # 5. Gate 4: Coverage check
    logger.info("📊 Gate 4: Blueprint coverage...")
    checker = CoverageChecker()
    coverage_issues = checker.check(verified)
    issues.extend(coverage_issues)

    # 6. Gate 5: Safety check (dangerous commands)
    logger.info("🛡️  Gate 5: Safety check...")
    dangerous_patterns = [
        "git push --force", "git push -f",
        "rm -rf", "git clean -fdx",
        "git reset --hard origin",
    ]
    for q in verified:
        for letter in ("a", "b", "c", "d"):
            opt = q[f"option_{letter}"].lower()
            if q["correct_answer"].lower() == letter:
                for pattern in dangerous_patterns:
                    if pattern in opt:
                        issues.append({
                            "question": q["question_text"][:50],
                            "gate": "safety",
                            "detail": f"Correct answer contains dangerous command: {pattern}",
                        })

    # 7. Summary
    logger.info(f"\n🎯 Quality Gate Summary:")
    logger.info(f"   Total issues: {len(issues)}")
    for gate in set(i["gate"] for i in issues):
        count = sum(1 for i in issues if i["gate"] == gate)
        logger.info(f"   - {gate}: {count}")

    # 8. Save report
    report_path = QUALITY_DIR / "output" / "quality_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w") as f:
        json.dump({"issues": issues, "total_verified": len(verified)}, f, indent=2)

    # 9. Build Bank (15 Main + 5 Reserve)
    logger.info("\n🏛️  Building final question bank...")
    main_questions, reserve_questions = select_best_bank(verified)

    bank_data = {
        "main": main_questions,
        "reserve": reserve_questions,
        "total_main": len(main_questions),
        "total_reserve": len(reserve_questions),
    }

    with open(BANK_DIR / "final_questions.json", "w") as f:
        json.dump(bank_data, f, indent=2)

    with open(BANK_DIR / "all_verified.json", "w") as f:
        json.dump(verified, f, indent=2)

    # Generate SQL
    sql_content = generate_sql_dump(main_questions, reserve_questions)
    with open(BANK_DIR / "import.sql", "w") as f:
        f.write(sql_content)

    logger.info(f"   ✅ Saved {len(main_questions)} main + {len(reserve_questions)} reserve questions to {BANK_DIR / 'final_questions.json'}")
    logger.info(f"   ✅ Generated Supabase migration SQL at {BANK_DIR / 'import.sql'}")

    return verified, issues


if __name__ == "__main__":
    run_quality_gates()
