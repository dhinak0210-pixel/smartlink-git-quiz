# portfolio/generate_screenshots.py
"""
Generates crisp, professional screenshot mockups for the portfolio.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 750
OUT_DIR = Path(__file__).parent / 'screenshots'
OUT_DIR.mkdir(parents=True, exist_ok=True)

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

def draw_header(draw: ImageDraw, title: str, subtitle: str, badge: str):
    # Top bar
    draw.rectangle([0, 0, WIDTH, 50], fill=(15, 23, 42))
    # Window controls (macOS style dots)
    draw.circle((25, 25), 6, fill=(239, 68, 68))
    draw.circle((45, 25), 6, fill=(245, 158, 11))
    draw.circle((65, 25), 6, fill=(16, 185, 129))

    f_title = get_font(14, bold=True)
    draw.text((100, 18), "SmartLink Git Quiz Platform — " + title, font=f_title, fill=(148, 163, 184))

    # Banner
    draw.rectangle([0, 50, WIDTH, 130], fill=(30, 41, 59))
    f_h1 = get_font(26, bold=True)
    draw.text((40, 70), title, font=f_h1, fill=(255, 255, 255))
    f_sub = get_font(14, bold=False)
    draw.text((40, 102), subtitle, font=f_sub, fill=(148, 163, 184))

    # Badge
    f_badge = get_font(12, bold=True)
    draw.rounded_rectangle([WIDTH - 180, 78, WIDTH - 40, 108], radius=8, fill=(79, 70, 229))
    draw.text((WIDTH - 165, 86), badge, font=f_badge, fill=(255, 255, 255))

def create_quiz_screenshot():
    img = Image.new('RGB', (WIDTH, HEIGHT), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Synchronized Student Assessment", "Question 7 of 15 • 14 Seconds Remaining", "LIVE ROUND")

    # Timer & Progress Card
    draw.rounded_rectangle([40, 160, WIDTH - 40, 220], radius=12, fill=(30, 41, 59))
    f_timer = get_font(18, bold=True)
    draw.text((60, 178), "⏱️ Time Left: 14s", font=f_timer, fill=(251, 191, 36))
    draw.text((WIDTH - 240, 178), "Current Streak: 🔥 4", font=f_timer, fill=(52, 211, 153))

    # Progress bar
    draw.rounded_rectangle([250, 185, WIDTH - 260, 197], radius=6, fill=(51, 65, 85))
    draw.rounded_rectangle([250, 185, 250 + int((WIDTH - 510) * 0.46), 197], radius=6, fill=(99, 102, 241))

    # Question container
    draw.rounded_rectangle([40, 240, WIDTH - 40, HEIGHT - 40], radius=16, fill=(30, 41, 59))
    f_qtitle = get_font(22, bold=True)
    draw.text((70, 275), "Which command stages only the specified hunks of a file interactively?", font=f_qtitle, fill=(255, 255, 255))

    options = [
        ("A", "git add --patch file.py", True),
        ("B", "git commit -i file.py", False),
        ("C", "git stage --hunk file.py", False),
        ("D", "git diff --apply file.py", False)
    ]

    f_opt = get_font(16, bold=False)
    f_lbl = get_font(15, bold=True)
    y_start = 345
    for lbl, text, selected in options:
        border_col = (99, 102, 241) if selected else (51, 65, 85)
        bg_col = (49, 46, 129) if selected else (15, 23, 42)
        draw.rounded_rectangle([70, y_start, WIDTH - 70, y_start + 65], radius=12, fill=bg_col, outline=border_col, width=2)
        draw.rounded_rectangle([90, y_start + 14, 126, y_start + 50], radius=8, fill=(30, 41, 59))
        draw.text((102, y_start + 22), lbl, font=f_lbl, fill=(255, 255, 255))
        draw.text((150, y_start + 22), text, font=f_opt, fill=(241, 245, 249))
        y_start += 82

    img.save(OUT_DIR / 'quiz-interface.png')
    print("Generated quiz-interface.png")

def create_admin_screenshot():
    img = Image.new('RGB', (WIDTH, HEIGHT), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Organizer Control Deck", "Live Fleet Monitoring & Real-time Quiz Clock", "ADMIN CONSOLE")

    # Metric KPI cards
    metrics = [
        ("ACTIVE STUDENTS", "198 / 200", (16, 185, 129)),
        ("QUIZ STATUS", "RUNNING (Q8/15)", (99, 102, 241)),
        ("SYNC DELAY", "< 42 ms", (52, 211, 153)),
        ("ACTIVE FLAGS", "3 REVIEW", (245, 158, 11))
    ]
    card_w = (WIDTH - 140) // 4
    for i, (label, val, col) in enumerate(metrics):
        x = 40 + i * (card_w + 20)
        draw.rounded_rectangle([x, 160, x + card_w, 260], radius=12, fill=(30, 41, 59))
        f_lbl = get_font(12, bold=True)
        draw.text((x + 20, 180), label, font=f_lbl, fill=(148, 163, 184))
        f_val = get_font(20, bold=True)
        draw.text((x + 20, 210), val, font=f_val, fill=col)

    # Main chart/table area
    draw.rounded_rectangle([40, 280, WIDTH - 40, HEIGHT - 40], radius=16, fill=(30, 41, 59))
    f_title = get_font(18, bold=True)
    draw.text((70, 310), "Real-Time Student State Telemetry", font=f_title, fill=(255, 255, 255))

    # Table rows
    f_th = get_font(13, bold=True)
    f_td = get_font(13, bold=False)
    draw.text((70, 360), "STUDENT ID", font=f_th, fill=(148, 163, 184))
    draw.text((260, 360), "CURRENT Q", font=f_th, fill=(148, 163, 184))
    draw.text((430, 360), "SCORE", font=f_th, fill=(148, 163, 184))
    draw.text((600, 360), "AVG TIME", font=f_th, fill=(148, 163, 184))
    draw.text((780, 360), "INTEGRITY", font=f_th, fill=(148, 163, 184))
    draw.text((950, 360), "STATUS", font=f_th, fill=(148, 163, 184))
    draw.line([(70, 385), (WIDTH - 70, 385)], fill=(51, 65, 85), width=1)

    rows = [
        ("STD_0019", "Q8", "7,420 pts", "3,400 ms", "100 (Clear)", "Active"),
        ("STD_0042", "Q8", "7,180 pts", "4,100 ms", "100 (Clear)", "Active"),
        ("STD_0088", "Q8", "6,950 pts", "2,900 ms", "92 (Info)", "Active"),
        ("STD_0104", "Q7", "6,800 pts", "3,800 ms", "100 (Clear)", "Active"),
        ("STD_0155", "Q8", "6,410 pts", "1,900 ms", "74 (Review)", "Flagged")
    ]
    y = 405
    for sid, q, pts, t, integ, st in rows:
        draw.text((70, y), sid, font=f_td, fill=(241, 245, 249))
        draw.text((260, y), q, font=f_td, fill=(241, 245, 249))
        draw.text((430, y), pts, font=f_td, fill=(99, 102, 241))
        draw.text((600, y), t, font=f_td, fill=(241, 245, 249))
        col = (239, 68, 68) if "Review" in integ else (16, 185, 129)
        draw.text((780, y), integ, font=f_td, fill=col)
        draw.text((950, y), st, font=f_td, fill=(148, 163, 184))
        y += 45

    img.save(OUT_DIR / 'admin-dashboard.png')
    print("Generated admin-dashboard.png")

def create_leaderboard_screenshot():
    img = Image.new('RGB', (WIDTH, HEIGHT), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Projector Leaderboard View", "Verified Top Performers & Finalist Roster", "TOP 10")

    # Podium cards
    podiums = [
        ("🥈 2nd Place", "Student Bhavna", "13,850 pts", (148, 163, 184), 310, 160, 240, 260),
        ("🥇 1st Place", "Student Aarav", "14,200 pts", (251, 191, 36), 50, 130, 240, 290),
        ("🥉 3rd Place", "Student Chetan", "13,400 pts", (217, 119, 6), 570, 175, 240, 245)
    ]
    f_p_t = get_font(18, bold=True)
    f_p_n = get_font(16, bold=True)
    f_p_s = get_font(22, bold=True)

    for rank, name, pts, col, x, y, w, h in podiums:
        draw.rounded_rectangle([x, y, x + w, y + h], radius=16, fill=(30, 41, 59), outline=col, width=2)
        draw.text((x + 30, y + 25), rank, font=f_p_t, fill=col)
        draw.text((x + 30, y + 65), name, font=f_p_n, fill=(255, 255, 255))
        draw.text((x + 30, y + 105), pts, font=f_p_s, fill=col)

    # Top 10 list
    draw.rounded_rectangle([WIDTH - 320, 130, WIDTH - 40, HEIGHT - 40], radius=16, fill=(30, 41, 59))
    draw.text((WIDTH - 300, 155), "FINAL RANKINGS", font=get_font(16, bold=True), fill=(255, 255, 255))
    draw.line([(WIDTH - 300, 185), (WIDTH - 60, 185)], fill=(51, 65, 85), width=1)

    f_sub_r = get_font(13, bold=False)
    y_r = 205
    for rank, name, pts in [
        ("#4", "Student Divya", "12,900"),
        ("#5", "Student Eshan", "12,450"),
        ("#6", "Student Farhan", "12,100"),
        ("#7", "Student Geeta", "11,800"),
        ("#8", "Student Hitesh", "11,550"),
        ("#9", "Student Ishaan", "11,200"),
        ("#10", "Student Janani", "10,950")
    ]:
        draw.text((WIDTH - 300, y_r), f"{rank}  {name}", font=f_sub_r, fill=(241, 245, 249))
        draw.text((WIDTH - 125, y_r), pts, font=f_sub_r, fill=(99, 102, 241))
        y_r += 40

    img.save(OUT_DIR / 'leaderboard.png')
    print("Generated leaderboard.png")

def create_flag_review_screenshot():
    img = Image.new('RGB', (WIDTH, HEIGHT), (15, 23, 42))
    draw = ImageDraw.Draw(img)
    draw_header(draw, "Anti-Cheat Audit & Evidence Dossier", "Double-Blind Human Review & Decision Panel", "INTEGRITY GATE")

    # Left Panel: Student Case
    draw.rounded_rectangle([40, 150, 480, HEIGHT - 40], radius=16, fill=(30, 41, 59))
    draw.text((70, 180), "INCIDENT DOSSIER: STD_0155", font=get_font(18, bold=True), fill=(255, 255, 255))
    draw.text((70, 215), "Trust Score: 74/100 (Held for Manual Review)", font=get_font(14, bold=False), fill=(245, 158, 11))

    draw.text((70, 260), "Violations Detected:", font=get_font(14, bold=True), fill=(148, 163, 184))
    violations = [
        "• 3 Tab switches during Q4 and Q8",
        "• Response time 1,200 ms on hard Git Internals item",
        "• Outlier anomaly score flagged by Isolation Forest"
    ]
    y_v = 290
    for v in violations:
        draw.text((70, y_v), v, font=get_font(13, bold=False), fill=(241, 245, 249))
        y_v += 30

    # Right Panel: Action Decision
    draw.rounded_rectangle([510, 150, WIDTH - 40, HEIGHT - 40], radius=16, fill=(30, 41, 59))
    draw.text((540, 180), "HUMAN ADJUDICATION", font=get_font(18, bold=True), fill=(255, 255, 255))
    draw.text((540, 215), "Two distinct organizers must concur before disqualification.", font=get_font(13, bold=False), fill=(148, 163, 184))

    # Action Buttons
    buttons = [
        ("CLEAR CASE (False Positive)", (16, 185, 129)),
        ("APPLY 500 PT TIME PENALTY", (245, 158, 11)),
        ("DISQUALIFY PARTICIPANT", (239, 68, 68))
    ]
    y_b = 270
    for text, col in buttons:
        draw.rounded_rectangle([540, y_b, WIDTH - 70, y_b + 55], radius=10, fill=(15, 23, 42), outline=col, width=2)
        draw.text((580, y_b + 18), text, font=get_font(14, bold=True), fill=col)
        y_b += 75

    img.save(OUT_DIR / 'flag-review.png')
    print("Generated flag-review.png")

if __name__ == '__main__':
    create_quiz_screenshot()
    create_admin_screenshot()
    create_leaderboard_screenshot()
    create_flag_review_screenshot()
    print("All 4 portfolio screenshots generated successfully!")
