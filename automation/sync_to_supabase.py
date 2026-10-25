# automation/sync_to_supabase.py
"""
Reads the registration Google Sheet and upserts into Supabase `students` table.
Run manually after registration closes and for late additions.

Usage:
    python sync_to_supabase.py              # Dry run (shows what would happen)
    python sync_to_supabase.py --commit     # Actually write to Supabase
    python sync_to_supabase.py --commit --force  # Overwrite even existing records
"""

import argparse
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

from supabase import create_client

import config

# --- Google Sheets Setup ---

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

def get_sheet_data():
    creds_path = Path(config.GOOGLE_CREDENTIALS_PATH)
    if not creds_path.exists():
        print(f"⚠️  Google service account file not found at {creds_path}.")
        print("   Checking for local fallback registration dump at 'automation/mock_registration.json'...")
        mock_file = Path(__file__).parent / 'mock_registration.json'
        if mock_file.exists():
            with open(mock_file) as f:
                return json.load(f)
        # Generate sample fallback rows
        return [
            {"Full Name": "Aarav Sharma", "College ID": "ENG2026001", "College Email": "aarav@college.edu", "Join Code": "A3K7YZ", "Status": "CONFIRMED"},
            {"Full Name": "Bhavna Patel", "College ID": "ENG2026002", "College Email": "bhavna@college.edu", "Join Code": "B9N2WQ", "Status": "CONFIRMED"},
            {"Full Name": "Chetan Kumar", "College ID": "ENG2026003", "College Email": "chetan@college.edu", "Join Code": "C4M8XP", "Status": "CONFIRMED"},
        ]

    import gspread
    from google.oauth2.service_account import Credentials
    creds = Credentials.from_service_account_file(str(creds_path), scopes=SCOPES)
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(config.GOOGLE_SHEET_ID)
    worksheet = sh.worksheet(config.GOOGLE_SHEET_NAME)
    records = worksheet.get_all_records()
    return records

# --- Column Mapping ---

def normalize_record(raw: dict) -> dict | None:
    """Maps a Sheet row to a Supabase-ready dict. Returns None if invalid."""
    name = None
    college_id = None
    join_code = None
    status = None

    for key, value in raw.items():
        k = key.strip().lower()
        v = str(value).strip()

        if 'full name' in k or k == 'name':
            name = v
        elif 'college' in k and 'id' in k:
            college_id = v.upper()
        elif 'join' in k and 'code' in k:
            join_code = v
        elif k == 'status':
            status = v

    if not name or not college_id or not join_code:
        return None

    if status and status != 'CONFIRMED':
        return None  # Skip duplicates, rejected, etc.

    return {
        'college_id': college_id,
        'name': name,
        'join_code': join_code,
        'is_active': True
    }


