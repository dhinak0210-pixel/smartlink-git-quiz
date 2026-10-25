# layer3-ai/after/report_builder.py
# Generates personalized feedback reports for all participants.
# Template part (facts) is computed from data — zero AI.
# Advice part uses AI with ANONYMOUS data only (no names or college IDs).
# Compiles individualized PDF reports using ReportLab.
# Run: python after/report_builder.py

import json
import time
import logging
import sys
from pathlib import Path
from collections import defaultdict

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    AFTER_DIR, AI_PROVIDER, GEMINI_API_KEY, GROQ_API_KEY,
    GEMINI_MODEL, GROQ_MODEL, REPORT_BATCH_SIZE, REPORT_DELAY_SECONDS,
    EVENT_NAME, EVENT_DATE, ORGANIZER_NAME
)
from generate.prompts import STUDENT_FEEDBACK_PROMPT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class ReportBuilder:
    def __init__(self):
        self.output_dir = AFTER_DIR / "output" / "student_reports"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.provider = AI_PROVIDER
        self.gemini_model = None
        self.groq_client = None
        self.offline_mode = False

        if self.provider == "gemini":
            if not GEMINI_API_KEY:
                logger.warning("GEMINI_API_KEY not configured. Running in offline feedback mode.")
                self.offline_mode = True
            else:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=GEMINI_API_KEY)
                    self.gemini_model = genai.GenerativeModel(GEMINI_MODEL)
                except Exception as e:
                    logger.warning(f"Failed to initialize Gemini ({e}). Using offline feedback mode.")
                    self.offline_mode = True

        elif self.provider == "groq":
            if not GROQ_API_KEY:
                logger.warning("GROQ_API_KEY not configured. Running in offline feedback mode.")
                self.offline_mode = True
            else:
                try:
                    from groq import Groq
                    self.groq_client = Groq(api_key=GROQ_API_KEY)
                except Exception as e:
                    logger.warning(f"Failed to initialize Groq ({e}). Using offline feedback mode.")
                    self.offline_mode = True

    def build_template_data(self) -> list[dict]:
        """Compute factual report data from answers (no AI needed)."""
        answers_file = self.output_dir.parent / "answers_raw.json"
        leaderboard_file = self.output_dir.parent / "leaderboard_raw.json"

        if not answers_file.exists():
            logger.error(f"❌ Answers file not found at {answers_file}. Run exporter first.")
            return []

        with open(answers_file) as f:
            answers = json.load(f)

        leaderboard_map = {}
        if leaderboard_file.exists():
            with open(leaderboard_file) as f:
                lb = json.load(f)
                for entry in lb:
                    leaderboard_map[entry["student_id"]] = entry

        # Group answers by student
        students = {}
        for a in answers:
            sid = a["student_id"]
            if sid not in students:
                students[sid] = {
                    "student_id": sid,
                    "name": a.get("students", {}).get("name", "Student"),
                    "college_id": a.get("students", {}).get("college_id", "N/A"),
                    "answers": [],
                }
            students[sid]["answers"].append(a)

        total_students = len(students)
        reports = []

        for sid, data in students.items():
            ans = data["answers"]
            total_points = sum(a.get("points", 0) for a in ans)
            correct_count = sum(1 for a in ans if a.get("is_correct"))
            total_questions = len(ans)
            percentage = round((correct_count / max(total_questions, 1)) * 100, 1)

            times = [a.get("response_ms", 10000) for a in ans]
            avg_time = round((sum(times) / max(len(times), 1)) / 1000, 1)

            # Topic breakdown
            topics_data = defaultdict(lambda: {"total": 0, "correct": 0})
            for a in ans:
                t = a.get("questions", {}).get("topic", "general")
                topics_data[t]["total"] += 1
                if a.get("is_correct"):
                    topics_data[t]["correct"] += 1

            topic_scores = {}
            for t, val in topics_data.items():
                acc = round((val["correct"] / max(val["total"], 1)) * 100)
                topic_scores[t] = acc

            # Sort topics by accuracy
            sorted_topics = sorted(topic_scores.items(), key=lambda x: x[1])
            weak_topics = [f"{t} ({acc}%)" for t, acc in sorted_topics if acc < 60]
            if not weak_topics and sorted_topics:
                weak_topics = [f"{sorted_topics[0][0]} ({sorted_topics[0][1]}%)"]

            strong_topics = [f"{t} ({acc}%)" for t, acc in sorted_topics if acc >= 70]

            lb_entry = leaderboard_map.get(sid, {})
            rank = lb_entry.get("rank", 1)

            reports.append({
                "student_id": sid,
                "name": data["name"],
                "college_id": data["college_id"],
                "score": total_points,
                "max_score": total_questions * 1000,
                "percentage": percentage,
                "rank": rank,
                "total_students": total_students,
                "correct_count": correct_count,
                "total_questions": total_questions,
                "avg_time": avg_time,
                "topic_scores": topic_scores,
                "topic_breakdown": "\n".join([f"- {t}: {acc}%" for t, acc in topic_scores.items()]),
                "weak_topics": ", ".join(weak_topics) if weak_topics else "None (well-rounded)",
                "strong_topics": ", ".join(strong_topics) if strong_topics else "Consistent performance",
            })

        return reports

    def generate_ai_advice(self, report: dict) -> str:
        """Calls AI with strictly ANONYMOUS student performance to get tailored advice."""
        if self.offline_mode:
            weak = report.get("weak_topics", "advanced Git")
            return (
                f"Great effort in the quiz! You demonstrated strong familiarity with foundational commands and "
                f"quick reaction times. To take your version control skills to the next level, focus on practicing "
                f"{weak}, especially branch reconciliation and interactive workflows. Keep building and experimenting with Git!"
            )

        prompt = STUDENT_FEEDBACK_PROMPT.format(
            score=report["score"],
            max_score=report["max_score"],
            percentage=report["percentage"],
            rank=report["rank"],
            total_students=report["total_students"],
            correct_count=report["correct_count"],
            total_questions=report["total_questions"],
            avg_time=report["avg_time"],
            topic_breakdown=report["topic_breakdown"],
            weak_topics=report["weak_topics"],
        )

        try:
            time.sleep(REPORT_DELAY_SECONDS)
            if self.provider == "gemini":
                response = self.gemini_model.generate_content(
                    prompt,
                    generation_config={"temperature": 0.5, "max_output_tokens": 500},
                )
                return response.text.strip()
            elif self.provider == "groq":
                response = self.groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.5,
                    max_tokens=500,
                )
                return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"AI advice generation error for {report['student_id']}: {e}")
            return (
                f"Solid performance across the board! You showed good command of Git basics. "
                f"We recommend spending extra time practicing {report.get('weak_topics', 'branching and undoing')} "
                f"in hands-on terminal repositories to master real-world conflict resolution."
            )

    def generate_pdf_report(self, report: dict, advice: str, output_path: Path):
        """Builds an individualized PDF report using ReportLab."""
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

            doc = SimpleDocTemplate(
                str(output_path),
                pagesize=letter,
                rightMargin=40,
                leftMargin=40,
                topMargin=40,
                bottomMargin=40,
            )

            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                "Title",
                parent=styles["Heading1"],
                fontSize=20,
                textColor=colors.HexColor("#0F172A"),
                spaceAfter=4,
            )
            subtitle_style = ParagraphStyle(
                "SubTitle",
                parent=styles["Normal"],
                fontSize=10,
                textColor=colors.HexColor("#64748B"),
                spaceAfter=14,
            )
            heading2_style = ParagraphStyle(
                "Heading2",
                parent=styles["Heading2"],
                fontSize=13,
                textColor=colors.HexColor("#1E293B"),
                spaceBefore=10,
                spaceAfter=6,
            )
            body_style = ParagraphStyle(
                "Body",
                parent=styles["Normal"],
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#334155"),
            )
            advice_box_style = ParagraphStyle(
                "Advice",
                parent=styles["Normal"],
                fontSize=10,
                leading=15,
                textColor=colors.HexColor("#0F172A"),
            )

            elements = []

            # Header
            elements.append(Paragraph(f"<b>{EVENT_NAME} — Participant Feedback Report</b>", title_style))
            elements.append(Paragraph(f"Participant: <b>{report['name']}</b> ({report['college_id']}) | Date: {EVENT_DATE}", subtitle_style))
            elements.append(Spacer(1, 10))

            # Scorecard Table
            elements.append(Paragraph("<b>Performance Overview</b>", heading2_style))
            score_data = [
                ["Final Score", f"{report['score']} / {report['max_score']} pts", "Leaderboard Rank", f"Rank #{report['rank']} of {report['total_students']}"],
                ["Accuracy Rate", f"{report['percentage']}%", "Correct Questions", f"{report['correct_count']} of {report['total_questions']}"],
                ["Average Speed", f"{report['avg_time']}s per question", "Strongest Area", report.get("strong_topics", "N/A")],
            ]
            t = Table(score_data, colWidths=[130, 135, 130, 135])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 14))

            # Topic Mastery Breakdown Table
            elements.append(Paragraph("<b>Topic Mastery Breakdown</b>", heading2_style))
            topic_rows = [["Topic Area", "Accuracy", "Assessment"]]
            for topic, acc in report["topic_scores"].items():
                status = "Excellent" if acc >= 80 else "Good" if acc >= 60 else "Needs Practice"
                topic_rows.append([topic.capitalize(), f"{acc}%", status])

            topic_table = Table(topic_rows, colWidths=[180, 150, 200])
            topic_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF2F6")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            elements.append(topic_table)
            elements.append(Spacer(1, 14))

            # Tutor Advice Box
            elements.append(Paragraph("<b>Personalized Tutor Feedback & Next Steps</b>", heading2_style))
            advice_table = Table([[Paragraph(advice, advice_box_style)]], colWidths=[530])
            advice_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#86EFAC")),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
            ]))
            elements.append(advice_table)

            doc.build(elements)
        except Exception as e:
            logger.error(f"Failed to generate PDF for {report['student_id']}: {e}")

    def run(self):
        logger.info("🚀 Building student feedback reports...")
        template_reports = self.build_template_data()
        logger.info(f"📋 Found {len(template_reports)} students to process.")

        all_feedback_records = []

        for idx, report in enumerate(template_reports):
            sid = report["student_id"]
            logger.info(f"  [{idx + 1}/{len(template_reports)}] Generating feedback for {sid} (Rank #{report['rank']})...")

            advice = self.generate_ai_advice(report)
            report["ai_advice"] = advice
            all_feedback_records.append(report)

            # Generate individual PDF
            pdf_path = self.output_dir / f"{sid}_report.pdf"
            self.generate_pdf_report(report, advice, pdf_path)

        # Save summary JSON
        summary_path = self.output_dir.parent / "student_feedback_summary.json"
        with open(summary_path, "w") as f:
            json.dump(all_feedback_records, f, indent=2)

        logger.info(f"\n🎉 Student reports complete!")
        logger.info(f"   PDFs saved to: {self.output_dir}/")
        logger.info(f"   Summary JSON: {summary_path}")
        return all_feedback_records


if __name__ == "__main__":
    builder = ReportBuilder()
    builder.run()
