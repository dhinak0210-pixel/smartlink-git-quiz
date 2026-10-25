# layer5-analysis/scripts/event_report.py
"""
Phase A: Generate the event summary report for the college.

Usage:
    python event_report.py
"""

import json
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


def main():
    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Event Report Generator")
    print(f"{'=' * 60}\n")

    # Load public aggregates
    agg_path = config.PUBLIC_DIR / 'aggregates.json'
    if not agg_path.exists():
        print("❌ Run anonymize.py first to generate aggregates.")
        return

    with open(agg_path) as f:
        agg = json.load(f)

    # Load question stats
    q_stats_path = config.PUBLIC_DIR / 'question_statistics.csv'
    q_stats = pd.read_csv(q_stats_path) if q_stats_path.exists() else None

    # Load anonymized data for additional metrics
    answers = pd.read_csv(config.ANON_DIR / 'answers.csv') if (config.ANON_DIR / 'answers.csv').exists() else None
    events = pd.read_csv(config.ANON_DIR / 'events.csv') if (config.ANON_DIR / 'events.csv').exists() else None
    flags = pd.read_csv(config.ANON_DIR / 'flags.csv') if (config.ANON_DIR / 'flags.csv').exists() else None
    reviews = pd.read_csv(config.ANON_DIR / 'reviews.csv') if (config.ANON_DIR / 'reviews.csv').exists() else None

    report = []
    report.append("# SmartLink Git Quiz — Event Report\n")
    report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d')}\n")

    # 1. Participation
    p = agg.get('participation', {})
    report.append("## 1. Participation\n")
    report.append(f"| Metric | Value |")
    report.append(f"|---|---|")
    report.append(f"| Registered | {p.get('registered', 'N/A')} |")
    report.append(f"| Answered at least 1 question | {p.get('answered_at_least_one', 'N/A')} |")
    report.append(f"| Completed all 15 questions | {p.get('completed_all_15', 'N/A')} |")
    if p.get('registered'):
        completion_rate = (p.get('completed_all_15', 0) / p['registered']) * 100
        report.append(f"| Completion rate | {completion_rate:.1f}% |")
    report.append("")

    # 2. Score Distribution
    s = agg.get('score_distribution', {})
    report.append("## 2. Score Distribution\n")
    report.append(f"| Metric | Value |")
    report.append(f"|---|---|")
    report.append(f"| Mean | {s.get('mean', 'N/A')} |")
    report.append(f"| Median | {s.get('median', 'N/A')} |")
    report.append(f"| Std Dev | {s.get('std', 'N/A')} |")
    report.append(f"| Min | {s.get('min', 'N/A')} |")
    report.append(f"| Max | {s.get('max', 'N/A')} (out of 15,000) |")
    report.append(f"| 25th percentile | {s.get('p25', 'N/A')} |")
    report.append(f"| 75th percentile | {s.get('p75', 'N/A')} |")
    report.append("")

    # 3. Topic Performance
    ta = agg.get('topic_accuracy', {})
    if ta:
        report.append("## 3. Performance by Topic\n")
        report.append("| Topic | Correct | Total | Accuracy |")
        report.append("|---|---|---|---|")
        for topic, data in sorted(ta.items(), key=lambda x: x[1]['fraction_correct']):
            report.append(
                f"| {topic} | {data['correct']} | {data['total']} "
                f"| {data['fraction_correct']:.1%} |"
            )
        report.append("")

    # 4. Timing
    if answers is not None and 'response_ms_rounded' in answers.columns:
        report.append("## 4. Response Timing\n")
        valid_times = answers[answers['response_ms_rounded'] > 0]['response_ms_rounded']
        report.append(f"| Metric | Value |")
        report.append(f"|---|---|")
        report.append(f"| Median response time | {valid_times.median():.0f} ms |")
        report.append(f"| 95th percentile | {valid_times.quantile(0.95):.0f} ms |")
        report.append(f"| Mean response time | {valid_times.mean():.0f} ms |")
        report.append("")

    # 5. Anti-Cheat Summary
    if flags is not None and len(flags) > 0:
        report.append("## 5. Anti-Cheat Summary\n")
        report.append(f"| Metric | Value |")
        report.append(f"|---|---|")
        report.append(f"| Total flags raised | {len(flags)} |")
        report.append(f"| Unique students flagged | {flags['anon_student_id'].nunique()} |")

        flag_counts = flags['flag_type'].value_counts()
        for ftype, count in flag_counts.items():
            report.append(f"| {ftype} | {count} |")
        report.append("")

    if reviews is not None and len(reviews) > 0:
        report.append("### Flag Review Outcomes\n")
        review_counts = reviews['decision'].value_counts()
        report.append(f"| Decision | Count |")
        report.append(f"|---|---|")
        for decision, count in review_counts.items():
            report.append(f"| {decision} | {count} |")
        report.append("")

    # 6. Hardest and Easiest Questions
    if q_stats is not None:
        report.append("## 6. Hardest and Easiest Questions\n")

        hardest = q_stats.nsmallest(3, 'p_value')
        report.append("### Hardest\n")
        for _, row in hardest.iterrows():
            text = str(row.get('text', ''))[:80]
            report.append(f"- **{row['p_value']:.0%} correct** — {text}... ({row.get('topic', '?')})")
        report.append("")

        easiest = q_stats.nlargest(3, 'p_value')
        report.append("### Easiest\n")
        for _, row in easiest.iterrows():
            text = str(row.get('text', ''))[:80]
            report.append(f"- **{row['p_value']:.0%} correct** — {text}... ({row.get('topic', '?')})")
        report.append("")

        flawed = q_stats[q_stats['is_flawed'] == True]
        if len(flawed) > 0:
            report.append(f"### ⚠️ Potentially Flawed Questions ({len(flawed)})\n")
            for _, row in flawed.head(5).iterrows():
                text = str(row.get('text', ''))[:60]
                report.append(f"- {text}... — {row['flaw_reason']}")
            report.append("")

    # 7. Infrastructure
    report.append("## 7. Infrastructure\n")
    report.append("| Component | Service | Cost |")
    report.append("|---|---|---|")
    report.append("| Frontend + API | Vercel Hobby | ₹0 |")
    report.append("| Database + Auth | Supabase Free | ₹0 |")
    report.append("| Question Generation | Gemini Free Tier | ₹0 |")
    report.append("| Hosting (ML models) | Hugging Face Spaces | ₹0 |")
    report.append("| **Total** | | **₹0** |")
    report.append("")

    # 8. Limitations
    report.append("## 8. Limitations\n")
    report.append("- Single college, single event, ~200 students")
    report.append("- Results may not generalize to other populations")
    report.append("- Anti-cheat flags are heuristic, not definitive")
    report.append("- Question difficulty labels were hand-assigned before the event")
    report.append("")

    report_text = '\n'.join(report)
    report_path = config.PUBLIC_DIR / 'event_report.md'
    with open(report_path, 'w') as f:
        f.write(report_text)

    print(f"✅ Report saved to {report_path}")

if __name__ == '__main__':
    main()
