# layer5-cheat/pipeline/fallback.py
"""
Emergency Manual Fallback Pipeline (Spreadsheet-based).

If automated statistical libraries fail on event day:
Generates a plain, zero-dependency CSV review spreadsheet that organizers
can inspect directly in Excel, Google Sheets, or LibreOffice Calc.
"""

from pathlib import Path
import csv
import sys

BASE_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BASE_DIR))
import config


def generate_manual_fallback_sheet(
    responses_csv: Path,
    output_csv: Path = None,
) -> Path:
    output_csv = output_csv or (config.DATA_DIR / 'manual_fallback_review.csv')

    # Read responses with standard csv module (zero external dependencies)
    student_scores = {}
    student_fast = {}
    student_wrongs = {}

    with open(responses_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            sid = row.get('student_anon') or row.get('anon_student_id') or '0'
            val = str(row.get('is_correct', '0')).strip().lower()
            is_correct = 1 if val in ('1', 'true', 't') else 0
            rt_str = row.get('response_ms_rounded') or row.get('rt_ms') or '8000'
            rt = float(rt_str)

            student_scores[sid] = student_scores.get(sid, 0) + is_correct
            if rt < 2000 and is_correct == 1:
                student_fast[sid] = student_fast.get(sid, 0) + 1

    # Write summary review table
    with open(output_csv, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'student_id',
            'raw_score',
            'fast_correct_count',
            'manual_flag_tier',
            'review_recommendation'
        ])

        for sid in sorted(student_scores.keys(), key=lambda x: student_scores[x], reverse=True):
            score = student_scores[sid]
            fast_c = student_fast.get(sid, 0)

            tier = 'Clear'
            rec = 'Issue certificate'
            if fast_c >= 3:
                tier = 'Strong'
                rec = 'Manual review: rapid correct answers on multiple items'
            elif score >= 13 or fast_c >= 2:
                tier = 'Review'
                rec = 'Manual verification: top-tier score or fast responses'

            writer.writerow([sid, score, fast_c, tier, rec])

    print(f"✅ Emergency spreadsheet saved to {output_csv}")
    return output_csv


if __name__ == '__main__':
    default_resp = BASE_DIR.parent / 'layer5-analysis' / 'data' / 'anonymized' / 'answers.csv'
    generate_manual_fallback_sheet(default_resp)
