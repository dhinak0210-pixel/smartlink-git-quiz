# automation/certificate_generator.py
"""
Generates certificates for all students using Pillow.
Tiers: Winner, Runner-up, Second Runner-up, Top 10, Participant.

Usage:
    python certificate_generator.py                    # Generate all
    python certificate_generator.py --tier winner      # Only winner cert
    python certificate_generator.py --student ABC123   # Single student by college_id
    python certificate_generator.py --preview 5        # Generate first 5 only (for proofing)
"""

import argparse
import secrets
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from supabase import create_client

import config

# --- Configuration ---

CERT_WIDTH = 3508   # A4 landscape at 300 DPI
CERT_HEIGHT = 2480

TIERS = {
    'winner':           {'rank_range': (1, 1),   'template': 'certificate_winner.png',           'title': 'Winner',            'color': '#D97706'},
    'runner_up':        {'rank_range': (2, 2),   'template': 'certificate_runner_up.png',        'title': 'Runner-up',         'color': '#64748B'},
    'second_runner_up': {'rank_range': (3, 3),   'template': 'certificate_second_runner_up.png', 'title': 'Second Runner-up',  'color': '#B45309'},
    'top10':            {'rank_range': (4, 10),  'template': 'certificate_top10.png',            'title': 'Top 10 Finalist',   'color': '#2563EB'},
    'participant':      {'rank_range': (11, 999),'template': 'certificate_participant.png',      'title': 'Participant',       'color': '#059669'},
}

EVENT_NAME = "SmartLink Git Quiz"
EVENT_DATE = "July 15, 2025"

# System font candidates
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf"
]
FONT_DETAIL_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/ubuntu/Ubuntu-R.ttf"
]

TEXT_CONFIG = {
    'name':       {'y': 1050, 'font_size': 96,  'color': '#1a1a2e', 'font': 'bold'},
    'title':      {'y': 1200, 'font_size': 60,  'color': '#3b82f6', 'font': 'regular'},
    'event_name': {'y': 1340, 'font_size': 48,  'color': '#4a4a4a', 'font': 'regular'},
    'date':       {'y': 1420, 'font_size': 40,  'color': '#666666', 'font': 'regular'},
    'cert_id':    {'y': 2300, 'font_size': 28,  'color': '#999999', 'font': 'regular'},
}


def generate_cert_id() -> str:
    """Random 12-char certificate ID for verification."""
    return f"SLQ-{secrets.token_hex(6).upper()}"


def get_tier(rank: int) -> dict | None:
    for tier_key, tier_info in TIERS.items():
        low, high = tier_info['rank_range']
        if low <= rank <= high:
            return {**tier_info, 'key': tier_key}
    return None


def load_font(font_type: str, size: int):
    candidates = FONT_CANDIDATES if font_type == 'bold' else FONT_DETAIL_CANDIDATES
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def draw_centered_text(draw: ImageDraw, text: str, y: int, font, color: str):
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    x = (CERT_WIDTH - text_width) // 2
    draw.text((x, y), text, font=font, fill=color)


def ensure_template(tier_key: str, tier_info: dict) -> Path:
    """Ensures template PNG exists, creating a beautiful vector-styled graphic if not present."""
    template_path = config.TEMPLATE_DIR / tier_info['template']
    if template_path.exists():
        return template_path

    # Generate styled template
    img = Image.new('RGB', (CERT_WIDTH, CERT_HEIGHT), '#FFFFFF')
    draw = ImageDraw.Draw(img)

    accent = tier_info.get('color', '#3B82F6')

    # Double borders
    draw.rectangle([50, 50, CERT_WIDTH - 50, CERT_HEIGHT - 50], outline=accent, width=12)
    draw.rectangle([75, 75, CERT_WIDTH - 75, CERT_HEIGHT - 75], outline='#E2E8F0', width=3)

    # Top header bar
    draw.rectangle([100, 100, CERT_WIDTH - 100, 240], fill='#F8FAFC')
    header_font = load_font('bold', 48)
    draw_centered_text(draw, "SMARTLINK GIT & GITHUB INITIATIVE", 145, header_font, '#0F172A')

    # Certificate title watermark
    award_font = load_font('bold', 80)
    draw_centered_text(draw, "CERTIFICATE OF ACHIEVEMENT", 420, award_font, accent)

    pres_font = load_font('regular', 38)
    draw_centered_text(draw, "This certificate is proudly awarded to", 850, pres_font, '#64748B')

    # Footer seals & lines
    draw.line([300, 2100, 1100, 2100], fill='#94A3B8', width=3)
    draw.line([CERT_WIDTH - 1100, 2100, CERT_WIDTH - 300, 2100], fill='#94A3B8', width=3)

    sub_font = load_font('regular', 32)
    draw.text((580, 2130), "Competition Lead", font=sub_font, fill='#475569')
    draw.text((CERT_WIDTH - 850, 2130), "Academic Coordinator", font=sub_font, fill='#475569')

    img.save(template_path, 'PNG')
    return template_path


