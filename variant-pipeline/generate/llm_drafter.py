# variant-pipeline/generate/llm_drafter.py
"""
Gemini template drafting script.
"""

import os
import re
import yaml
import requests
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from generate.prompts import TEMPLATE_DRAFT_PROMPT


def draft_template_with_llm(topic: str, difficulty: str) -> dict | None:
    """Draft a candidate YAML template using Gemini."""
    if not config.GEMINI_API_KEY:
        print("  ⚠️ No GEMINI_API_KEY configured. Skipping LLM call.")
        return None

    prompt = TEMPLATE_DRAFT_PROMPT.format(topic=topic, difficulty=difficulty)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2000}
    }

    try:
        resp = requests.post(config.GEMINI_URL, params={"key": config.GEMINI_API_KEY}, json=payload, timeout=30)
        if resp.status_code != 200:
            print(f"  ❌ Gemini API returned {resp.status_code}")
            return None

        data = resp.json()
        raw_text = data['candidates'][0]['content']['parts'][0]['text']

        # Extract YAML from code blocks
        match = re.search(r'```(?:yaml)?\n(.*?)\n```', raw_text, re.DOTALL)
        yaml_content = match.group(1) if match else raw_text

        parsed = yaml.safe_load(yaml_content)
        return parsed
    except Exception as e:
        print(f"  ❌ Template drafting failed: {e}")
        return None