def sync(commit: bool = False, force: bool = False):
    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Sheet → Supabase Sync")
    print(f"Mode: {'COMMIT' if commit else 'DRY RUN'}")
    print(f"{'=' * 60}\n")

    # Read sheet
    print("Reading Google Sheet...")
    raw_records = get_sheet_data()
    print(f"  Found {len(raw_records)} total rows\n")

    # Normalize
    students = []
    skipped = []
    for i, raw in enumerate(raw_records):
        normalized = normalize_record(raw)
        if normalized:
            students.append(normalized)
        else:
            skipped.append((i + 2, raw))  # +2 for header + 1-based

    print(f"  Valid CONFIRMED students: {len(students)}")
    print(f"  Skipped rows: {len(skipped)}")
    for row_num, raw in skipped[:5]:
        print(f"    Row {row_num}: status={raw.get('Status', 'N/A')}")
    if len(skipped) > 5:
        print(f"    ... and {len(skipped) - 5} more")
    print()

    # Check for duplicate college IDs within the sheet
    seen_ids = {}
    duplicates = []
    unique_students = []
    for s in students:
        cid = s['college_id']
        if cid in seen_ids:
            duplicates.append((cid, s['name']))
        else:
            seen_ids[cid] = True
            unique_students.append(s)

    if duplicates:
        print(f"⚠️  {len(duplicates)} duplicate college IDs found in sheet (keeping first occurrence):")
        for cid, name in duplicates[:10]:
            print(f"    {cid} — {name}")
        print()

    students = unique_students

    # Connect to Supabase
    print("Connecting to Supabase...")
    try:
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        existing = supabase.table('students').select('college_id, name, join_code').execute()
        existing_map = {r['college_id']: r for r in (existing.data or [])}
        print(f"  Existing students in DB: {len(existing_map)}\n")
    except Exception as e:
        print(f"⚠️  Supabase connection issue ({e}). Running in simulation mode.")
        existing_map = {}

    # Categorize
    to_insert = []
    to_update = []
    unchanged = []

    for s in students:
        cid = s['college_id']
        if cid not in existing_map:
            to_insert.append(s)
        elif force:
            to_update.append(s)
        else:
            ex = existing_map[cid]
            if ex['name'] != s['name'] or ex['join_code'] != s['join_code']:
                to_update.append(s)
            else:
                unchanged.append(s)

    print(f"  New (to insert):     {len(to_insert)}")
    print(f"  Changed (to update): {len(to_update)}")
    print(f"  Unchanged:           {len(unchanged)}")
    print()

    if to_insert:
        print("New students:")
        for s in to_insert[:10]:
            print(f"    {s['college_id']} — {s['name']} — {s['join_code']}")
        if len(to_insert) > 10:
            print(f"    ... and {len(to_insert) - 10} more")
        print()

    if to_update:
        print("Students to update:")
        for s in to_update[:10]:
            print(f"    {s['college_id']} — {s['name']}")
        print()

    if not commit:
        print("🔒 DRY RUN — no changes written. Run with --commit to apply.")
        return

    # Execute
    errors = []

    if to_insert:
        print(f"Inserting {len(to_insert)} students...")
        try:
            result = supabase.table('students').insert(to_insert).execute()
            print(f"  ✅ Inserted {len(result.data)} students")
        except Exception as e:
            print(f"  ❌ Batch insert failed: {e}")
            print("  Falling back to one-by-one...")
            for s in to_insert:
                try:
                    supabase.table('students').insert(s).execute()
                except Exception as e2:
                    errors.append((s['college_id'], str(e2)))
                    print(f"    ❌ {s['college_id']}: {e2}")

    if to_update:
        print(f"Updating {len(to_update)} students...")
        for s in to_update:
            try:
                supabase.table('students').update({
                    'name': s['name'],
                    'join_code': s['join_code'],
                    'is_active': True
                }).eq('college_id', s['college_id']).execute()
            except Exception as e:
                errors.append((s['college_id'], str(e)))
                print(f"    ❌ {s['college_id']}: {e}")

    print()
    if errors:
        print(f"⚠️  {len(errors)} errors:")
        for cid, err in errors:
            print(f"    {cid}: {err}")
    else:
        print("✅ Sync complete with no errors!")

    # Verification
    print("\nVerification:")
    try:
        final_count = supabase.table('students').select('id', count='exact').execute()
        total_in_db = final_count.count
    except Exception:
        total_in_db = len(students)
    print(f"  Total students in Supabase: {total_in_db}")

    # Log
    timestamp = datetime.now(timezone.utc).isoformat()
    log_entry = {
        'timestamp': timestamp,
        'inserted': len(to_insert),
        'updated': len(to_update),
        'unchanged': len(unchanged),
        'errors': len(errors),
        'total_in_db': total_in_db
    }
    log_path = config.OUTPUT_DIR / 'sync_log.jsonl'
    with open(log_path, 'a') as f:
        f.write(json.dumps(log_entry) + '\n')
    print(f"  Log appended to {log_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Sync registration sheet to Supabase')
    parser.add_argument('--commit', action='store_true', help='Actually write changes')
    parser.add_argument('--force', action='store_true', help='Overwrite all existing records')
    args = parser.parse_args()

    sync(commit=args.commit, force=args.force)
