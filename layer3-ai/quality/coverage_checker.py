# layer3-ai/quality/coverage_checker.py
# Verifies that the final question set matches the blueprint distribution.

import json
import logging
import sys
from pathlib import Path
from collections import Counter

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import BLUEPRINT_DIR, QUESTIONS_PER_DIFFICULTY

logger = logging.getLogger(__name__)


class CoverageChecker:
    def __init__(self):
        with open(BLUEPRINT_DIR / "blueprint.json") as f:
            self.blueprint = json.load(f)

    def check(self, questions: list[dict]) -> list[dict]:
        """Check topic and difficulty coverage against the blueprint."""
        issues = []

        # Check difficulty distribution
        diff_counts = Counter(q.get("difficulty", "unknown") for q in questions)
        for diff, expected in QUESTIONS_PER_DIFFICULTY.items():
            actual = diff_counts.get(diff, 0)
            if actual < expected:
                issues.append({
                    "question": "COVERAGE",
                    "gate": "coverage",
                    "detail": f"Only {actual} {diff} questions (need {expected})",
                })

        # Check topic coverage
        topic_counts = Counter(q.get("topic_tag", q.get("topic", "unknown")) for q in questions)
        for topic in self.blueprint["topics"]:
            total_needed = sum(topic["distribution"].values())
            actual = topic_counts.get(topic["name"], 0)
            if actual < total_needed:
                issues.append({
                    "question": "COVERAGE",
                    "gate": "coverage",
                    "detail": f"Topic '{topic['name']}': {actual} questions (need {total_needed})",
                })

        return issues
