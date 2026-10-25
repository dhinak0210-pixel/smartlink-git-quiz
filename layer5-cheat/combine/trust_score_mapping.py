# layer5-cheat/combine/trust_score_mapping.py
"""
Map cheat detection tiers into Layer 2 trust scores and adjudication statuses.

Integration with Layer 2:
- Trust score < 40: Held for human adjudication (Strong tier)
- Trust score 40-69: Review required (Review tier)
- Trust score 70-100: Normal cleared (Watch / Clear tiers)
"""

import pandas as pd
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def map_tiers_to_trust_scores(tier_df: pd.DataFrame) -> pd.DataFrame:
    """
    Produce a table ready for database synchronization with Layer 2.
    """
    df = tier_df.copy()

    def get_score(row):
        t = row['tier']
        if t == 'Strong':
            return config.TRUST_SCORE_STRONG
        elif t == 'Review':
            return config.TRUST_SCORE_REVIEW
        elif t == 'Watch':
            return 72
        else:
            return config.TRUST_SCORE_CLEAR

    def get_status(row):
        t = row['tier']
        if t == 'Strong':
            return 'held'
        elif t == 'Review':
            return 'pending_review'
        else:
            return 'cleared'

    df['trust_score'] = df.apply(get_score, axis=1)
    df['adjudication_status'] = df.apply(get_status, axis=1)

    return df[['student_anon', 'tier', 'trust_score', 'adjudication_status', 'evidence_summary']]
