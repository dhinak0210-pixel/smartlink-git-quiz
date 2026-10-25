# automation/certificate_uploader.py
"""
Uploads generated certificates to Supabase Storage and records
the file_token → student mapping in the `certificates` table.

Usage:
    python certificate_uploader.py              # Dry run
    python certificate_uploader.py --commit     # Upload
"""

import argparse
import json
from pathlib import Path

from supabase import create_client
import config

STORAGE_BUCKET = 'certificates'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', action='store_true')
    args = parser.parse_args()

    cert_dir = config.OUTPUT_DIR / 'certificates'
    manifest_path = cert_dir / '_manifest.json'

    if not manifest_path.exists():
        print("❌ No manifest found. Run certificate_generator.py first.")
        return

    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    print(f"{'=' * 60}")
    print(f"Certificate Uploader — {'COMMIT' if args.commit else 'DRY RUN'}")
    print(f"Certificates to upload: {len(manifest)}")
    print(f"{'=' * 60}\n")

    try:
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    except Exception as e:
        print(f"Failed to connect to Supabase: {e}")
        return

    # Ensure bucket exists
    if args.commit:
        try:
            supabase.storage.create_bucket(STORAGE_BUCKET, {
                'public': False,  # Not publicly accessible — download via API only
                'file_size_limit': 10 * 1024 * 1024,
                'allowed_mime_types': ['image/png']
            })
            print(f"  Created bucket: {STORAGE_BUCKET}")
        except Exception:
            print(f"  Bucket {STORAGE_BUCKET} ready")

    # Fetch student ID mapping
    try:
        students = supabase.table('students').select('id, college_id').execute()
        student_id_map = {s['college_id']: s['id'] for s in (students.data or [])}
    except Exception:
        student_id_map = {}

    # Check what's already uploaded
    try:
        existing = supabase.table('certificates').select('college_id').execute()
        already_uploaded = {r['college_id'] for r in (existing.data or [])}
    except Exception:
        already_uploaded = set()

    uploaded = 0
    skipped = 0
    errors = []

    for entry in manifest:
        college_id = entry['college_id']
        file_path = Path(entry['file_path'])
        filename = entry['filename']
        file_token = entry['file_token']
        cert_id = entry['cert_id']
        tier = entry['tier']

        if college_id in already_uploaded:
            print(f"  ⏩ {college_id} — already uploaded")
            skipped += 1
            continue

        if not file_path.exists():
            errors.append((college_id, 'File not found'))
            continue

        student_id = student_id_map.get(college_id, "00000000-0000-0000-0000-000000000000")
        storage_path = f"{file_token}/{filename}"

        if not args.commit:
            print(f"  Would upload: {college_id} → {storage_path}")
            continue

        try:
            # Upload to storage
            with open(file_path, 'rb') as f:
                supabase.storage.from_(STORAGE_BUCKET).upload(
                    storage_path,
                    f.read(),
                    {'content-type': 'image/png'}
                )

            # Record in certificates table
            supabase.table('certificates').insert({
                'student_id': student_id,
                'college_id': college_id,
                'tier': tier,
                'cert_id': cert_id,
                'file_token': file_token,
                'storage_path': storage_path,
            }).execute()

            uploaded += 1
            print(f"  ✅ {college_id} — {tier}")

        except Exception as e:
            errors.append((college_id, str(e)))
            print(f"  ❌ {college_id}: {e}")

    print(f"\n{'=' * 60}")
    print(f"Uploaded: {uploaded}  Skipped: {skipped}  Errors: {len(errors)}")
    if errors:
        for cid, err in errors:
            print(f"  {cid}: {err}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()
