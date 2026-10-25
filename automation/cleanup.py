# automation/cleanup.py
"""
Deletes raw event logs, device data, and IP info after the retention period.
Keeps aggregated results and anonymous statistics.

Usage:
    python cleanup.py              # Dry run
    python cleanup.py --commit     # Actually delete
"""

import argparse
from datetime import datetime, timezone

from supabase import create_client
import config

CLEANUP_TASKS = [
    {
        'description': 'Raw event logs (tab switches, device info, IP data)',
        'table': 'events',
        'action': 'delete_all',
    },
    {
        'description': 'Behavioral flags (raw monitoring data)',
        'table': 'flags',
        'action': 'delete_all',
    },
    {
        'description': 'Individual answer timing data (keep scores, remove response_ms)',
        'table': 'answers',
        'action': 'nullify_columns',
        'columns': ['response_ms'],
    },
    {
        'description': 'Student join codes (no longer needed)',
        'table': 'students',
        'action': 'nullify_columns',
        'columns': ['join_code'],
    },
    {
        'description': 'Certificate files from storage',
        'table': None,
        'action': 'delete_storage_bucket',
        'bucket': 'certificates',
    },
]

KEEP_NOTES = [
    'students table (id, college_id, name, is_active) — names kept for records',
    'answers table (student_id, question_id, is_correct, points) — aggregate scores',
    'questions and options tables — for portfolio / future reference',
    'leaderboard view data',
    'reviews table — audit trail',
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', action='store_true')
    parser.add_argument('--force-confirm', action='store_true', help='Skip interactive prompt for automated scripts')
    args = parser.parse_args()

    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Data Cleanup")
    print(f"Mode: {'COMMIT — DATA WILL BE DELETED' if args.commit else 'DRY RUN'}")
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print(f"{'=' * 60}\n")

    print("Data to KEEP:")
    for note in KEEP_NOTES:
        print(f"  ✅ {note}")

    print(f"\nData to DELETE/ANONYMIZE:")
    for task in CLEANUP_TASKS:
        print(f"  🗑️  {task['description']}")

    if not args.commit:
        print(f"\n🔒 DRY RUN — nothing deleted. Use --commit to proceed.")
        return

    # Confirm unless forced
    if not args.force_confirm:
        confirm = input(f"\n⚠️  Type 'DELETE' to confirm permanent data deletion: ").strip()
        if confirm != 'DELETE':
            print("Aborted.")
            return

    results = []
    try:
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        return

    for task in CLEANUP_TASKS:
        desc = task['description']
        try:
            if task['action'] == 'delete_all':
                try:
                    count = supabase.table(task['table']).select('id', count='exact').execute()
                    row_count = count.count or 0
                    supabase.table(task['table']).delete().gte('created_at', '1970-01-01').execute()
                    results.append(f"  ✅ {desc}: {row_count} rows deleted")
                except Exception as inner_e:
                    results.append(f"  ℹ️  {desc}: {inner_e}")
                print(results[-1])

            elif task['action'] == 'nullify_columns':
                try:
                    update_data = {col: None for col in task['columns']}
                    supabase.table(task['table']).update(update_data).gte('id', '00000000-0000-0000-0000-000000000000').execute()
                    results.append(f"  ✅ {desc}: columns nullified")
                except Exception as inner_e:
                    results.append(f"  ℹ️  {desc}: {inner_e}")
                print(results[-1])

            elif task['action'] == 'delete_storage_bucket':
                bucket = task['bucket']
                try:
                    files = supabase.storage.from_(bucket).list()
                    for folder in files:
                        folder_files = supabase.storage.from_(bucket).list(folder['name'])
                        paths = [f"{folder['name']}/{f['name']}" for f in folder_files]
                        if paths:
                            supabase.storage.from_(bucket).remove(paths)

                    results.append(f"  ✅ {desc}: storage files removed")
                except Exception as e:
                    results.append(f"  ℹ️  {desc}: {e}")
                print(results[-1])

        except Exception as e:
            results.append(f"  ❌ {desc}: {e}")
            print(results[-1])

    print(f"\n{'=' * 60}")
    print("Cleanup complete.")
    print(f"{'=' * 60}")

    # Notify via Telegram
    try:
        from telegram_bot import send_message
        msg = "🧹 <b>Data cleanup complete</b>\n\n" + "\n".join(results)
        send_message(msg)
    except Exception:
        pass


if __name__ == '__main__':
    main()
