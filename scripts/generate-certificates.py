#!/usr/bin/env python3
"""
SmartLink Git Quiz — Certificate Generator
Generates verifiable PDF certificates:
- Top 3 winners receive official Winner Certificates (1st, 2nd, 3rd Place).
- All other participants receive Participation Certificates with their Name and Register Number.
Usage: python3 scripts/generate-certificates.py --url http://localhost:3000 --password admin123
"""

import os
import sys
import json
import uuid
import datetime
import urllib.request
import argparse

def generate_pdf_report(student, output_path):
    college_id = student.get('college_id', 'UNKNOWN')
    name = student.get('name', 'Participant')
    rank = student.get('rank', 4)
    score = student.get('total_score', 0)
    clean_id = str(college_id).replace('/', '_')
    cert_id = f"SLGQ-{datetime.datetime.now().year}-{clean_id}"
    date_str = datetime.datetime.now().strftime("%B %d, %Y")

    is_winner = rank <= 3
    if is_winner:
        cert_title = "WINNER CERTIFICATE"
        if rank == 1:
            badge = "1st Place Winner - Champion"
            primary_r, primary_g, primary_b = "1.0", "0.84", "0.0"  # Gold
        elif rank == 2:
            badge = "2nd Place Winner - First Runner-Up"
            primary_r, primary_g, primary_b = "0.82", "0.85", "0.9"  # Silver
        else:
            badge = "3rd Place Winner - Second Runner-Up"
            primary_r, primary_g, primary_b = "0.85", "0.55", "0.2"  # Bronze
        citation = "Awarded for exceptional Git technical mastery as a Top 3 Tournament Winner."
        rank_line = f"Official Winner Rank: #{rank} (Winner)   |   Total Score: {score} pts"
    else:
        cert_title = "CERTIFICATE OF PARTICIPATION"
        badge = "Certificate of Participation"
        primary_r, primary_g, primary_b = "0.2", "0.65", "0.85"  # Cyan
        citation = "Awarded for active and successful participation in the SmartLink Git Tournament."
        rank_line = f"Participant Rank: #{rank}   |   Total Score: {score} pts"

    stream_content = f"""q
0.05 0.07 0.09 rg
0 0 612 792 re
f
{primary_r} {primary_g} {primary_b} RG
12 w
24 24 564 744 re
S
0.2 0.24 0.28 RG
2 w
32 32 548 728 re
S
BT
/F1 26 Tf
{primary_r} {primary_g} {primary_b} rg
1 0 0 1 130 660 Tm
({cert_title}) Tj
/F2 14 Tf
0.8 0.85 0.9 rg
1 0 0 1 170 625 Tm
({badge}) Tj
/F2 12 Tf
0.9 0.9 0.9 rg
1 0 0 1 210 550 Tm
(This is officially awarded to:) Tj
/F1 26 Tf
1.0 1.0 1.0 rg
1 0 0 1 150 490 Tm
({name}) Tj
/F1 13 Tf
{primary_r} {primary_g} {primary_b} rg
1 0 0 1 200 450 Tm
(Register No: {college_id}) Tj
/F2 12 Tf
0.85 0.88 0.9 rg
1 0 0 1 90 380 Tm
({citation}) Tj
/F1 15 Tf
{primary_r} {primary_g} {primary_b} rg
1 0 0 1 160 320 Tm
({rank_line}) Tj
/F2 10 Tf
0.5 0.55 0.6 rg
1 0 0 1 100 200 Tm
(Date: {date_str}                Certificate ID: {cert_id}) Tj
/F2 9 Tf
0.4 0.45 0.5 rg
1 0 0 1 150 140 Tm
(Verified & Digitally Anchored by SmartLink Real-Time Engine) Tj
ET
Q"""

    stream_bytes = stream_content.encode("latin1")
    stream_length = len(stream_bytes)

    pdf_content = f"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length {stream_length} >>
stream
{stream_content}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000001200 00000 n 
0000001275 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
1345
%%EOF
"""
    with open(output_path, "wb") as f:
        f.write(pdf_content.encode("latin1"))

def main():
    parser = argparse.ArgumentParser(description="SmartLink Certificate Generator")
    parser.add_argument("--url", default="http://localhost:3000", help="Base URL of app")
    parser.add_argument("--password", default="Dhina4213@", help="Admin password")
    args = parser.parse_args()

    engine_script = os.path.join(os.path.dirname(__file__), "certificate-engine.js")
    import subprocess
    cmd = ["node", engine_script, "--all"]
    print(f"🎓 Running certificate engine ({' '.join(cmd)})...")
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("✅ All certificates successfully generated with mathematical centering.")
    else:
        print("⚠️ Certificate generation failed.")

if __name__ == "__main__":
    main()
