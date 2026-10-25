# layer5-cheat/report/power_table.py
"""
Generates the empirical power table and detection capabilities summary.
"""

import pandas as pd
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def get_detection_capabilities_table() -> str:
    """Markdown table of detection capabilities."""
    lines = [
        "| Situation | Detectable? | Why / Limitation |",
        "|---|---|---|",
        "| **Heavy copying from a weaker student** | **Yes, best case** | Shared wrong answers on rare options are virtually impossible by chance. |",
        "| **Copying from a strong student** | **Mostly no** | Few shared wrong answers exist; person-fit may flag if weak student gets very hard items right. |",
        "| **External help (search, AI assistant)** | **Partly** | Slower response times, window blur events, high accuracy beyond estimated ability. |",
        "| **Answer key leaked in advance** | **Partly** | Rapid-fire correct answers on items hard for that student profile. |",
        "| **Perfect 15/15 score** | **Person-fit cannot flag** | Perfect answers contain no Guttman error inversions; only timing and telemetry can audit. |",
        "| **One answer relayed by voice** | **No** | Insufficient statistical signal in a 15-question instrument. |",
    ]
    return '\n'.join(lines)


def format_power_table(power_df: pd.DataFrame) -> str:
    """Format power simulation results as a clean markdown table."""
    lines = [
        "| Scenario | Parameters | Detection Rate (%) | Simulations |",
        "|---|---|---|---|",
    ]
    for _, row in power_df.iterrows():
        pct = f"{row['detection_rate'] * 100:.1f}%"
        lines.append(f"| {row['scenario']} | {row['params']} | {pct} | {row['n_sim']} |")
    return '\n'.join(lines)
