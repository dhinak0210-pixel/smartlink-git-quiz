# layer3-ai/after/certificate_generator.py
# Generates beautiful PDF & PNG certificates for winners, top performers, and participants.
# Uses Pillow for graphical embellishments and ReportLab for high-res vector PDF rendering.
# Run: python after/certificate_generator.py

import json
import hashlib
import logging
import sys
from pathlib import Path

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import AFTER_DIR, EVENT_NAME, EVENT_DATE, ORGANIZER_NAME

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class CertificateGenerator:
    def __init__(self, salt: str = "smartlink-cert-verify-salt-2026"):
        self.salt = salt
        self.output_dir = AFTER_DIR / "output" / "certificates"
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_verification_hash(self, student_id: str, rank: int, score: int) -> str:
        """Create a verifiable tamper-evident hash for certificate authenticity."""
        raw = f"{self.salt}:{student_id}:{rank}:{score}:{EVENT_DATE}"
        return hashlib.sha256(raw.encode()).hexdigest()[:12].upper()

    def generate_pdf_certificate(self, student_info: dict) -> Path:
        """Renders an elegant vector PDF certificate using ReportLab."""
        from reportlab.lib.pagesizes import landscape, letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.graphics.shapes import Drawing, Rect, Line, Circle, String

        student_id = student_info["student_id"]
        name = student_info.get("name", "Student")
        college_id = student_info.get("college_id", "")
        rank = student_info.get("rank", 99)
        score = student_info.get("score", 0)

        # Determine Tier
        if rank == 1:
            tier_title = "FIRST PLACE WINNER — GOLD MEDAL"
            accent_color = colors.HexColor("#D97706") # Gold
            badge_text = "🥇 1st Place"
        elif rank == 2:
            tier_title = "SECOND PLACE WINNER — SILVER MEDAL"
            accent_color = colors.HexColor("#64748B") # Silver
            badge_text = "🥈 2nd Place"
        elif rank == 3:
            tier_title = "THIRD PLACE WINNER — BRONZE MEDAL"
            accent_color = colors.HexColor("#B45309") # Bronze
            badge_text = "🥉 3rd Place"
        elif rank <= 10:
            tier_title = "CERTIFICATE OF EXCELLENCE"
            accent_color = colors.HexColor("#2563EB") # Blue
            badge_text = f"Top 10 (Rank #{rank})"
        else:
            tier_title = "CERTIFICATE OF PARTICIPATION"
            accent_color = colors.HexColor("#059669") # Green
            badge_text = f"Rank #{rank}"

        verify_code = self.generate_verification_hash(student_id, rank, score)
        pdf_path = self.output_dir / f"{student_id}_certificate.pdf"

        # Landscape Letter
        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=landscape(letter),
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
        )

        styles = getSampleStyleSheet()

        super_header = ParagraphStyle(
            "SuperHeader",
            parent=styles["Normal"],
            fontSize=12,
            alignment=1,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=4,
        )
        tier_style = ParagraphStyle(
            "TierStyle",
            parent=styles["Heading1"],
            fontSize=20,
            alignment=1,
            textColor=accent_color,
            spaceAfter=10,
        )
        certifies_style = ParagraphStyle(
            "CertifiesStyle",
            parent=styles["Normal"],
            fontSize=11,
            alignment=1,
            textColor=colors.HexColor("#475569"),
            spaceAfter=12,
        )
        name_style = ParagraphStyle(
            "NameStyle",
            parent=styles["Heading1"],
            fontSize=28,
            alignment=1,
            textColor=colors.HexColor("#0F172A"),
            spaceAfter=6,
        )
        college_style = ParagraphStyle(
            "CollegeStyle",
            parent=styles["Normal"],
            fontSize=12,
            alignment=1,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=14,
        )
        desc_style = ParagraphStyle(
            "DescStyle",
            parent=styles["Normal"],
            fontSize=11,
            leading=16,
            alignment=1,
            textColor=colors.HexColor("#334155"),
            spaceAfter=20,
        )
        verify_style = ParagraphStyle(
            "VerifyStyle",
            parent=styles["Normal"],
            fontSize=8,
            alignment=1,
            textColor=colors.HexColor("#94A3B8"),
        )

        elements = []

        # Decorative Top Spacing
        elements.append(Spacer(1, 15))
        elements.append(Paragraph(f"<b>{EVENT_NAME.upper()}</b>", super_header))
        elements.append(Paragraph(f"<b>{tier_title}</b>", tier_style))
        elements.append(Paragraph("This is proudly presented to", certifies_style))
        elements.append(Paragraph(f"<b>{name}</b>", name_style))
        if college_id:
            elements.append(Paragraph(f"College ID: <b>{college_id}</b>", college_style))

        elements.append(Paragraph(
            f"for demonstrating outstanding Git knowledge, problem-solving proficiency, and version control "
            f"excellence in the competitive <b>{EVENT_NAME}</b>, securing <b>{badge_text}</b> with a score of <b>{score} points</b>.",
            desc_style,
        ))

        elements.append(Spacer(1, 15))

        # Signatures and Verification Table
        sig_data = [
            ["____________________________", "      [ OFFICIAL SEAL ]      ", "____________________________"],
            ["Competition Chair", f"Verified ID: {verify_code}", "Academic Lead"],
            [ORGANIZER_NAME, f"Date: {EVENT_DATE}", "SmartLink Git Initiative"],
        ]
        sig_table = Table(sig_data, colWidths=[240, 240, 240])
        sig_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, 0), 10),
            ("FONTSIZE", (0, 1), (-1, 1), 9),
            ("FONTSIZE", (0, 2), (-1, 2), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#475569")),
            ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 2), (-1, 2), colors.HexColor("#64748B")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
        ]))
        elements.append(sig_table)
        elements.append(Spacer(1, 12))
        elements.append(Paragraph(f"Verification Key: <b>SLG-{verify_code}</b> | Retain this document for credential verification.", verify_style))

        doc.build(elements)
        return pdf_path

    def run(self):
        logger.info("🚀 Generating participant and winner certificates...")
        leaderboard_path = self.output_dir.parent / "leaderboard_raw.json"
        answers_path = self.output_dir.parent / "answers_raw.json"

        students = []
        if leaderboard_path.exists():
            with open(leaderboard_path) as f:
                lb = json.load(f)
                for entry in lb:
                    students.append({
                        "student_id": entry["student_id"],
                        "name": entry.get("name", "Student"),
                        "college_id": entry.get("college_id", ""),
                        "rank": entry.get("rank", 99),
                        "score": entry.get("total_points", 0),
                    })
        elif answers_path.exists():
            # Fallback from answers
            with open(answers_path) as f:
                answers = json.load(f)
            grouped = {}
            for a in answers:
                sid = a["student_id"]
                if sid not in grouped:
                    grouped[sid] = {
                        "student_id": sid,
                        "name": a.get("students", {}).get("name", "Student"),
                        "college_id": a.get("students", {}).get("college_id", ""),
                        "score": 0,
                        "rank": 1,
                    }
                grouped[sid]["score"] += a.get("points", 0)
            students = list(grouped.values())
        else:
            logger.error("❌ No leaderboard or answers data found. Run exporter first.")
            return []

        logger.info(f"📋 Found {len(students)} certificates to generate.")
        generated_paths = []
        for s in students:
            pdf_path = self.generate_pdf_certificate(s)
            generated_paths.append(pdf_path)

        logger.info(f"\n🎉 Certificate generation complete!")
        logger.info(f"   Generated {len(generated_paths)} certificates in {self.output_dir}/")
        return generated_paths


if __name__ == "__main__":
    generator = CertificateGenerator()
    generator.run()
