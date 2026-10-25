# layer3-ai/export/importer.py
# Imports the final 15 + 5 reserve questions into Supabase.
# Generates SQL and also imports via the Python client.
# Run: python export/importer.py

import json
import uuid
import logging
import sys
from pathlib import Path

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import SUPABASE_URL, SUPABASE_KEY, BANK_DIR

logger = logging.getLogger(__name__)


def import_to_supabase():
    # Load final questions
    final_questions_path = BANK_DIR / "final_questions.json"
    if not final_questions_path.exists():
        logger.error(f"❌ Final questions file not found at {final_questions_path}. Run quality gates first.")
        return False

    with open(final_questions_path) as f:
        data = json.load(f)

    main_questions = data["main"]        # 15 questions
    reserve_questions = data["reserve"]  # 5 questions

    logger.info(f"📦 Preparing to import {len(main_questions)} main + {len(reserve_questions)} reserve questions")

    if not SUPABASE_URL or not SUPABASE_KEY or "placeholder" in SUPABASE_URL:
        logger.warning("⚠️  Live Supabase credentials not configured in .env.")
        logger.info(f"   Generated SQL is available for manual copy/paste in Supabase SQL editor:")
        logger.info(f"   📄 {BANK_DIR / 'import.sql'}")
        return True

    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.error(f"❌ Failed to initialize Supabase client: {e}")
        logger.info(f"   You can still apply questions using {BANK_DIR / 'import.sql'}")
        return False

    try:
        # 1. Clean existing questions and quiz_questions if needed
        logger.info("  Cleaning existing quiz questions in DB...")
        client.table("quiz_questions").delete().neq("position", 0).execute()
        client.table("options").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("questions").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("reserve_options").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        client.table("reserve_questions").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

        # 2. Import main questions
        for i, q in enumerate(main_questions):
            q_id = q.get("id") or str(uuid.uuid4())
            q["id"] = q_id

            # Insert question
            client.table("questions").insert({
                "id": q_id,
                "text": q["question_text"],
                "difficulty": q["difficulty"],
                "topic": q.get("topic_tag", q.get("topic", "general")),
                "explanation": q.get("explanation", ""),
                "points_base": 1000,
                "is_active": True,
            }).execute()

            # Insert options
            for letter in ("a", "b", "c", "d"):
                opt_id = str(uuid.uuid4())
                client.table("options").insert({
                    "id": opt_id,
                    "question_id": q_id,
                    "text": q[f"option_{letter}"],
                    "is_correct": q["correct_answer"].lower() == letter,
                    "label": letter.upper(),
                }).execute()

            # Insert quiz_questions mapping (position 1-15)
            client.table("quiz_questions").insert({
                "position": i + 1,
                "question_id": q_id,
            }).execute()

            logger.info(f"  ✅ Imported Q{i + 1}: {q['question_text'][:50]}...")

        # 3. Import reserve questions
        for q in reserve_questions:
            q_id = q.get("id") or str(uuid.uuid4())

            client.table("reserve_questions").insert({
                "id": q_id,
                "text": q["question_text"],
                "difficulty": q.get("difficulty", "hard"),
                "topic": q.get("topic_tag", q.get("topic", "general")),
                "explanation": q.get("explanation", ""),
                "is_used": False,
            }).execute()

            for letter in ("a", "b", "c", "d"):
                client.table("reserve_options").insert({
                    "id": str(uuid.uuid4()),
                    "question_id": q_id,
                    "text": q[f"option_{letter}"],
                    "is_correct": q["correct_answer"].lower() == letter,
                    "label": letter.upper(),
                }).execute()

            logger.info(f"  ✅ Imported reserve: {q['question_text'][:50]}...")

        logger.info("\n🎉 Import complete!")

        # 4. Verify counts
        q_count = client.table("questions").select("id", count="exact").execute()
        o_count = client.table("options").select("id", count="exact").execute()
        rq_count = client.table("reserve_questions").select("id", count="exact").execute()
        logger.info(f"   Questions in DB: {q_count.count}")
        logger.info(f"   Options in DB: {o_count.count}")
        logger.info(f"   Reserve questions in DB: {rq_count.count}")
        return True

    except Exception as e:
        logger.error(f"❌ Error during database import: {e}")
        logger.info(f"   Fallback to SQL migration file: {BANK_DIR / 'import.sql'}")
        return False


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    import_to_supabase()
