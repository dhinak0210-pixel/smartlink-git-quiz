# layer3-ai/export/anonymizer.py
# Replaces PII with anonymous IDs before sending data to AI services.
# CRITICAL: Never send student names, emails, or college IDs to AI APIs.

import json
import hashlib
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class Anonymizer:
    def __init__(self, salt: str = "smartlink-git-quiz-2026-integrity-salt"):
        self.salt = salt
        self.mapping: dict[str, str] = {}  # real_id → anon_id
        self.reverse_mapping: dict[str, str] = {}  # anon_id → real_id

    def anonymize_id(self, real_id: str) -> str:
        """Create a deterministic pseudonymous ID from a real ID."""
        if not real_id:
            return "STU-ANON0000"

        if real_id not in self.mapping:
            hash_input = f"{self.salt}:{real_id}"
            anon = f"STU-{hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()}"
            self.mapping[real_id] = anon
            self.reverse_mapping[anon] = real_id
        return self.mapping[real_id]

    def anonymize_student_data(self, data: list[dict]) -> list[dict]:
        """Replace all PII in student data with anonymous IDs."""
        anonymized = []
        for row in data:
            anon_row = dict(row)

            # Anonymize student_id
            if "student_id" in anon_row and anon_row["student_id"]:
                anon_row["student_id"] = self.anonymize_id(str(anon_row["student_id"]))

            if "id" in anon_row and ("college_id" in anon_row or "name" in anon_row):
                anon_row["id"] = self.anonymize_id(str(anon_row["id"]))

            # Strip all direct PII fields
            for pii_field in ("name", "college_id", "email", "ip_address", "user_agent"):
                anon_row.pop(pii_field, None)

            # Handle nested students relation if present
            if "students" in anon_row and isinstance(anon_row["students"], dict):
                sub = dict(anon_row["students"])
                sub.pop("name", None)
                sub.pop("college_id", None)
                sub.pop("email", None)
                anon_row["students"] = sub

            anonymized.append(anon_row)
        return anonymized

    def save_mapping(self, path: Path):
        """Save the ID mapping to a strictly LOCAL file (never upload this)."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            json.dump({
                "description": "DO NOT SHARE OR COMMIT. Contains mapping from real student IDs to anonymous tokens.",
                "real_to_anon": self.mapping,
                "anon_to_real": self.reverse_mapping,
            }, f, indent=2)
        logger.info(f"🔒 Confidential mapping saved to {path} (KEEP THIS LOCAL ON ADMIN LAPTOP)")

    def load_mapping(self, path: Path) -> bool:
        """Load an existing local ID mapping if available."""
        if not path.exists():
            return False
        try:
            with open(path, "r") as f:
                data = json.load(f)
                self.mapping = data.get("real_to_anon", {})
                self.reverse_mapping = data.get("anon_to_real", {})
                return True
        except Exception:
            return False
