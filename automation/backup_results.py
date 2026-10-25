# automation/backup_results.py
"""
Exports all quiz tables to CSV immediately after the quiz ends.
Run this BEFORE any review or corrections — this is the untouched original.

Usage:
    python backup_results.py
"""

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from supabase import create_client
import config

TABLES = [
    'students',
    'questions',
    'options',
    'student_questions',
    'quiz_state',
    'answers',
    'events',
    'flags',
    'reviews',
    'student_status',
    'sudden_death',
    'winner_verification',
]

# Views to also export
VIEWS = [
    'leaderboard',
    'question_analytics',
    'student_results',
    'flagged_students',
    'verified_leaderboard',
]

def export_table(supabase, name: str, backup_dir: Path) -> int:
    """Export a single table/view to CSV. Returns row count."""
    try:
        # Fetch all rows (paginate if needed)
        all_rows = []
        page_size = 1000
        offset = 0

        while True:
            result = supabase.table(name).select('*').range(offset, offset + page_size - 1).execute()
            rows = result.data or []
            all_rows.extend(rows)
            if len(rows) < page_size:
                break
            offset += page_size

        if not all_rows:
            print(f"  {name}: (empty)")
            # Create empty CSV with note
            csv_path = backup_dir / f"{name}.csv"
            with open(csv_path, 'w', newline='', encoding='utf-8') as f:
                f.write("# empty table\n")
            return 0

        # Write CSV
        csv_path = backup_dir / f"{name}.csv"
        headers = list(all_rows[0].keys())

        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(all_rows)

        print(f"  {name}: {len(all_rows)} rows → {csv_path.name}")
        return len(all_rows)

    except Exception as e:
        print(f"  {name}: ❌ Note: {e}")
        return 0


def main():
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    backup_dir = config.BACKUP_DIR / f"backup_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)

    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Results Backup")
    print(f"Timestamp: {timestamp}")
    print(f"Output: {backup_dir}")
    print(f"{'=' * 60}\n")

    try:
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        return

    summary = {}

    print("Exporting tables:")
    for table in TABLES:
        count = export_table(supabase, table, backup_dir)
        summary[table] = count

    print("\nExporting views:")
    for view in VIEWS:
        count = export_table(supabase, view, backup_dir)
        summary[view] = count

    # Write summary
    summary_path = backup_dir / '_summary.json'
    with open(summary_path, 'w') as f:
        json.dump({
            'timestamp': timestamp,
            'tables': summary,
            'total_files': len([v for v in summary.values() if v >= 0]),
            'errors': [k for k, v in summary.items() if v == -1]
        }, f, indent=2)

    print(f"\n{'=' * 60}")
    errors = [k for k, v in summary.items() if v == -1]
    if errors:
        print(f"⚠️  Completed with {len(errors)} errors: {', '.join(errors)}")
    else:
        print(f"✅ Backup complete! {len([v for v in summary.values() if v > 0])} non-empty files saved.")
    print(f"Location: {backup_dir}")
    print(f"{'=' * 60}")

    # Alert via Telegram
    try:
        from telegram_bot import send_message
        msg = f"💾 <b>Quiz backup complete</b>\n"
        msg += f"Timestamp: {timestamp}\n"
        for name, count in summary.items():
            if count > 0:
                msg += f"  {name}: {count} rows\n"
        if errors:
            msg += f"\n⚠️ Errors: {', '.join(errors)}"
        send_message(msg)
    except Exception as e:
        print(f"Telegram notify skipped: {e}")


if __name__ == '__main__':
    main()
