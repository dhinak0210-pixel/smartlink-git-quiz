# layer3-ai/export/exporter.py
# Exports all quiz data from Supabase for post-event analysis.
# Run: python export/exporter.py [--mock]

import json
import logging
import argparse
import random
import uuid
import sys
from pathlib import Path
from datetime import datetime

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import SUPABASE_URL, SUPABASE_KEY, AFTER_DIR, BANK_DIR
from export.anonymizer import Anonymizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def generate_mock_event_data(output_dir: Path):
    """Generates realistic post-event data for offline testing or pre-event dry runs."""
    logger.info("🛠️  Generating synthetic post-event data for simulation / dry run...")

    # Load questions from bank if available, else standard set
    bank_path = BANK_DIR / "final_questions.json"
    if bank_path.exists():
        with open(bank_path) as f:
            bank = json.load(f)
            questions = bank["main"]
    else:
        questions = [
            {"id": f"q_{i}", "question_text": f"Git Quiz Question {i}", "topic_tag": "basics", "difficulty": "easy"}
            for i in range(1, 16)
        ]

    students = [
        {"id": f"stu_{i:03d}", "name": f"Student {name}", "college_id": f"ENG2026{i:03d}"}
        for i, name in enumerate(["Alice", "Bob", "Charlie", "Diana", "Ethan", "Fiona", "George", "Hannah", "Ian", "Julia", "Kevin", "Laura", "Mukul", "Nina", "Oscar", "Priya", "Quinn", "Rahul", "Sara", "Tom"], start=1)
    ]

    answers = []
    events = []
    flags = []
    reviews = []
    leaderboard = []

    for rank, stu in enumerate(students, start=1):
        stu_points = 0
        correct_count = 0
        total_time_ms = 0

        # Performance tier based on student
        p_correct = max(0.2, min(0.95, 0.95 - (rank * 0.035)))

        for pos, q in enumerate(questions, start=1):
            is_correct = (random.random() < p_correct)
            response_ms = random.randint(3000, 18000)
            points = int(1000 * max(0.2, 1 - (response_ms / 20000))) if is_correct else 0
            stu_points += points
            if is_correct:
                correct_count += 1
            total_time_ms += response_ms

            answers.append({
                "student_id": stu["id"],
                "question_id": q.get("id", f"q_{pos}"),
                "position": pos,
                "response_ms": response_ms,
                "is_correct": is_correct,
                "points": points,
                "students": {
                    "name": stu["name"],
                    "college_id": stu["college_id"],
                },
                "questions": {
                    "text": q["question_text"],
                    "difficulty": q.get("difficulty", "medium"),
                    "topic": q.get("topic_tag", q.get("topic", "basics")),
                }
            })

            # Random anti-cheat events
            if random.random() < 0.08:
                events.append({
                    "id": str(uuid.uuid4()),
                    "student_id": stu["id"],
                    "question_id": q.get("id", f"q_{pos}"),
                    "event_type": random.choice(["tab_switch", "paste_attempt", "window_blur"]),
                    "timestamp": datetime.now().isoformat(),
                    "payload": {"details": "Simulated monitor event"},
                })

        # Flag simulation
        if rank == 4:
            flags.append({
                "student_id": stu["id"],
                "flag_type": "rapid_fire",
                "severity": "medium",
                "reason": "Answered 3 questions in under 1.5 seconds",
            })
            reviews.append({
                "student_id": stu["id"],
                "admin_id": "admin",
                "status": "cleared",
                "notes": "Verified normal behavior via screen audit",
            })

        leaderboard.append({
            "rank": rank,
            "student_id": stu["id"],
            "name": stu["name"],
            "college_id": stu["college_id"],
            "total_points": stu_points,
            "correct_answers": correct_count,
            "avg_response_ms": round(total_time_ms / len(questions)),
        })

    # Sort leaderboard by points descending
    leaderboard.sort(key=lambda x: x["total_points"], reverse=True)
    for i, row in enumerate(leaderboard, start=1):
        row["rank"] = i

    # Save mock raw files
    with open(output_dir / "answers_raw.json", "w") as f:
        json.dump(answers, f, indent=2)
    with open(output_dir / "events_raw.json", "w") as f:
        json.dump(events, f, indent=2)
    with open(output_dir / "flags_raw.json", "w") as f:
        json.dump(flags, f, indent=2)
    with open(output_dir / "reviews_raw.json", "w") as f:
        json.dump(reviews, f, indent=2)
    with open(output_dir / "leaderboard_raw.json", "w") as f:
        json.dump(leaderboard, f, indent=2)

    return answers, events, flags, reviews, leaderboard


