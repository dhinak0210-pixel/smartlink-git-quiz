# layer3-ai/after/announcement_drafter.py
# Drafts celebratory winner announcements for LinkedIn, Discord/Telegram, and Email.
# Run: python after/announcement_drafter.py

import json
import logging
import sys
from pathlib import Path

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    AFTER_DIR, AI_PROVIDER, GEMINI_API_KEY, GROQ_API_KEY,
    GEMINI_MODEL, GROQ_MODEL, EVENT_NAME, ORGANIZER_NAME
)
from generate.prompts import ANNOUNCEMENT_DRAFT_PROMPT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class AnnouncementDrafter:
    def __init__(self):
        self.output_dir = AFTER_DIR / "output" / "announcements"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.provider = AI_PROVIDER

    def load_data(self) -> tuple[list[dict], dict]:
        leaderboard_path = self.output_dir.parent / "leaderboard_raw.json"
        stats_path = self.output_dir.parent / "statistics.json"

        leaderboard = []
        if leaderboard_path.exists():
            with open(leaderboard_path) as f:
                leaderboard = json.load(f)

        stats = {}
        if stats_path.exists():
            with open(stats_path) as f:
                stats = json.load(f)

        return leaderboard, stats

    def draft_announcements(self, top_winners: list[dict], stats: dict) -> dict:
        """Calls AI or deterministic generator to produce multi-platform drafts."""
        winners_summary = json.dumps(top_winners, indent=2)

        prompt = ANNOUNCEMENT_DRAFT_PROMPT.format(
            winners_data_json=winners_summary,
            event_name=EVENT_NAME,
            total_participants=stats.get("total_students", len(top_winners)),
            top_score=top_winners[0]["total_points"] if top_winners else 0,
        )

        if self.provider == "gemini" and GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel(GEMINI_MODEL)
                response = model.generate_content(prompt, generation_config={"temperature": 0.7})
                text = response.text.strip()
                if text.startswith("```"):
                    lines = text.split("\n")
                    lines = [l for l in lines if not l.strip().startswith("```")]
                    text = "\n".join(lines).strip()
                return json.loads(text)
            except Exception as e:
                logger.warning(f"AI announcement drafting failed ({e}). Using deterministic template.")

        elif self.provider == "groq" and GROQ_API_KEY:
            try:
                from groq import Groq
                client = Groq(api_key=GROQ_API_KEY)
                response = client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                )
                text = response.choices[0].message.content.strip()
                if text.startswith("```"):
                    lines = text.split("\n")
                    lines = [l for l in lines if not l.strip().startswith("```")]
                    text = "\n".join(lines).strip()
                return json.loads(text)
            except Exception as e:
                logger.warning(f"Groq announcement drafting failed ({e}). Using deterministic template.")

        # High-quality deterministic templates
        w1 = top_winners[0]["name"] if len(top_winners) > 0 else "Champion"
        w2 = top_winners[1]["name"] if len(top_winners) > 1 else "Runner-Up"
        w3 = top_winners[2]["name"] if len(top_winners) > 2 else "Third Place"

        linkedin = (
            f"🎉 Announcing the Winners of {EVENT_NAME}! 🚀\n\n"
            f"Over {stats.get('total_students', 20)} talented developers competed in an intense, fast-paced Git knowledge showdown testing everything from fast-forward merges to interactive rebasing.\n\n"
            f"Big congratulations to our Top 3 Winners:\n"
            f"🥇 1st Place: {w1} ({top_winners[0].get('college_id', '')}) — {top_winners[0].get('total_points', 0)} pts\n"
            f"🥈 2nd Place: {w2} ({top_winners[1].get('college_id', '')}) — {top_winners[1].get('total_points', 0)} pts\n"
            f"🥉 3rd Place: {w3} ({top_winners[2].get('college_id', '')}) — {top_winners[2].get('total_points', 0)} pts\n\n"
            f"Kudos to every single participant who joined! Personalized feedback reports and tamper-evident certificates are now available for download.\n\n"
            f"#Git #GitHub #CodingCompetition #TechQuiz #DeveloperCommunity #SmartLink"
        )

        discord = (
            f"🏆 **{EVENT_NAME.upper()} WINNERS ANNOUNCEMENT** 🏆\n\n"
            f"What a phenomenal competition! Thank you to everyone who showed up and pushed their Git skills to the limit!\n\n"
            f"Here are your podium finishers:\n"
            f"🥇 **1st Place:** `{w1}` ({top_winners[0].get('total_points', 0)} pts)\n"
            f"🥈 **2nd Place:** `{w2}` ({top_winners[1].get('total_points', 0)} pts)\n"
            f"🥉 **3rd Place:** `{w3}` ({top_winners[2].get('total_points', 0)} pts)\n\n"
            f"📜 **Certificates & Feedback:**\n"
            f"All individual PDF reports and verified certificates have been minted! Check your emails or DM the admins to claim your credentials.\n\n"
            f"Keep pushing, branching, and rebasing! 🔥"
        )

        email = (
            f"Subject: Congratulations on Completing {EVENT_NAME}! Results & Certificate Inside\n\n"
            f"Dear Participant,\n\n"
            f"Thank you for competing in {EVENT_NAME} organized by {ORGANIZER_NAME}.\n\n"
            f"We are thrilled to officially announce our tournament champions:\n"
            f"- 1st Place: {w1} ({top_winners[0].get('total_points', 0)} pts)\n"
            f"- 2nd Place: {w2} ({top_winners[1].get('total_points', 0)} pts)\n"
            f"- 3rd Place: {w3} ({top_winners[2].get('total_points', 0)} pts)\n\n"
            f"Your individual PDF feedback report (featuring personalized tutor guidance and topic mastery breakdowns) "
            f"and your verified digital certificate of achievement have been generated and attached.\n\n"
            f"We encourage you to share your achievement on LinkedIn and tag our organization!\n\n"
            f"Best regards,\n"
            f"{ORGANIZER_NAME}"
        )

        return {
            "linkedin": linkedin,
            "discord": discord,
            "email": email,
        }

    def run(self):
        logger.info("🚀 Drafting winner announcements...")
        leaderboard, stats = self.load_data()

        top_winners = leaderboard[:3] if leaderboard else []
        if not top_winners:
            logger.warning("No leaderboard data found. Using sample winner placeholders.")
            top_winners = [
                {"name": "Alice Johnson", "college_id": "ENG001", "total_points": 14200},
                {"name": "Bob Smith", "college_id": "ENG002", "total_points": 13850},
                {"name": "Charlie Davis", "college_id": "ENG003", "total_points": 13400},
            ]

        drafts = self.draft_announcements(top_winners, stats)

        # Save JSON
        with open(self.output_dir / "announcements.json", "w") as f:
            json.dump(drafts, f, indent=2)

        # Save individual markdown files
        with open(self.output_dir / "linkedin_post.md", "w") as f:
            f.write(drafts.get("linkedin", ""))
        with open(self.output_dir / "discord_post.md", "w") as f:
            f.write(drafts.get("discord", ""))
        with open(self.output_dir / "email_draft.md", "w") as f:
            f.write(drafts.get("email", ""))

        logger.info(f"\n🎉 Announcements drafted successfully!")
        logger.info(f"   Saved to: {self.output_dir}/")
        return drafts


if __name__ == "__main__":
    drafter = AnnouncementDrafter()
    drafter.run()