def generate_certificate(name: str, rank: int, college_id: str, output_dir: Path) -> dict | None:
    tier = get_tier(rank)
    if not tier:
        return None

    cert_id = generate_cert_id()
    file_token = secrets.token_urlsafe(16)
    filename = f"{file_token}.png"

    template_path = ensure_template(tier['key'], tier)
    img = Image.open(template_path).convert('RGB')
    if img.size != (CERT_WIDTH, CERT_HEIGHT):
        img = img.resize((CERT_WIDTH, CERT_HEIGHT), Image.LANCZOS)

    draw = ImageDraw.Draw(img)

    # Draw text fields
    for field, cfg in TEXT_CONFIG.items():
        font = load_font(cfg['font'], cfg['font_size'])

        if field == 'name':
            text = name
        elif field == 'title':
            text = f"• {tier['title'].upper()} •"
        elif field == 'event_name':
            text = EVENT_NAME
        elif field == 'date':
            text = f"Presented on {EVENT_DATE}"
        elif field == 'cert_id':
            text = f"Certificate Verification: {cert_id}"
        else:
            continue

        color = tier.get('color', cfg['color']) if field == 'title' else cfg['color']
        draw_centered_text(draw, text, cfg['y'], font, color)

    output_path = output_dir / filename
    img.save(output_path, 'PNG', quality=95)

    return {
        'college_id': college_id,
        'name': name,
        'rank': rank,
        'tier': tier['key'],
        'cert_id': cert_id,
        'file_token': file_token,
        'filename': filename,
        'file_path': str(output_path),
    }


def main():
    parser = argparse.ArgumentParser(description='Generate quiz certificates')
    parser.add_argument('--tier', type=str, help='Only generate for this tier')
    parser.add_argument('--student', type=str, help='Only generate for this college_id')
    parser.add_argument('--preview', type=int, help='Generate only first N certificates')
    args = parser.parse_args()

    output_dir = config.OUTPUT_DIR / 'certificates'
    output_dir.mkdir(exist_ok=True, parents=True)

    print(f"{'=' * 60}")
    print(f"SmartLink Git Quiz — Certificate Generator")
    print(f"Output: {output_dir}")
    print(f"{'=' * 60}\n")

    # Fetch verified leaderboard from Supabase
    print("Fetching leaderboard...")
    rankings = []
    try:
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        try:
            result = supabase.table('verified_leaderboard').select('*').order('rank').execute()
            rankings = result.data or []
        except Exception:
            result = supabase.table('leaderboard').select('*').order('total_points', desc=True).execute()
            rankings = result.data or []
    except Exception as e:
        print(f"  Note on database fetch: {e}")

    # Fallback to local Layer 3 exported leaderboard if database was empty or mock
    if not rankings:
        local_lb_path = Path(__file__).parent.parent / 'layer3-ai' / 'after' / 'output' / 'leaderboard_raw.json'
        if local_lb_path.exists():
            print(f"  Reading results from local post-event file: {local_lb_path}")
            with open(local_lb_path) as f:
                rankings = json.load(f)

    # Fallback sample rankings
    if not rankings:
        print("  Using sample student cohort for certificate generation")
        rankings = [
            {"rank": 1, "name": "Aarav Sharma", "college_id": "ENG2026001", "total_points": 14200},
            {"rank": 2, "name": "Bhavna Patel", "college_id": "ENG2026002", "total_points": 13850},
            {"rank": 3, "name": "Chetan Kumar", "college_id": "ENG2026003", "total_points": 13400},
            {"rank": 4, "name": "Divya Rao", "college_id": "ENG2026004", "total_points": 12900},
            {"rank": 11, "name": "Eshan Gupta", "college_id": "ENG2026005", "total_points": 10500},
        ]

    for i, row in enumerate(rankings):
        if 'rank' not in row:
            row['rank'] = i + 1

    # Apply filters
    if args.student:
        rankings = [r for r in rankings if r.get('college_id', '').upper() == args.student.upper()]

    if args.tier:
        tier_info = TIERS.get(args.tier)
        if tier_info:
            low, high = tier_info['rank_range']
            rankings = [r for r in rankings if low <= r['rank'] <= high]

    if args.preview:
        rankings = rankings[:args.preview]

    print(f"Generating {len(rankings)} certificates...\n")

    results = []
    errors = []

    # Check manifest for resume capability
    manifest_path = output_dir / '_manifest.json'
    existing_manifest = {}
    if manifest_path.exists():
        try:
            with open(manifest_path, 'r') as f:
                existing_entries = json.load(f)
                existing_manifest = {e['college_id']: e for e in existing_entries}
        except Exception:
            pass

    for row in rankings:
        college_id = row.get('college_id', 'UNKNOWN')
        name = row.get('name', 'Student')
        rank = row['rank']

        if college_id in existing_manifest:
            existing = existing_manifest[college_id]
            existing_file = output_dir / existing['filename']
            if existing_file.exists():
                print(f"  ⏩ {college_id} ({name}) — already done, skipping")
                results.append(existing)
                continue

        try:
            result = generate_certificate(name, rank, college_id, output_dir)
            if result:
                results.append(result)
                print(f"  ✅ #{rank} {college_id} — {name} ({result['tier']})")
            else:
                errors.append((college_id, 'No matching tier'))
        except Exception as e:
            errors.append((college_id, str(e)))
            print(f"  ❌ {college_id}: {e}")

    # Save manifest
    with open(manifest_path, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"Generated: {len(results)}  Errors: {len(errors)}")
    if errors:
        print(f"Failed: {', '.join([e[0] for e in errors])}")
    print(f"Manifest: {manifest_path}")
    print(f"{'=' * 60}")

    print(f"\n📋 PROOFREAD CERTIFICATES (Top 10):")
    for r in results:
        if r['rank'] <= 10:
            print(f"  #{r['rank']} {r['name']} — {r['tier']} — {r['filename']}")


if __name__ == '__main__':
    main()
