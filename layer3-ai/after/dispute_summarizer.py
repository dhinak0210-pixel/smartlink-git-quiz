# layer3-ai/after/dispute_summarizer.py
# Solves student inquiries and appeals by synthesizing neutral, data-grounded evidence dossiers.
# Run: python after/dispute_summarizer.py [--student-id STU_ID]

import json
import logging
import argparse
import sys
from pathlib import Path

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    AFTER_DIR, AI_PROVIDER, GEMINI_API_KEY, GROQ_API_KEY,
    GEMINI_MODEL, GROQ_MODEL
)
from generate.prompts import DISPUTE_SUMMARY_PROMPT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class DisputeSummarizer:
    def __init__(self):
        self.output_dir = AFTER_DIR / "output" / "disputes"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.provider = AI_PROVIDER

    def load_student_records(self, target_student_id: str | None = None) -> list[dict]:
        """Gathers all answers, events, flags, and reviews for the targeted student(s)."""
        answers_path = self.output_dir.parent / "answers_raw.json"
        events_path = self.output_dir.parent / "events_raw.json"
        flags_path = self.output_dir.parent / "flags_raw.json"
        reviews_path = self.output_dir.parent / "reviews_raw.json"
        leaderboard_path = self.output_dir.parent / "leaderboard_raw.json"

        if not answers_path.exists():
            logger.error("❌ answers_raw.json not found. Run exporter first.")
            return []

        with open(answers_path) as f:
            all_answers = json.load(f)

        all_events = []
        if events_path.exists():
            with open(events_path) as f:
                all_events = json.load(f)

        all_flags = []
        if flags_path.exists():
            with open(flags_path) as f:
                all_flags = json.load(f)

        all_reviews = []
        if reviews_path.exists():
            with open(reviews_path) as f:
                all_reviews = json.load(f)

        leaderboard_map = {}
        if leaderboard_path.exists():
            with open(leaderboard_path) as f:
                for entry in json.load(f):
                    leaderboard_map[entry["student_id"]] = entry

        # Group by student_id
        grouped = {}
        for a in all_answers:
            sid = a["student_id"]
            if target_student_id and sid != target_student_id:
                continue

            if sid not in grouped:
                grouped[sid] = {
                    "student_id": sid,
                    "name": a.get("students", {}).get("name", "Student"),
                    "college_id": a.get("students", {}).get("college_id", ""),
                    "answers": [],
                    "events": [],
                    "flags": [],
                    "reviews": [],
                    "leaderboard": leaderboard_map.get(sid, {}),
                }
            grouped[sid]["answers"].append({
                "position": a.get("position"),
                "question": a.get("questions", {}).get("text", "")[:60],
                "response_ms": a.get("response_ms"),
                "is_correct": a.get("is_correct"),
                "points": a.get("points"),
            })

        for e in all_events:
            sid = e.get("student_id")
            if sid in grouped:
                grouped[sid]["events"].append({
                    "event_type": e.get("event_type"),
                    "timestamp": e.get("timestamp"),
                    "details": e.get("payload", {}),
                })

        for f in all_flags:
            sid = f.get("student_id")
            if sid in grouped:
                grouped[sid]["flags"].append({
                    "flag_type": f.get("flag_type"),
                    "severity": f.get("severity"),
                    "reason": f.get("reason"),
                })

        for r in all_reviews:
            sid = r.get("student_id")
            if sid in grouped:
                grouped[sid]["reviews"].append({
                    "status": r.get("status"),
                    "admin_id": r.get("admin_id"),
                    "notes": r.get("notes"),
                })

        return list(grouped.values())

    def summarize_student(self, student_dossier: dict) -> str:
        """Uses AI (or deterministic formatter) to draft an evidence summary for dispute resolution."""
        # Clean dossier for AI (anonymized)
        ai_payload = {
            "student_id": student_dossier["student_id"],
            "total_answers": len(student_dossier["answers"]),
            "correct_answers": sum(1 for a in student_dossier["answers"] if a["is_correct"]),
            "answers_summary": student_dossier["answers"][:15],
            "anti_cheat_events": student_dossier["events"],
            "flags_raised": student_dossier["flags"],
            "admin_reviews": student_dossier["reviews"],
        }
        json_data = json.dumps(ai_payload, indent=2)

        prompt = DISPUTE_SUMMARY_PROMPT.format(student_data_json=json_data)

        if self.provider == "gemini" and GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel(GEMINI_MODEL)
                response = model.generate_content(prompt, generation_config={"temperature": 0.2})
                return response.text.strip()
            except Exception as e:
                logger.warning(f"AI dispute summary failed ({e}). Using deterministic summary.")

        elif self.provider == "groq" and GROQ_API_KEY:
            try:
                from groq import Groq
                client = Groq(api_key=GROQ_API_KEY)
                response = client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.warning(f"Groq dispute summary failed ({e}). Using deterministic summary.")

        # High-quality factual deterministic summary
        sid = student_dossier["student_id"]
        total_q = len(student_dossier["answers"])
        correct_q = sum(1 for a in student_dossier["answers"] if a["is_correct"])
        events_count = len(student_dossier["events"])
        flags = student_dossier["flags"]
        reviews = student_dossier["reviews"]

        fast_answers = [
            a for a in student_dossier["answers"]
            if a.get("response_ms", 10000) < 1500 and a.get("is_correct")
        ]

        summary_lines = [
            f"# Dispute & Integrity Summary for Student: {sid}",
            f"**Participant:** {student_dossier.get('name', 'N/A')} ({student_dossier.get('college_id', 'N/A')})",
            "",
            "## 1. Overall Performance Data",
            f"- Questions answered: {total_q}",
            f"- Correct answers: {correct_q} ({(correct_q / max(total_q, 1))*100:.1f}%)",
            f"- Total Flags Raised: {len(flags)}",
            f"- Total Telemetry Events Logged: {events_count}",
            "",
            "## 2. Integrity & Anomaly Evidence",
        ]

        if flags:
            for f in flags:
                summary_lines.append(f"- **Flag [{f.get('severity', 'info').upper()}]:** {f.get('flag_type')} — {f.get('reason')}")
        else:
            summary_lines.append("- No statistical or behavioral anomaly flags were triggered during the session.")

        if fast_answers:
            summary_lines.append(f"- **Rapid-Fire Responses:** {len(fast_answers)} questions answered correctly in under 1.5 seconds.")
            for fa in fast_answers:
                summary_lines.append(f"  - Q{fa.get('position')}: {fa.get('response_ms')}ms ('{fa.get('question')}')")

        if student_dossier["events"]:
            summary_lines.append(f"- **Client Events:** Logged {len(student_dossier['events'])} client focus/clipboard events:")
            for ev in student_dossier["events"][:5]:
                summary_lines.append(f"  - `{ev.get('event_type')}` at {ev.get('timestamp')}")

        summary_lines.extend([
            "",
            "## 3. Administrative Reviews & Verdict",
        ])

        if reviews:
            for rev in reviews:
                summary_lines.append(f"- **Review Status:** {rev.get('status')} (by admin `{rev.get('admin_id')}`)")
                summary_lines.append(f"- **Admin Notes:** {rev.get('notes')}")
        else:
            summary_lines.append("- No prior administrative review recorded. Status remains standard pending committee evaluation.")

        return "\n".join(summary_lines)

    def run(self, target_student_id: str | None = None):
        logger.info(f"🚀 Running dispute summarizer (target: {target_student_id or 'all flagged students'})...")
        dossiers = self.load_student_records(target_student_id)

        if not dossiers:
            logger.info("ℹ️  No student records matched criteria.")
            return []

        # If no specific student targeted, focus on students with flags or events
        if not target_student_id:
            flagged = [d for d in dossiers if d["flags"] or d["events"]]
            if flagged:
                dossiers = flagged
            else:
                dossiers = dossiers[:3]  # Sample first 3

        summaries = []
        for d in dossiers:
            sid = d["student_id"]
            summary_text = self.summarize_student(d)
            output_file = self.output_dir / f"{sid}_dispute_summary.md"
            with open(output_file, "w") as f:
                f.write(summary_text)

            logger.info(f"  ✅ Saved dispute dossier for {sid} to {output_file}")
            summaries.append({"student_id": sid, "file": str(output_file), "content": summary_text})

        return summaries


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate factual dispute evidence dossiers")
    parser.add_argument("--student-id", type=str, default=None, help="Target specific student ID")
    args = parser.parse_args()

    summarizer = DisputeSummarizer()
    summarizer.run(target_student_id=args.student_id)
