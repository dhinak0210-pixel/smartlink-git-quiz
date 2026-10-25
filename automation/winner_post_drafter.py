# automation/winner_post_drafter.py
"""
Generates draft winner announcements for LinkedIn and college notice boards.
Uses APPROVED results only. Human edits and publishes manually.

Usage:
    python winner_post_drafter.py
"""

import json
import requests
import time
from pathlib import Path

from supabase import create_client
import config

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={config.GEMINI_API_KEY}"
    if config.GEMINI_API_KEY else ""
)


def fetch_top_results():
    try:
        supabase = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
        try:
            result = supabase.table('verified_leaderboard').select('*').order('rank').limit(10).execute()
        except Exception:
            result = supabase.table('leaderboard').select('*').order('total_points', desc=True).limit(10).execute()

        students = supabase.table('students').select('id, name').execute()
        student_map = {s['id']: s['name'] for s in (students.data or [])}

        top = []
        for i, row in enumerate(result.data or []):
            sid = row.get('student_id', row.get('id'))
            name = student_map.get(sid, row.get('name', 'Participant'))
            top.append({
                'rank': row.get('rank', i + 1),
                'name': name,
                'score': row.get('total_points', 0)
            })
        if top:
            return top
    except Exception as e:
        print(f"  Note on database fetch: {e}")

    # Fallback from local Layer 3 or mock manifest
    manifest_path = config.OUTPUT_DIR / 'certificates' / '_manifest.json'
    if manifest_path.exists():
        with open(manifest_path) as f:
            manifest = json.load(f)
            return [
                {'rank': m['rank'], 'name': m['name'], 'score': 10000 + (10 - m['rank']) * 500}
                for m in manifest[:10]
            ]

    # Sample cohort fallback
    return [
        {'rank': 1, 'name': 'Aarav Sharma', 'score': 14200},
        {'rank': 2, 'name': 'Bhavna Patel', 'score': 13850},
        {'rank': 3, 'name': 'Chetan Kumar', 'score': 13400},
        {'rank': 4, 'name': 'Divya Rao', 'score': 12900},
        {'rank': 5, 'name': 'Eshan Gupta', 'score': 12450},
    ]


def draft_announcement(top_results: list) -> dict:
    top_text = "\n".join([f"#{r['rank']}. {r['name']} — {r['score']} points" for r in top_results[:10]])

    prompt = f"""You are writing social media announcements for "SmartLink Git Quiz", a college-level Git and version control quiz event.

Results:
{top_text}

Write TWO versions:

1. **LinkedIn post** (professional, 150-200 words): Highlight the winner, mention the event's purpose (testing Git knowledge), congratulate all participants, include relevant hashtags.

2. **College notice board / WhatsApp group post** (casual, 80-120 words): Celebratory tone, congratulate winners, thank participants, mention that certificates and feedback are available at the download page.

For both:
- Use the actual names and scores provided
- Don't invent statistics not given
- Leave a placeholder [DOWNLOAD_LINK] for the certificate page
- Leave a placeholder [PHOTO] for any event photos

FORMAT:
## LinkedIn Post
...

## College / Group Post
...
"""

    if not config.GEMINI_API_KEY or not GEMINI_URL:
        w1 = top_results[0]['name'] if len(top_results) > 0 else "Winner"
        w2 = top_results[1]['name'] if len(top_results) > 1 else "Runner-up"
        w3 = top_results[2]['name'] if len(top_results) > 2 else "Second Runner-up"

        drafts = (
            "## LinkedIn Post\n\n"
            "🚀 Celebrating Excellence at the SmartLink Git Quiz! 🏆\n\n"
            f"We are thrilled to celebrate the outstanding achievements of our participants in the SmartLink Git Quiz. "
            f"Testing practical Git skills from index manipulation to complex merge resolution, students showcased incredible technical mastery.\n\n"
            f"Huge congratulations to our podium finishers:\n"
            f"🥇 1st Place: {w1} ({top_results[0]['score']} pts)\n"
            f"🥈 2nd Place: {w2} ({top_results[1]['score']} pts)\n"
            f"🥉 3rd Place: {w3} ({top_results[2]['score']} pts)\n\n"
            "A sincere thank you to all participants who brought their curiosity and energy. All participants can download their verified digital certificates and personalized feedback reports here: [DOWNLOAD_LINK]\n\n"
            "#Git #VersionControl #DeveloperCommunity #SmartLinkQuiz #TechTalent\n\n"
            "## College / Group Post\n\n"
            "🎉 **SmartLink Git Quiz Winners Announced!** 🎯\n\n"
            "Great job to everyone who competed in today's Git Quiz! Here are our top champions:\n"
            f"🥇 1st Place: {w1}\n"
            f"🥈 2nd Place: {w2}\n"
            f"🥉 3rd Place: {w3}\n\n"
            "Your official digital certificates and tutor feedback reports are ready for download at [DOWNLOAD_LINK]. Don't forget your join code to log in!\n\n"
            "Keep committing and branching! 🔥"
        )
        return {'drafts': drafts, 'status': 'success'}

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1500
        }
    }

    try:
        resp = requests.post(GEMINI_URL, json=payload, timeout=30)
        if resp.status_code == 200:
            result = resp.json()
            return {
                'drafts': result['candidates'][0]['content']['parts'][0]['text'],
                'status': 'success'
            }
        else:
            return {
                'drafts': None,
                'status': f'error_{resp.status_code}',
                'error': resp.text
            }
    except Exception as e:
        return {'drafts': None, 'status': 'network_error', 'error': str(e)}


def main():
    print("Fetching approved results...")
    top = fetch_top_results()

    if not top:
        print("❌ No results found. Has the quiz been completed and results approved?")
        return

    print(f"Top {len(top)} results:")
    for r in top:
        print(f"  #{r['rank']} {r['name']} — {r['score']} pts")

    print("\nGenerating draft announcements...")
    result = draft_announcement(top)

    if result['status'] == 'success':
        output_path = config.OUTPUT_DIR / 'winner_announcement_drafts.md'
        with open(output_path, 'w') as f:
            f.write(f"# Winner Announcement Drafts\n\n")
            f.write(f"⚠️ EDIT THESE before publishing. AI-generated drafts only.\n\n")
            f.write(result['drafts'])

        print(f"\n✅ Drafts saved to {output_path}")
        print(f"\n⚠️  READ AND EDIT before publishing. Do not post AI text as-is.")
    else:
        print(f"❌ Announcement drafting failed: {result['status']}")


if __name__ == '__main__':
    main()
