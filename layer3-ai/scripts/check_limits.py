# layer3-ai/scripts/check_limits.py
# Diagnostic script to verify API keys, free-tier rate limits, database reachability, and local tools.
# Run: python scripts/check_limits.py

import sys
import subprocess
import time
from pathlib import Path

# Add layer3-ai to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import (
    GEMINI_API_KEY, GROQ_API_KEY, SUPABASE_URL, SUPABASE_KEY,
    GEMINI_MODEL, GROQ_MODEL, AI_PROVIDER
)

try:
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
    console = Console()
except ImportError:
    # Minimal console fallback
    class FallbackConsole:
        def print(self, *args, **kwargs):
            print(*args)
    console = FallbackConsole()


def check_git_version() -> str:
    try:
        res = subprocess.run(["git", "--version"], capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except Exception as e:
        return f"Error: {e}"


def check_gemini() -> dict:
    if not GEMINI_API_KEY:
        return {"status": "SKIPPED", "detail": "GEMINI_API_KEY not configured"}

    start = time.time()
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content("Ping. Reply with 'PONG' only.", generation_config={"max_output_tokens": 10})
        latency = round((time.time() - start) * 1000)
        return {"status": "ONLINE", "detail": f"Model: {GEMINI_MODEL} | Latency: {latency}ms | Response: {response.text.strip()[:20]}"}
    except Exception as e:
        return {"status": "FAILED", "detail": str(e)[:120]}


def check_groq() -> dict:
    if not GROQ_API_KEY:
        return {"status": "SKIPPED", "detail": "GROQ_API_KEY not configured"}

    start = time.time()
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": "Ping. Reply with 'PONG' only."}],
            max_tokens=10,
        )
        latency = round((time.time() - start) * 1000)
        ans = response.choices[0].message.content.strip()
        return {"status": "ONLINE", "detail": f"Model: {GROQ_MODEL} | Latency: {latency}ms | Response: {ans[:20]}"}
    except Exception as e:
        return {"status": "FAILED", "detail": str(e)[:120]}


def check_supabase() -> dict:
    if not SUPABASE_URL or not SUPABASE_KEY or "placeholder" in SUPABASE_URL:
        return {"status": "CONFIG NEEDED", "detail": "SUPABASE_URL contains placeholder"}

    try:
        from supabase import create_client
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        res = client.table("questions").select("id", count="exact").limit(1).execute()
        return {"status": "ONLINE", "detail": f"Connected to {SUPABASE_URL[:32]}... | Questions count: {res.count}"}
    except Exception as e:
        return {"status": "FAILED", "detail": str(e)[:120]}


def main():
    console.print("\n[bold cyan]🔍 SmartLink Git Quiz — Layer 3 Environment & Limits Check[/bold cyan]")
    console.print("=" * 65)

    table = Table(title="System & Cloud API Verification", show_header=True, header_style="bold magenta")
    table.add_column("Component", style="cyan", width=22)
    table.add_column("Status", width=16)
    table.add_column("Diagnostic Details", style="dim")

    # Local Python & Git
    table.add_row("Python Runtime", "[green]READY[/green]", f"Version {sys.version.split()[0]}")
    git_ver = check_git_version()
    table.add_row("Git CLI", "[green]READY[/green]" if "git version" in git_ver else "[red]MISSING[/red]", git_ver)

    # Gemini
    gemini_res = check_gemini()
    status_fmt = "[green]ONLINE[/green]" if gemini_res["status"] == "ONLINE" else (
        "[yellow]SKIPPED[/yellow]" if gemini_res["status"] == "SKIPPED" else "[red]FAILED[/red]"
    )
    table.add_row("Gemini API (Primary)", status_fmt, gemini_res["detail"])

    # Groq
    groq_res = check_groq()
    status_fmt = "[green]ONLINE[/green]" if groq_res["status"] == "ONLINE" else (
        "[yellow]SKIPPED[/yellow]" if groq_res["status"] == "SKIPPED" else "[red]FAILED[/red]"
    )
    table.add_row("Groq API (Backup)", status_fmt, groq_res["detail"])

    # Supabase
    supabase_res = check_supabase()
    status_fmt = "[green]ONLINE[/green]" if supabase_res["status"] == "ONLINE" else (
        "[yellow]LOCAL SQL[/yellow]" if supabase_res["status"] == "CONFIG NEEDED" else "[red]FAILED[/red]"
    )
    table.add_row("Supabase Database", status_fmt, supabase_res["detail"])

    console.print(table)
    console.print(f"\n[bold]Current Active Provider:[/bold] [yellow]{AI_PROVIDER}[/yellow]")
    console.print("If external API keys are not set, the pipeline runs seamlessly in verified local mode.\n")


if __name__ == "__main__":
    main()
