# layer5-cheat/combine/tier_rules.py
"""
Combine detector outputs into tiers: Strong, Review, Watch, Clear.

Families:
1. Answers vs ability (person-fit)
2. Timing (fast-correct, slow-correct, misfit)
3. Pair similarity (wrong-answer matches, group membership)
4. Behavior (tab events, logins, decoy choices)

Rules:
- Strong: any single detector > 1% family-wise threshold, OR 2+ families > 10%
- Review: one family > 10%, or in the review budget
- Watch: weaker signals
- Clear: no signals

NO AUTOMATIC PENALTIES. Tiers produce a review list only.
"""

import json
from pathlib import Path
import pandas as pd
import numpy as np

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def load_thresholds(path: Path = None) -> dict:
    path = path or (config.DATA_DIR / 'thresholds.json')
    if path.exists():
        with open(path) as f:
            return json.load(f).get('thresholds', {})
    
    # Return defaults
    return {
        'pf_min_p_strong': 0.010,
        'pf_min_p_review': 0.050,
        'pf_unexpected_strong': 18.5,
        'pf_unexpected_review': 12.0,
        'rt_fast_hard_strong': 3.0,
        'rt_fast_hard_review': 2.0,
        'rt_misfit_z_strong': 3.2,
        'rt_misfit_z_review': 2.1,
        'pair_weighted_strong': 14.5,
        'pair_weighted_review': 9.0,
        'pair_incorrect_strong': 4.0,
        'pair_incorrect_review': 3.0,
    }


