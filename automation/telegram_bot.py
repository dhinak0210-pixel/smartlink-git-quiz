# automation/telegram_bot.py
"""
Simple Telegram Bot API wrapper.
No polling, no webhooks — just send messages and documents.
"""

import requests
import config

BASE_URL = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}" if config.TELEGRAM_BOT_TOKEN else ""

def send_message(text: str, chat_id: str = None, parse_mode: str = 'HTML') -> bool:
    """Send a message to a chat/channel. Returns True on success."""
    if not config.TELEGRAM_BOT_TOKEN:
        print(f"[Telegram Mock] (No Token Configured)\n{text}\n")
        return True

    target_chat_id = chat_id or config.TELEGRAM_CHAT_ID
    if not target_chat_id:
        print(f"[Telegram Mock] (No Chat ID Configured)\n{text}\n")
        return True

    try:
        resp = requests.post(f"{BASE_URL}/sendMessage", json={
            'chat_id': target_chat_id,
            'text': text,
            'parse_mode': parse_mode,
            'disable_web_page_preview': True
        }, timeout=10)
        result = resp.json()
        if not result.get('ok'):
            print(f"Telegram error: {result.get('description', 'unknown')}")
        return result.get('ok', False)
    except Exception as e:
        print(f"Telegram request failed: {e}")
        return False

def send_document(file_path: str, caption: str = '', chat_id: str = None) -> bool:
    """Send a file to a chat/channel."""
    if not config.TELEGRAM_BOT_TOKEN:
        print(f"[Telegram Mock Document] file: {file_path}, caption: {caption}")
        return True

    target_chat_id = chat_id or config.TELEGRAM_CHAT_ID
    if not target_chat_id:
        print(f"[Telegram Mock Document] file: {file_path}, caption: {caption}")
        return True

    try:
        with open(file_path, 'rb') as f:
            resp = requests.post(f"{BASE_URL}/sendDocument", data={
                'chat_id': target_chat_id,
                'caption': caption,
                'parse_mode': 'HTML'
            }, files={'document': f}, timeout=30)
        return resp.json().get('ok', False)
    except Exception as e:
        print(f"Telegram document send failed: {e}")
        return False

def send_alert(message: str):
    """Send an urgent alert message."""
    text = f"🚨 <b>ALERT</b>\n\n{message}"
    return send_message(text)

# Quick test
if __name__ == '__main__':
    ok = send_message("🤖 SmartLink Bot is connected!")
    print(f"Test message {'sent' if ok else 'FAILED'}")
