# layer5-cheat/pipeline/event_day.py
"""
SmartLink Git Quiz — Event-Day Cheat Detection Pipeline.
Executes the full forensic statistical pipeline in < 30 minutes on an admin laptop.

One-command pipeline:
1. Load & clean data using pre-specified rules
2. Calibrate clean-pass Rasch difficulties & abilities via Fast JMLE
3. Fit lognormal response-time model
4. Run Detector A: Person-Fit (unexpected correct answers)
5. Run Detector B: Response Time signals (fast-correct hard, slow-correct tab)
6. Run Detector C: Wrong-Answer Pair Similarity & Collusion Graph
7. Combine into Tiers (Strong, Review, Watch, Clear)
8. Output Evidence Packs & Aggregate Executive Summary

Usage:
    python event_day.py --responses path/to/responses.csv
"""

import argparse
import time
import json
from pathlib import Path

import pandas as pd
import numpy as np

import sys
BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))

import config
from data.prepare_data import load_cleaning_rules, prepare_detector_data
from models.fast_rasch import fit_fast_rasch
from models.option_probabilities import estimate_option_probabilities
from detectors.person_fit import run_person_fit_detector
from detectors.response_time import compute_timing_signals
from detectors.pair_similarity import compute_pair_similarity
from detectors.collusion_graph import build_collusion_graph
from detectors.supporting_signals import compute_supporting_signals
from combine.tier_rules import load_thresholds, assign_tiers
from combine.trust_score_mapping import map_tiers_to_trust_scores
from report.evidence_pack import generate_student_evidence_pack
from report.fairness_audit import audit_fairness
from report.summary_report import generate_executive_cheat_report


