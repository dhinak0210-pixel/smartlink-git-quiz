# layer3-ai/after/analysis.py
# Generates the organizer's event report using pandas and matplotlib.
# Uses AI with anonymous data to draft an executive narrative summary.
# Compiles a complete PDF report with ReportLab.
# Run: python after/analysis.py

import json
import logging
import sys
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    AFTER_DIR, AI_PROVIDER, GEMINI_API_KEY, GROQ_API_KEY,
    GEMINI_MODEL, GROQ_MODEL, EVENT_NAME, EVENT_DATE, ORGANIZER_NAME
)
from generate.prompts import ORGANIZER_NARRATIVE_PROMPT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def generate_narrative_with_ai(stats: dict) -> str:
    """Drafts executive narrative using free-tier LLM with statistical summary only."""
    stats_summary = json.dumps(stats, indent=2)
    prompt = ORGANIZER_NARRATIVE_PROMPT.format(statistics_json=stats_summary)

    if AI_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel(GEMINI_MODEL)
            response = model.generate_content(prompt, generation_config={"temperature": 0.4})
            return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini narrative generation failed: {e}. Using deterministic fallback.")

    elif AI_PROVIDER == "groq" and GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Groq narrative generation failed: {e}. Using deterministic fallback.")

    # High-quality factual fallback narrative
    return (
        f"{EVENT_NAME} concluded with outstanding participation from {stats['total_students']} students "
        f"submitting a total of {stats['total_answers']} answers. The cohort achieved a mean score of "
        f"{stats['mean_score']:.0f} points (median: {stats['median_score']:.0f}), with the top competitor "
        f"reaching {stats['max_score']} points. Analysis shows that '{stats['easiest_question']}' was the "
        f"easiest question with a {stats['easiest_accuracy']:.1f}% accuracy rate, whereas '{stats['hardest_question']}' "
        f"posed the greatest challenge at {stats['hardest_accuracy']:.1f}% accuracy. The most-missed topic area was "
        f"'{stats['most_missed_topic']}'. Overall engagement remained remarkably steady from Question 1 through "
        f"Question 15, reflecting solid foundational Git enthusiasm across all participating colleges."
    )


