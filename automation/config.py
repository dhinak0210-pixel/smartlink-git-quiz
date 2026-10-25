# automation/config.py

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from the automation directory or fallback to project root
_env_path = Path(__file__).parent / '.env.local'
if _env_path.exists():
    load_dotenv(_env_path)
else:
    load_dotenv(Path(__file__).parent.parent / '.env.local')

def get_required(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise EnvironmentError(f"Missing required env var: {key}")
    return val

def get_optional(key: str, default: str = '') -> str:
    return os.getenv(key, default)

# Supabase
SUPABASE_URL = get_optional('SUPABASE_URL', 'https://placeholder-project.supabase.co')
SUPABASE_SERVICE_KEY = get_optional('SUPABASE_SERVICE_ROLE_KEY', os.getenv('SUPABASE_SERVICE_KEY', 'placeholder-key'))

# Google Sheets
GOOGLE_SHEET_ID = get_optional('GOOGLE_SHEET_ID', 'placeholder-sheet-id')
GOOGLE_SHEET_NAME = get_optional('GOOGLE_SHEET_NAME', 'Form Responses 1')
GOOGLE_CREDENTIALS_PATH = get_optional('GOOGLE_CREDENTIALS_PATH', './service-account.json')

# Telegram
TELEGRAM_BOT_TOKEN = get_optional('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = get_optional('TELEGRAM_CHAT_ID', '')

# Gemini (for post-event AI tasks — reuse from Layer 3)
GEMINI_API_KEY = get_optional('GEMINI_API_KEY', '')

# Paths
OUTPUT_DIR = Path(__file__).parent / 'output'
BACKUP_DIR = Path(__file__).parent / 'backups'
TEMPLATE_DIR = Path(__file__).parent / 'templates'

OUTPUT_DIR.mkdir(exist_ok=True, parents=True)
BACKUP_DIR.mkdir(exist_ok=True, parents=True)
TEMPLATE_DIR.mkdir(exist_ok=True, parents=True)
