# layer5-cheat/report/evidence_pack.py
"""
Generate a concise, objective one-page evidence pack for a flagged student.

HARD RULES ENFORCED:
1. This system flags patterns. It NEVER proves cheating.
2. Every output explicitly includes uncertainty, caveats, and benign explanations.
3. No automatic penalties. Human reviewer decides every action.
4. Direction is never stated for pairs.
"""

from pathlib import Path
from datetime import datetime
import json
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def generate_student_evidence_pack(
    student_id: int,
    tier_info: dict,
    person_fit_info: dict = None,
    timing_info: dict = None,
    pair_matches: list[dict] = None,
    behavior_info: dict = None,
) -> str:
    """
    Produce markdown evidence pack for a single student.
    """
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    md = []
    md.append(f"# Confidential Cheat Review Dossier: Student {student_id}")
    md.append(f"Generated: {timestamp} | Status: Pending Human Adjudication\n")

    md.append("> [!IMPORTANT]")
    md.append("> **Statistical Flag Notice:** This system flags statistical patterns; it **NEVER proves cheating**.")
    md.append("> Plausible benign explanations exist for every metric below (e.g. erratic guessing, shared misconceptions,")
    md.append("> local Wi-Fi reconnects, or fast reading speeds). Automated penalties are prohibited.\n")

    # Tier Summary
    md.append("## 1. Summary Assessment")
    md.append(f"| Metric | Assigned Value |")
    md.append(f"|---|---|")
    md.append(f"| **Assigned Tier** | **{tier_info.get('tier', 'Review')}** |")
    md.append(f"| **Trust Score Impact** | {tier_info.get('trust_score', 55)} / 100 |")
    md.append(f"| **Families Fired** | {', '.join(tier_info.get('families_fired', [])) or 'None'} |")
    md.append(f"| **Podium Candidate** | {'Yes (Top 10 Finisher)' if tier_info.get('is_podium') else 'No'} |")
    md.append(f"| **Key Observations** | {tier_info.get('evidence_summary', 'N/A')} |\n")

    # Person-fit
    md.append("## 2. Person-Fit Analysis (Unexpected Correct Answers)")
    if person_fit_info:
        md.append(f"- **Simulated Empirical p-value:** `{person_fit_info.get('min_p', 'N/A')}`")
        md.append(f"- **Unexpected-Hit Score:** `{person_fit_info.get('unexpected_hit', 'N/A')}`")
        md.append(f"- **Guttman Inversion Index:** `{person_fit_info.get('guttman_index', 'N/A')}`")
        md.append(f"- **Hard-vs-Easy Accuracy Gap:** `{person_fit_info.get('hard_easy_gap', 'N/A')}`")
        md.append(f"- *Caveat:* With only 15 items, person-fit sensitivity is constrained. Erratic but honest performance can produce low p-values.\n")
    else:
        md.append("- No abnormal person-fit inconsistency detected.\n")

    # Response Time
    md.append("## 3. Response Time Anomalies")
    if timing_info:
        md.append(f"- **Fast-Correct on Hard Questions:** `{timing_info.get('n_fast_correct_hard', 0)}` items")
        md.append(f"- **Slow-Correct with Tab Blur:** `{timing_info.get('n_slow_correct_tab', 0)}` items")
        md.append(f"- **Standardized Timing Misfit (z):** `{timing_info.get('misfit_z', 0.0)}`")
        if timing_info.get('fast_correct_details'):
            md.append("\n  **Fast-Correct Hard Item Details:**")
            for item in timing_info['fast_correct_details']:
                md.append(f"  - Item `{item.get('template_id')}`: latency `{item.get('rt_ms')}ms` (z={item.get('z_score')})")
        md.append(f"- *Caveat:* Fast responses may reflect strong familiarity with Git CLI commands rather than advance knowledge.\n")
    else:
        md.append("- Timing metrics are consistent with cohort expectations.\n")

    # Pair Similarity
    md.append("## 4. Wrong-Answer Similarity (Collusion Detection)")
    if pair_matches and len(pair_matches) > 0:
        md.append("| Paired Student | Shared Items | Identical Wrong Options | Weighted Match Score | Direction |")
        md.append("|---|---|---|---|---|")
        for match in pair_matches[:5]:
            other_id = match['student_b'] if match['student_a'] == student_id else match['student_a']
            md.append(f"| Student {other_id} | {match.get('n_shared_items')} | {match.get('incorrect_matches')} | {match.get('weighted_match_score')} | **Unknown (Non-directional)** |")
        md.append("\n*Hard Rule #9 Enforced:* Directionality is never inferred. The statistical test identifies shared error frequency, not which student originated the response.\n")
    else:
        md.append("- No statistically anomalous wrong-answer similarity observed with other candidates.\n")

    # Human Reviewer Signoff
    md.append("## 5. Human Adjudication & Two-Organizer Sign-off")
    md.append("```")
    md.append("[ ] Clear — Benign explanation accepted (no penalty)")
    md.append("[ ] Warning — Minor anomaly logged; certificate issued")
    md.append("[ ] Score Adjustment — Specific question points deducted")
    md.append("[ ] Disqualification — Clear, corroborated bad-faith violation")
    md.append("")
    md.append("Primary Reviewer: _______________________ Date: ______________")
    md.append("Secondary Reviewer: _____________________ Date: ______________")
    md.append("Justification Notes:")
    md.append("______________________________________________________________")
    md.append("```")

    return '\n'.join(md)
