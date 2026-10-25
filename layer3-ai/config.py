# layer3-ai/config.py
# Shared configuration for all Layer 3 scripts.

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from layer3-ai directory or fallback to parent
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv(Path(__file__).parent.parent / ".env.local")

# ─── Paths ───────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.resolve()
BLUEPRINT_DIR = BASE_DIR / "blueprint"
GENERATE_DIR = BASE_DIR / "generate"
VALIDATE_DIR = BASE_DIR / "validate"
QUALITY_DIR = BASE_DIR / "quality"
BANK_DIR = BASE_DIR / "bank"
EXPORT_DIR = BASE_DIR / "export"
AFTER_DIR = BASE_DIR / "after"

# Ensure output subdirectories exist
(GENERATE_DIR / "output").mkdir(parents=True, exist_ok=True)
(VALIDATE_DIR / "output" / "repo_snapshots").mkdir(parents=True, exist_ok=True)
(QUALITY_DIR / "output").mkdir(parents=True, exist_ok=True)
(BANK_DIR).mkdir(parents=True, exist_ok=True)
(AFTER_DIR / "output" / "student_reports").mkdir(parents=True, exist_ok=True)
(AFTER_DIR / "output" / "certificates").mkdir(parents=True, exist_ok=True)
(AFTER_DIR / "output" / "announcements").mkdir(parents=True, exist_ok=True)

# ─── API Keys ────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

# ─── AI Configuration ───────────────────────────────────
AI_PROVIDER = os.getenv("AI_PROVIDER", "gemini").lower()
GEMINI_MODEL = "gemini-2.0-flash"  # Free tier recommended
GROQ_MODEL = "llama-3.3-70b-versatile"  # Free tier backup

# Rate limits (conservative estimates for free tier)
GEMINI_RPM = 15          # Requests per minute
GEMINI_TPM = 1_000_000   # Tokens per minute
GROQ_RPM = 30
GROQ_TPM = 14_400

# Batch settings
BATCH_SIZE = 5            # Questions per API call
BATCH_DELAY_SECONDS = 5   # Delay between batches
MAX_RETRIES = 3           # Retries per failed call
RETRY_BACKOFF = 10        # Seconds between retries

# ─── Quiz Configuration ─────────────────────────────────
TOTAL_QUESTIONS = 15
RESERVE_QUESTIONS = 5
TOTAL_CANDIDATES = 40     # Generate ~40 to end with 20 (15+5)
QUESTIONS_PER_DIFFICULTY = {
    "easy": 5,
    "medium": 5,
    "hard": 5,
}

# ─── Quality Thresholds ─────────────────────────────────
MAX_QUESTION_WORDS = 40
MAX_OPTION_WORDS = 20
DUPLICATE_SIMILARITY_THRESHOLD = 0.85  # Cosine similarity
MIN_CORRECT_POSITION_SPREAD = 0.15     # Each position ≥ 15% of the time

# ─── Validation ─────────────────────────────────────────
GIT_REPO_TIMEOUT = 10     # Seconds per command execution
BLIND_CHECK_MODEL = "gemini-2.0-flash"

# ─── Post-Event ─────────────────────────────────────────
REPORT_BATCH_SIZE = 5      # Students per AI call for feedback
REPORT_DELAY_SECONDS = 4   # Delay between report batches
CERTIFICATE_TEMPLATE = AFTER_DIR / "template.png"

EVENT_NAME = os.getenv("EVENT_NAME", "SmartLink Git Quiz 2026")
EVENT_DATE = os.getenv("EVENT_DATE", "2026-10-22")
ORGANIZER_NAME = os.getenv("ORGANIZER_NAME", "SmartLink Technical Team")