def assign_tiers(
    person_fit_df: pd.DataFrame,
    timing_df: pd.DataFrame,
    pair_df: pd.DataFrame,
    behavior_df: pd.DataFrame,
    leaderboard_df: pd.DataFrame,
    thresholds: dict,
) -> pd.DataFrame:
    """
    Assign tiers to all students.

    Returns DataFrame with:
    student_anon, tier, rank_in_tier, families_fired, evidence_summary, trust_score
    """
    all_students = set()
    if len(person_fit_df) > 0:
        all_students.update(person_fit_df['student_anon'])
    if len(timing_df) > 0:
        all_students.update(timing_df['student_anon'])
    if len(leaderboard_df) > 0:
        all_students.update(leaderboard_df['student_anon'])
    if len(behavior_df) > 0:
        all_students.update(behavior_df['student_anon'])

    results = []

    # Map pairs for quick lookup per student
    student_pair_max = {}
    if len(pair_df) > 0:
        for _, row in pair_df.iterrows():
            sa, sb = row['student_a'], row['student_b']
            score = row['weighted_match_score']
            student_pair_max[sa] = max(student_pair_max.get(sa, 0.0), score)
            student_pair_max[sb] = max(student_pair_max.get(sb, 0.0), score)

    top_n_students = set()
    if len(leaderboard_df) > 0:
        top_n_students = set(leaderboard_df.head(config.ALWAYS_REVIEW_TOP_N)['student_anon'])

    for sid in all_students:
        families_fired = []
        evidence = []
        strong_families = set()
        review_families = set()

        # --- Family 1: Person-Fit ---
        pf_row = person_fit_df[person_fit_df['student_anon'] == sid] if len(person_fit_df) > 0 else pd.DataFrame()
        if len(pf_row) > 0:
            min_p = pf_row['min_p'].iloc[0]
            unexp = pf_row['unexpected_hit'].iloc[0]
            pf_strong_thresh = thresholds.get('pf_min_p_strong', 0.01)
            pf_review_thresh = thresholds.get('pf_min_p_review', 0.05)

            if min_p <= pf_strong_thresh:
                strong_families.add('person_fit')
                families_fired.append('person_fit_strong')
                evidence.append(f"Person-fit extreme: p={min_p:.4f} (unexpected score={unexp:.1f})")
            elif min_p <= pf_review_thresh:
                review_families.add('person_fit')
                families_fired.append('person_fit_review')
                evidence.append(f"Person-fit elevated: p={min_p:.4f} (unexpected score={unexp:.1f})")

        # --- Family 2: Response Time ---
        rt_row = timing_df[timing_df['student_anon'] == sid] if len(timing_df) > 0 else pd.DataFrame()
        if len(rt_row) > 0:
            fast_hard = rt_row['n_fast_correct_hard'].iloc[0]
            slow_tab = rt_row['n_slow_correct_tab'].iloc[0]
            misfit_z = rt_row['misfit_z'].iloc[0]

            fast_strong = thresholds.get('rt_fast_hard_strong', 3.0)
            fast_review = thresholds.get('rt_fast_hard_review', 2.0)
            z_strong = thresholds.get('rt_misfit_z_strong', 3.2)
            z_review = thresholds.get('rt_misfit_z_review', 2.1)

            if fast_hard >= fast_strong or misfit_z >= z_strong:
                strong_families.add('timing')
                families_fired.append('timing_strong')
                evidence.append(f"Timing outlier: {fast_hard} fast-correct on hard items, misfit z={misfit_z:.1f}")
            elif fast_hard >= fast_review or misfit_z >= z_review or slow_tab >= 1:
                review_families.add('timing')
                families_fired.append('timing_review')
                evidence.append(f"Timing anomalous: {fast_hard} fast-correct hard, {slow_tab} slow-tab items, misfit z={misfit_z:.1f}")

        # --- Family 3: Pair Similarity ---
        pair_max_score = student_pair_max.get(sid, 0.0)
        pair_strong_thresh = thresholds.get('pair_weighted_strong', 14.5)
        pair_review_thresh = thresholds.get('pair_weighted_review', 9.0)

        if pair_max_score >= pair_strong_thresh:
            strong_families.add('pair_similarity')
            families_fired.append('pair_similarity_strong')
            evidence.append(f"Pair similarity extreme: max weighted score = {pair_max_score:.2f}")
        elif pair_max_score >= pair_review_thresh:
            review_families.add('pair_similarity')
            families_fired.append('pair_similarity_review')
            evidence.append(f"Pair similarity elevated: max weighted score = {pair_max_score:.2f}")

        # --- Family 4: Behavioral Signals ---
        beh_row = behavior_df[behavior_df['student_anon'] == sid] if len(behavior_df) > 0 else pd.DataFrame()
        if len(beh_row) > 0:
            tab_switches = beh_row['tab_switch_count'].iloc[0]
            decoy_hits = beh_row['decoy_count'].iloc[0]
            rapid_guesses = beh_row['rapid_guess_count'].iloc[0]

            if decoy_hits >= 1 or tab_switches >= 5:
                strong_families.add('behavior')
                families_fired.append('behavior_strong')
                evidence.append(f"Behavior flags: {tab_switches} tab switches, {decoy_hits} decoy choices")
            elif tab_switches >= 2 or rapid_guesses >= 4:
                review_families.add('behavior')
                families_fired.append('behavior_review')
                evidence.append(f"Behavior notable: {tab_switches} tab switches, {rapid_guesses} rapid guesses")

        # --- Tier Determination ---
        total_unique_families = len(strong_families | review_families)

        if len(strong_families) >= config.TIER_STRONG_MIN_FAMILIES or total_unique_families >= config.TIER_REVIEW_MULTI_FAMILIES:
            tier = 'Strong'
            trust_score = config.TRUST_SCORE_STRONG
        elif len(review_families) >= 1 or sid in top_n_students:
            tier = 'Review'
            trust_score = config.TRUST_SCORE_REVIEW
            if sid in top_n_students and len(review_families) == 0:
                evidence.append("Mandatory podium audit: top 10 finisher")
        elif len(families_fired) > 0:
            tier = 'Watch'
            trust_score = 70
        else:
            tier = 'Clear'
            trust_score = config.TRUST_SCORE_CLEAR

        results.append({
            'student_anon': sid,
            'tier': tier,
            'families_fired': families_fired,
            'family_count': total_unique_families,
            'evidence_summary': '; '.join(evidence) if evidence else 'No anomalies observed',
            'trust_score': trust_score,
            'is_podium': sid in top_n_students,
        })

    df_tiers = pd.DataFrame(results)

    # Sort so Strong and Review appear at the top for reviewer budget prioritization
    tier_order = {'Strong': 0, 'Review': 1, 'Watch': 2, 'Clear': 3}
    df_tiers['tier_priority'] = df_tiers['tier'].map(tier_order)
    df_tiers = df_tiers.sort_values(['tier_priority', 'family_count', 'trust_score'], ascending=[True, False, True])
    df_tiers['rank_in_tier'] = range(1, len(df_tiers) + 1)
    df_tiers = df_tiers.drop(columns=['tier_priority'])

    return df_tiers