def run_event_day_pipeline(
    responses_path: Path = None,
    events_path: Path = None,
    output_dir: Path = None,
) -> dict:
    start_time = time.time()
    output_dir = output_dir or config.OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("🔍 SMARTLINK GIT QUIZ — EVENT-DAY INTEGRITY & FORENSIC PIPELINE")
    print(f"   Target Execution: < {config.EVENT_DAY_TARGET_MINUTES} Minutes")
    print(f"   Seed: {config.RANDOM_SEED}")
    print("=" * 70)

    # 1. Load cleaning rules & input datasets
    rules = load_cleaning_rules()
    responses_path = responses_path or (config.DATA_DIR / 'response_table.csv')

    # If response_table.csv doesn't exist, fallback to layer5-analysis anonymized data
    if not responses_path.exists():
        fallback_path = BASE_DIR.parent / 'layer5-analysis' / 'data' / 'anonymized' / 'answers.csv'
        if fallback_path.exists():
            print(f"ℹ️  Using answers dataset from {fallback_path.name}")
            responses_path = fallback_path

    if not responses_path.exists():
        raise FileNotFoundError(f"No response table found at {responses_path}")

    # Events table
    events_df = None
    if events_path and events_path.exists():
        events_df = pd.read_csv(events_path)
    else:
        events_fallback = BASE_DIR.parent / 'layer5-analysis' / 'data' / 'anonymized' / 'events.csv'
        if events_fallback.exists():
            events_df = pd.read_csv(events_fallback)

    # 2. Fast Rasch Fit for Clean-Pass IRT Difficulties
    print("\n[1/6] 🧠 Fitting Event-Day Fast Rasch Model...")
    raw_df = pd.read_csv(responses_path)
    if 'anon_student_id' in raw_df.columns:
        raw_df['student_anon'] = raw_df['anon_student_id']
    if 'question_id' in raw_df.columns:
        raw_df['template_id'] = raw_df['question_id']

    rasch_result = fit_fast_rasch(raw_df)
    print(f"   • Converged: {rasch_result['converged']} in {rasch_result['duration_seconds']}s")

    irt_params = {
        'item_params': rasch_result['item_params'],
        'person_params': rasch_result['person_params'],
        'templates': [p['template_id'] for p in rasch_result['item_params']],
        'students': [p['student_anon'] for p in rasch_result['person_params']],
    }

    # 3. Clean Data according to Pre-Specified Rules
    print("\n[2/6] 🧹 Cleaning Telemetry & Response Records...")
    cleaned = prepare_detector_data(responses_path, irt_params, rules)
    irt_diffs = cleaned['irt_difficulties']
    irt_abils = cleaned['irt_abilities']

    # 4. Detector A: Person-Fit
    print("\n[3/6] 🎯 Running Detector A (Person-Fit: Unexpected Correct)...")
    t0 = time.time()
    pf_df = run_person_fit_detector(cleaned['person_fit'], irt_diffs)
    print(f"   • Person-fit evaluated for {len(pf_df)} students in {time.time() - t0:.2f}s")

    # 5. Detector B: Response Time
    print("\n[4/6] ⏱️  Running Detector B (Response-Time Models)...")
    t0 = time.time()
    timing_df = compute_timing_signals(cleaned['timing'], events_df, irt_diffs, irt_abils)
    print(f"   • Timing signals evaluated for {len(timing_df)} students in {time.time() - t0:.2f}s")

    # 6. Detector C: Wrong-Answer Pair Similarity & Collusion Graph
    print("\n[5/6] 👥 Running Detector C (Wrong-Answer Matching & Collusion Graphs)...")
    t0 = time.time()
    opt_probs = estimate_option_probabilities(cleaned['pairs'], irt_abils)
    pair_df = compute_pair_similarity(cleaned['pairs'], irt_abils, opt_probs)
    print(f"   • Evaluated {len(pair_df)} student pairs with matching wrong options in {time.time() - t0:.2f}s")

    thresholds = load_thresholds()
    review_thresh = thresholds.get('pair_weighted_review', 9.0)
    graph_res = build_collusion_graph(pair_df, review_thresh)
    if graph_res['groups']:
        print(f"   • Detected {len(graph_res['groups'])} candidate collusion communities (size >= 3)")

    # Supporting Signals (Behavior & Isolation Forest)
    behavior_df = compute_supporting_signals(cleaned['all_responses'], events_df)

    # Leaderboard (Scores)
    scores = raw_df.groupby('student_anon')['is_correct'].sum().reset_index()
    leaderboard_df = scores.sort_values('is_correct', ascending=False)

    # 7. Tier Combination & Trust Score Mapping
    print("\n[6/6] 🛡️  Synthesizing Review Tiers & Trust Scores...")
    tiers_df = assign_tiers(pf_df, timing_df, pair_df, behavior_df, leaderboard_df, thresholds)
    trust_mapping_df = map_tiers_to_trust_scores(tiers_df)

    # Save Results
    tiers_out = output_dir / 'assigned_tiers.csv'
    tiers_df.to_csv(tiers_out, index=False)

    trust_out = output_dir / 'trust_score_updates.csv'
    trust_mapping_df.to_csv(trust_out, index=False)

    # Generate Evidence Packs for Top Candidates in Review Budget
    evidence_dir = output_dir / 'evidence_packs'
    evidence_dir.mkdir(parents=True, exist_ok=True)

    priority_candidates = tiers_df.head(config.REVIEW_BUDGET)
    for _, row in priority_candidates.iterrows():
        sid = row['student_anon']
        pf_i = pf_df[pf_df['student_anon'] == sid].iloc[0].to_dict() if len(pf_df[pf_df['student_anon'] == sid]) > 0 else {}
        rt_i = timing_df[timing_df['student_anon'] == sid].iloc[0].to_dict() if len(timing_df[timing_df['student_anon'] == sid]) > 0 else {}
        pairs_i = pair_df[(pair_df['student_a'] == sid) | (pair_df['student_b'] == sid)].to_dict('records')

        pack = generate_student_evidence_pack(
            student_id=sid,
            tier_info=row.to_dict(),
            person_fit_info=pf_i,
            timing_info=rt_i,
            pair_matches=pairs_i,
        )
        pack_path = evidence_dir / f'student_{sid}_evidence.md'
        with open(pack_path, 'w') as f:
            f.write(pack)

    # Run Fairness Audit & Executive Summary Report
    fairness_res = audit_fairness(tiers_df)
    summary_text = generate_executive_cheat_report(tiers_df, fairness_res, output_dir / 'cheat_detection_summary.md')

    total_duration = time.time() - start_time
    print(f"\n{'=' * 70}")
    print(f"🏁 EVENT-DAY PIPELINE COMPLETE ({total_duration:.2f}s elapsed)")
    print(f"   • Strong Tier: {len(tiers_df[tiers_df['tier'] == 'Strong'])} students")
    print(f"   • Review Tier: {len(tiers_df[tiers_df['tier'] == 'Review'])} students")
    print(f"   • Clear Tier:  {len(tiers_df[tiers_df['tier'] == 'Clear'])} students")
    print(f"   • Evidence Packs Generated: {len(priority_candidates)}")
    print(f"   • Executive Report: {output_dir / 'cheat_detection_summary.md'}")
    print("=" * 70)

    return {
        'tiers_df': tiers_df,
        'trust_mapping_df': trust_mapping_df,
        'total_duration': total_duration,
        'summary_file': output_dir / 'cheat_detection_summary.md',
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--responses', type=str, default=None)
    parser.add_argument('--events', type=str, default=None)
    args = parser.parse_args()

    r_path = Path(args.responses) if args.responses else None
    e_path = Path(args.events) if args.events else None
    run_event_day_pipeline(r_path, e_path)