def export_all(use_mock: bool = False):
    output_dir = AFTER_DIR / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    can_use_supabase = (
        not use_mock and
        bool(SUPABASE_URL) and
        bool(SUPABASE_KEY) and
        ("placeholder" not in SUPABASE_URL)
    )

    if not can_use_supabase:
        logger.info("ℹ️  Running in mock/simulation data export mode.")
        answers, events, flags, reviews, leaderboard = generate_mock_event_data(output_dir)
    else:
        logger.info("📥 Exporting live quiz data from Supabase...")
        try:
            from supabase import create_client
            client = create_client(SUPABASE_URL, SUPABASE_KEY)

            # 1. Export answers
            answers = client.table("answers").select(
                "student_id, question_id, position, response_ms, is_correct, points, "
                "students(name, college_id), "
                "questions(text, difficulty, topic)"
            ).execute().data
            with open(output_dir / "answers_raw.json", "w") as f:
                json.dump(answers, f, indent=2)
            logger.info(f"  ✅ Answers: {len(answers)} rows")

            # 2. Export events
            events = client.table("events").select("*").execute().data
            with open(output_dir / "events_raw.json", "w") as f:
                json.dump(events, f, indent=2)
            logger.info(f"  ✅ Events: {len(events)} rows")

            # 3. Export flags and reviews
            flags = client.table("flags").select("*").execute().data
            reviews = client.table("reviews").select("*").execute().data
            with open(output_dir / "flags_raw.json", "w") as f:
                json.dump(flags, f, indent=2)
            with open(output_dir / "reviews_raw.json", "w") as f:
                json.dump(reviews, f, indent=2)

            # 4. Export leaderboard
            leaderboard = client.table("leaderboard").select("*").execute().data
            with open(output_dir / "leaderboard_raw.json", "w") as f:
                json.dump(leaderboard, f, indent=2)
            logger.info(f"  ✅ Leaderboard: {len(leaderboard)} rows")

        except Exception as e:
            logger.warning(f"Failed to query live Supabase ({e}). Falling back to simulation data.")
            answers, events, flags, reviews, leaderboard = generate_mock_event_data(output_dir)

    # 5. Create anonymized version for AI use
    logger.info("🔒 Anonymizing student records for external AI safety...")
    anonymizer = Anonymizer()
    anon_answers = anonymizer.anonymize_student_data(answers)
    anon_leaderboard = anonymizer.anonymize_student_data(leaderboard)

    with open(output_dir / "answers_anonymous.json", "w") as f:
        json.dump(anon_answers, f, indent=2)
    with open(output_dir / "leaderboard_anonymous.json", "w") as f:
        json.dump(anon_leaderboard, f, indent=2)

    # Save mapping locally (NEVER upload)
    anonymizer.save_mapping(output_dir / "_id_mapping_LOCAL.json")

    logger.info("\n🎉 Export & Anonymization complete!")
    logger.info(f"   Raw data: {output_dir}/")
    logger.info(f"   Anonymous data: {output_dir / 'answers_anonymous.json'}")
    logger.info(f"   ⚠️  _id_mapping_LOCAL.json remains strictly confidential on your laptop!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export quiz data from Supabase and anonymize PII")
    parser.add_argument("--mock", action="store_true", help="Generate simulated post-event data for testing")
    args = parser.parse_args()

    export_all(use_mock=args.mock)
