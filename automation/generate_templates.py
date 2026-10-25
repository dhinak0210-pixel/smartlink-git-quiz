# automation/generate_templates.py
"""
Generates high-resolution (3508x2480 A4 300DPI) certificate templates
for the SmartLink Git Quiz.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH = 3508
HEIGHT = 2480

TEMPLATES = [
    {
        'filename': 'certificate_winner.png',
        'badge': 'FIRST PLACE - WINNER',
        'sub': 'For Outstanding Mastery & Exemplary Speed in Version Control',
        'primary': (217, 119, 6),     # Gold/Amber
        'secondary': (251, 191, 36),  # Light Gold
        'bg_tint': (255, 251, 235),   # Warm white
    },
    {
        'filename': 'certificate_runner_up.png',
        'badge': 'FIRST RUNNER-UP',
        'sub': 'For Exceptional Performance & Precision in Git Architecture',
        'primary': (100, 116, 139),   # Slate/Silver
        'secondary': (148, 163, 184), # Light Silver
        'bg_tint': (248, 250, 252),   # Crisp Slate White
    },
    {
        'filename': 'certificate_second_runner_up.png',
        'badge': 'SECOND RUNNER-UP',
        'sub': 'For Distinguished Knowledge and Skill in Version Control',
        'primary': (180, 83, 9),      # Bronze
        'secondary': (217, 119, 6),   # Amber
        'bg_tint': (255, 247, 237),   # Warm Orange/Bronze white
    },
    {
        'filename': 'certificate_top10.png',
        'badge': 'TOP 10 FINALIST',
        'sub': 'For Superior Technical Skill and High Ranking in the Competition',
        'primary': (37, 99, 235),     # Blue
        'secondary': (96, 165, 250),  # Light Blue
        'bg_tint': (239, 246, 255),   # Ice Blue white
    },
    {
        'filename': 'certificate_participant.png',
        'badge': 'CERTIFICATE OF PARTICIPATION',
        'sub': 'For Active Participation & Commitment to Git & Software Engineering Excellence',
        'primary': (5, 150, 105),     # Emerald Green
        'secondary': (52, 211, 153),  # Mint
        'bg_tint': (240, 253, 244),   # Soft Green white
    },
]

def get_font(size: int, bold: bool = False):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_centered(draw: ImageDraw, text: str, y: int, font, fill):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    x = (WIDTH - w) // 2
    draw.text((x, y), text, font=font, fill=fill)

def generate_template(tpl: dict, output_dir: Path):
    img = Image.new('RGB', (WIDTH, HEIGHT), tpl['bg_tint'])
    draw = ImageDraw.Draw(img)

    primary = tpl['primary']
    secondary = tpl['secondary']

    # Outer ornate double borders
    draw.rectangle([40, 40, WIDTH - 40, HEIGHT - 40], outline=primary, width=8)
    draw.rectangle([60, 60, WIDTH - 60, HEIGHT - 60], outline=secondary, width=3)
    draw.rectangle([100, 100, WIDTH - 100, HEIGHT - 100], outline=primary, width=2)

    # Corner cornerpieces
    corner_size = 120
    for cx, cy in [(100, 100), (WIDTH - 100, 100), (100, HEIGHT - 100), (WIDTH - 100, HEIGHT - 100)]:
        draw.rectangle([cx - 15, cy - 15, cx + 15, cy + 15], fill=primary)

    # Header branding
    f_brand = get_font(42, bold=True)
    draw_centered(draw, "SMARTLINK ACADEMIC & TECHNICAL EXCELLENCE INITIATIVE", 260, f_brand, (100, 116, 139))

    f_title = get_font(110, bold=True)
    draw_centered(draw, "CERTIFICATE OF ACHIEVEMENT", 360, f_title, (30, 41, 59))

    # Badge pill in primary color
    f_badge = get_font(52, bold=True)
    badge_text = tpl['badge']
    bbox = draw.textbbox((0, 0), badge_text, font=f_badge)
    bw = bbox[2] - bbox[0] + 80
    bh = 80
    bx = (WIDTH - bw) // 2
    by = 540
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=20, fill=primary)
    draw_centered(draw, badge_text, by + 12, f_badge, (255, 255, 255))

    # "This is proudly presented to"
    f_intro = get_font(46, bold=False)
    draw_centered(draw, "This credential is formally conferred upon", 880, f_intro, (71, 85, 105))

    # Student name underline guideline
    draw.line([(500, 1160), (WIDTH - 500, 1160)], fill=(203, 213, 225), width=2)

    # Subtitle / citation text
    f_sub = get_font(40, bold=False)
    draw_centered(draw, tpl['sub'], 1600, f_sub, (71, 85, 105))

    # Event description
    f_desc = get_font(36, bold=False)
    draw_centered(draw, "Conducted at the SmartLink Collegiate Git & Version Control Championship", 1700, f_desc, (100, 116, 139))

    # Signature blocks & seal
    # Left signature
    draw.line([(450, 2100), (950, 2100)], fill=(100, 116, 139), width=2)
    f_sig = get_font(34, bold=True)
    draw.text((540, 2120), "CONVENER & LEAD", font=f_sig, fill=(30, 41, 59))
    f_sig_sub = get_font(28, bold=False)
    draw.text((520, 2165), "SmartLink Quiz Committee", font=f_sig_sub, fill=(100, 116, 139))

    # Center Official Seal
    seal_x = WIDTH // 2
    seal_y = 2050
    draw.circle((seal_x, seal_y), 90, outline=primary, width=6)
    draw.circle((seal_x, seal_y), 78, outline=secondary, width=2)
    f_seal = get_font(24, bold=True)
    draw_centered(draw, "SMARTLINK", seal_y - 28, f_seal, primary)
    draw_centered(draw, "VERIFIED", seal_y, f_seal, primary)
    draw_centered(draw, "2025", seal_y + 26, f_seal, primary)

    # Right signature
    draw.line([(WIDTH - 950, 2100), (WIDTH - 450, 2100)], fill=(100, 116, 139), width=2)
    draw.text((WIDTH - 870, 2120), "FACULTY ADVISOR", font=f_sig, fill=(30, 41, 59))
    draw.text((WIDTH - 885, 2165), "Department of Computing", font=f_sig_sub, fill=(100, 116, 139))

    out_file = output_dir / tpl['filename']
    img.save(out_file, 'PNG', quality=95)
    print(f"Generated template: {out_file.name}")

def main():
    out_dir = Path(__file__).parent / 'templates'
    out_dir.mkdir(exist_ok=True)
    for tpl in TEMPLATES:
        generate_template(tpl, out_dir)
    print("All templates generated successfully!")

if __name__ == '__main__':
    main()
