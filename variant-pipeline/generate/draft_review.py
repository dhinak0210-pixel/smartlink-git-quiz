# variant-pipeline/generate/draft_review.py
"""
Review and syntax validation of drafted templates.
"""

from pathlib import Path
import yaml

def review_template_structure(template: dict) -> tuple[bool, list[str]]:
    """Verify that a template meets the schema definition."""
    issues = []
    required = ['id', 'topic', 'difficulty', 'stem', 'correct', 'distractors', 'goal', 'setup']

    for req in required:
        if req not in template:
            issues.append(f"Missing required field '{req}'")

    if 'distractors' in template:
        if len(template['distractors']) != 3:
            issues.append(f"Expected exactly 3 distractors, found {len(template['distractors'])}")
        for i, d in enumerate(template['distractors']):
            if 'text' not in d or 'reason' not in d:
                issues.append(f"Distractor #{i+1} missing text or reason tag")

    return len(issues) == 0, issues