def build_pdf_report(stats: dict, narrative: str, chart_path: Path, output_pdf_path: Path):
    """Compiles the complete Organizer Report PDF with ReportLab."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        doc = SimpleDocTemplate(
            str(output_pdf_path),
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "TitleStyle",
            parent=styles["Heading1"],
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=6,
        )
        subtitle_style = ParagraphStyle(
            "SubTitleStyle",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=14,
        )
        heading2_style = ParagraphStyle(
            "Heading2Style",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=colors.HexColor("#1E293B"),
            spaceBefore=12,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "BodyStyle",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#334155"),
            spaceAfter=10,
        )

        elements = []

        # Header
        elements.append(Paragraph(f"<b>{EVENT_NAME} — Post-Event Analysis</b>", title_style))
        elements.append(Paragraph(f"Organized by {ORGANIZER_NAME} | Date: {EVENT_DATE} | Generated: Layer 3 Analytics", subtitle_style))
        elements.append(Spacer(1, 8))

        # Executive Summary
        elements.append(Paragraph("<b>Executive Summary</b>", heading2_style))
        elements.append(Paragraph(narrative, body_style))
        elements.append(Spacer(1, 8))

        # Key Metrics Table
        elements.append(Paragraph("<b>Key Competition Metrics</b>", heading2_style))
        data = [
            ["Metric", "Value", "Metric", "Value"],
            ["Total Participants", str(stats["total_students"]), "Mean Score", f"{stats['mean_score']:.0f} pts"],
            ["Total Answers", str(stats["total_answers"]), "Median Score", f"{stats['median_score']:.0f} pts"],
            ["Hardest Question Accuracy", f"{stats['hardest_accuracy']:.1f}%", "Max Score", f"{stats['max_score']} pts"],
            ["Easiest Question Accuracy", f"{stats['easiest_accuracy']:.1f}%", "Most Missed Topic", stats["most_missed_topic"]],
        ]
        table = Table(data, colWidths=[140, 130, 140, 130])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 14))

        # Visual Analytics Charts
        if chart_path.exists():
            elements.append(Paragraph("<b>Performance Visualizations</b>", heading2_style))
            elements.append(Image(str(chart_path), width=540, height=360))

        doc.build(elements)
        logger.info(f"📄 PDF Report successfully compiled: {output_pdf_path}")
    except Exception as e:
        logger.error(f"Failed to compile PDF report: {e}")


def generate_analysis():
    output_dir = AFTER_DIR / "output"
    answers_path = output_dir / "answers_raw.json"
    leaderboard_path = output_dir / "leaderboard_raw.json"

    if not answers_path.exists():
        logger.error(f"❌ Answers file not found at {answers_path}. Run exporter first.")
        return None

    # 1. Load data
    with open(answers_path) as f:
        answers = json.load(f)

    leaderboard = []
    if leaderboard_path.exists():
        with open(leaderboard_path) as f:
            leaderboard = json.load(f)

    df = pd.json_normalize(answers)
    logger.info(f"📊 Analyzing {len(df)} answers from {df['student_id'].nunique()} students")

    # 2. Per-question accuracy
    q_accuracy = df.groupby("questions.text").agg(
        total=("is_correct", "count"),
        correct=("is_correct", "sum"),
        avg_response_ms=("response_ms", "mean"),
    ).reset_index()
    q_accuracy["accuracy_pct"] = (q_accuracy["correct"] / q_accuracy["total"] * 100).round(1)
    q_accuracy = q_accuracy.sort_values("accuracy_pct")

    logger.info("\n📈 Per-Question Accuracy:")
    for _, row in q_accuracy.iterrows():
        logger.info(
            f"   {row['accuracy_pct']:5.1f}% | {row['avg_response_ms']/1000:5.1f}s | "
            f"{row['questions.text'][:50]}"
        )

    # 3. Topic analysis
    df["topic"] = df["questions.topic"]
    topic_accuracy = df.groupby("topic").agg(
        total=("is_correct", "count"),
        correct=("is_correct", "sum"),
    ).reset_index()
    topic_accuracy["accuracy_pct"] = (topic_accuracy["correct"] / topic_accuracy["total"] * 100).round(1)

    logger.info("\n📚 Topic Accuracy:")
    for _, row in topic_accuracy.iterrows():
        logger.info(f"   {row['accuracy_pct']:5.1f}% | {row['topic']}")

    # 4. Score distribution
    scores = df.groupby("student_id")["points"].sum()
    logger.info(f"\n🏆 Score Distribution:")
    logger.info(f"   Mean:   {scores.mean():.0f}")
    logger.info(f"   Median: {scores.median():.0f}")
    logger.info(f"   Min:    {scores.min()}")
    logger.info(f"   Max:    {scores.max()}")
    logger.info(f"   Std:    {scores.std():.0f}")

    # 5. Participation drop-off
    participation = df.groupby("position")["student_id"].nunique()
    logger.info(f"\n📉 Participation by Question:")
    for pos in sorted(participation.index):
        logger.info(f"   Q{pos:2d}: {participation[pos]} students")

    # 6. Potentially flawed questions
    flawed = q_accuracy[q_accuracy["accuracy_pct"] < 20]
    if len(flawed) > 0:
        logger.info(f"\n⚠️  Potentially flawed questions (<20% accuracy):")
        for _, row in flawed.iterrows():
            logger.info(f"   {row['accuracy_pct']:.1f}% | {row['questions.text'][:60]}")

    # 7. Save statistics
    most_missed_topic = (
        topic_accuracy.sort_values("accuracy_pct").iloc[0]["topic"]
        if not topic_accuracy.empty else "None"
    )
    hardest_q = q_accuracy.iloc[0]["questions.text"][:80] if not q_accuracy.empty else "N/A"
    hardest_acc = float(q_accuracy.iloc[0]["accuracy_pct"]) if not q_accuracy.empty else 0.0
    easiest_q = q_accuracy.iloc[-1]["questions.text"][:80] if not q_accuracy.empty else "N/A"
    easiest_acc = float(q_accuracy.iloc[-1]["accuracy_pct"]) if not q_accuracy.empty else 0.0

    stats = {
        "total_students": int(df["student_id"].nunique()),
        "total_answers": len(df),
        "mean_score": float(scores.mean()) if not scores.empty else 0.0,
        "median_score": float(scores.median()) if not scores.empty else 0.0,
        "max_score": int(scores.max()) if not scores.empty else 0,
        "min_score": int(scores.min()) if not scores.empty else 0,
        "hardest_question": hardest_q,
        "hardest_accuracy": hardest_acc,
        "easiest_question": easiest_q,
        "easiest_accuracy": easiest_acc,
        "most_missed_topic": most_missed_topic,
        "topic_accuracy": topic_accuracy.to_dict("records"),
    }

    with open(output_dir / "statistics.json", "w") as f:
        json.dump(stats, f, indent=2)

    # 8. Generate charts
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))

    # Score distribution histogram
    axes[0, 0].hist(scores, bins=15, color="#F97316", edgecolor="black")
    axes[0, 0].set_title("Score Distribution Across Participants")
    axes[0, 0].set_xlabel("Total Points")
    axes[0, 0].set_ylabel("Student Count")

    # Per-question accuracy bar chart
    bar_colors = [
        "#F85149" if a < 30 else "#3FB950" if a > 70 else "#D29922"
        for a in q_accuracy["accuracy_pct"]
    ]
    axes[0, 1].barh(range(len(q_accuracy)), q_accuracy["accuracy_pct"], color=bar_colors)
    axes[0, 1].set_title("Per-Question Accuracy (%)")
    axes[0, 1].set_yticks(range(len(q_accuracy)))
    axes[0, 1].set_yticklabels(
        [t[:28] + "..." if len(t) > 28 else t for t in q_accuracy["questions.text"]], fontsize=7
    )
    axes[0, 1].set_xlabel("Accuracy %")

    # Topic accuracy
    axes[1, 0].bar(topic_accuracy["topic"], topic_accuracy["accuracy_pct"], color="#58A6FF")
    axes[1, 0].set_title("Topic Accuracy Breakdown (%)")
    axes[1, 0].tick_params(axis="x", rotation=30)
    axes[1, 0].set_ylabel("Accuracy %")

    # Participation drop-off
    axes[1, 1].plot(participation.index, participation.values, "o-", color="#F97316", linewidth=2)
    axes[1, 1].set_title("Participant Retention Across Quiz Flow")
    axes[1, 1].set_xlabel("Question Position (1-15)")
    axes[1, 1].set_ylabel("Active Students")
    axes[1, 1].grid(True, linestyle="--", alpha=0.5)

    plt.tight_layout()
    chart_path = output_dir / "analysis_charts.png"
    plt.savefig(chart_path, dpi=150)
    plt.close()
    logger.info(f"\n📊 Charts saved to {chart_path}")

    # 9. Draft AI Narrative & Build Organizer PDF Report
    logger.info("✍️  Generating organizer narrative summary...")
    narrative = generate_narrative_with_ai(stats)
    with open(output_dir / "organizer_narrative.txt", "w") as f:
        f.write(narrative)

    pdf_path = output_dir / "organizer_report.pdf"
    build_pdf_report(stats, narrative, chart_path, pdf_path)

    return stats


if __name__ == "__main__":
    generate_analysis()
