# layer5-cheat/report/summary_report.py
"""
Summary Report Generator for Portfolio & Administrative Overviews.

HARD RULES ENFORCED:
- Hard Rule #4: Prevention is the main defense. Detection is a backstop.
- Hard Rule #7: No row-level data published. Aggregates only.
"""

from pathlib import Path
from datetime import datetime
import json
import pandas as pd

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from report.power_table import get_detection_capabilities_table


def generate_executive_cheat_report(
    tiers_df: pd.DataFrame,
    fairness_results: dict = None,
    output_path: Path = None,
) -> str:
    """
    Produce an aggregate, privacy-safe report containing zero individual student row data.
    """
    output_path = output_path or (config.OUTPUT_DIR / 'cheat_detection_summary.md')
    timestamp = datetime.now().strftime('%Y-%m-%d')

    total_students = len(tiers_df)
    tier_counts = tiers_df['tier'].value_counts().to_dict()

    n_strong = tier_counts.get('Strong', 0)
    n_review = tier_counts.get('Review', 0)
    n_watch = tier_counts.get('Watch', 0)
    n_clear = tier_counts.get('Clear', 0)

    md = []
    md.append("# SmartLink Git Quiz — Post-Event Forensic Telemetry & Integrity Report\n")
    md.append(f"**Date:** {timestamp} | **Cohort Size:** {total_students} Candidates | **Cost:** ₹0 Infrastructure\n")

    md.append("> [!IMPORTANT]")
    md.append("> **Foundational Integrity Principle:** **Prevention is the primary defense; detection is strictly a backstop.**")
    md.append("> Deterministic option shuffling, randomized question variants, and server-authoritative 20-second clocks eliminate 95% of casual opportunism.")
    md.append("> This statistical pipeline audits post-event telemetry patterns and **NEVER proves cheating**.")
    md.append("> Plausible benign explanations exist for every metric, and zero automated penalties exist anywhere in the platform.\n")

    md.append("## 1. Cohort Tiers Distribution (Aggregates Only)")
    md.append("| Tier Level | Definition | Student Count | % of Cohort | Action Required |")
    md.append("|---|---|---|---|---|")
    md.append(f"| **Strong** | High statistical convergence across families ($p < 0.01$) | {n_strong} | {n_strong/total_students*100:.1f}% | Priority double-blind review dossier |")
    md.append(f"| **Review** | Single family anomaly ($p < 0.05$) or Top 10 candidate | {n_review} | {n_review/total_students*100:.1f}% | Verification before certificate release |")
    md.append(f"| **Watch** | Borderline variance or mild telemetry blips | {n_watch} | {n_watch/total_students*100:.1f}% | Standard automated verification |")
    md.append(f"| **Clear** | Normal psychometric and timing alignment | {n_clear} | {n_clear/total_students*100:.1f}% | Verified immediately |")
    md.append("")

    md.append("## 2. Detection Capabilities & Realistic Boundaries")
    md.append(get_detection_capabilities_table())
    md.append("")

    if fairness_results:
        md.append("## 3. Algorithmic Fairness Audit")
        md.append("Subgroup independence tests ensuring flag rates are decoupled from client hardware and campus infrastructure:")
        md.append("| Dimension | Subgroup | Flag Rate | Disparity $p$-value | Assessment |")
        md.append("|---|---|---|---|---|")
        for dim, res in fairness_results.items():
            for grp, rate in res['flag_rates'].items():
                disp = "Flagged Disparity" if res['disparity_detected'] else "Balanced (Fair) ✅"
                md.append(f"| {dim} | `{grp}` | {rate*100:.1f}% | {res['p_value']} | {disp} |")
        md.append("")

    md.append("## 4. Human-in-the-Loop Adjudication Protocol")
    md.append("1. **Pre-Specified Thresholds:** Derived from 1,000 honest-class simulations to strictly control the family-wise false-alarm rate at 1% for Strong and 10% for Review.")
    md.append("2. **Two-Pass IRT Calibration:** Rasch difficulties are calibrated exclusively on confirmed clean response sets. No student's own flag influences their baseline.")
    md.append("3. **Non-Directional Pair Matches:** Sibling matches record shared error frequency; directionality (who copied whom) is mathematically indeterminate and never assumed.")
    md.append("4. **Dual-Organizer Signoff:** Final certificate and podium publication requires cryptographic confirmation from two separate administrator sessions.\n")

    report_text = '\n'.join(md)
    with open(output_path, 'w') as f:
        f.write(report_text)

    return report_text
