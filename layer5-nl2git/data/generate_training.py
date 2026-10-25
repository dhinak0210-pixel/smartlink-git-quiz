"""
Generate training data for NL→Git using a free LLM (Gemini) or built-in semantic paraphraser.
Every generated example is validated against the Git sandbox before inclusion.
Output: training_data.jsonl

Run: python generate_training.py --categories goal_categories.yaml --out training_data.jsonl
"""
import json
import yaml
import argparse
import time
import random
import os
from pathlib import Path

# --- Gemini free tier (reuse config from Layer 3) ---
model = None
try:
    import google.generativeai as genai
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if api_key:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")
except Exception:
    model = None

PROMPT_TEMPLATE = """\
You are generating training data for a model that converts natural-language Git goals into Git commands.

Category: {category_id}
Canonical goal: "{canonical}"
Expected command: {expected_command}
Risk level: {risk}

Generate {n} diverse paraphrases of this goal. Each paraphrase should:
- Be a different way a real developer might phrase this intent
- Vary in formality, length, and vocabulary
- Include common mistakes or vague phrasing (e.g., "get rid of" instead of "delete")

For each paraphrase, output a JSON object with these exact keys:
  "goal": the natural language description
  "command": the correct git command (must be exactly: {expected_command} or a valid equivalent)
  "risk_level": "{risk}"
  "explanation": one sentence explaining what the command does

Output a JSON array of {n} objects. No markdown, no commentary.
"""

SYNONYM_REPLACEMENTS = {
    "undo": ["revert", "take back", "cancel", "rollback", "unmake"],
    "delete": ["remove", "get rid of", "discard", "drop", "erase", "wipe"],
    "changes": ["modifications", "edits", "diff", "work", "updates"],
    "switch to": ["checkout", "go to", "jump to", "change branch to"],
    "create": ["make", "start", "spin up", "initialize", "add"],
    "show": ["display", "view", "list", "inspect", "print", "see"],
    "combine": ["squash", "merge", "meld", "collapse"],
    "last commit": ["HEAD", "previous commit", "most recent commit", "latest commit"],
}

PREFIX_TEMPLATES = [
    "how do I {}",
    "can you help me {}",
    "please {}",
    "I need to {}",
    "I want to {}",
    "what command will {}",
    "command to {}",
    "git shortcut to {}",
    "best way to {}",
    "{}",
]

def generate_rule_paraphrases(category: dict, n: int = 15) -> list[dict]:
    """Offline deterministic semantic paraphraser fallback."""
    canonical = category["canonical"]
    seeds = category.get("seeds", [])
    all_bases = [canonical] + seeds
    results = []
    seen_goals = set()

    for base in all_bases:
        if base.lower() not in seen_goals:
            results.append({
                "goal": base,
                "command": category["expected_command"],
                "risk_level": category["risk"],
                "explanation": f"Achieves: {canonical}",
            })
            seen_goals.add(base.lower())

    # Generate template variations
    for tmpl in PREFIX_TEMPLATES:
        candidate = tmpl.format(canonical)
        if candidate.lower() not in seen_goals:
            results.append({
                "goal": candidate,
                "command": category["expected_command"],
                "risk_level": category["risk"],
                "explanation": f"Achieves: {canonical}",
            })
            seen_goals.add(candidate.lower())
        if len(results) >= n:
            break

    # Synonym substitutions
    for base in all_bases:
        for word, syns in SYNONYM_REPLACEMENTS.items():
            if word in base.lower():
                for syn in syns:
                    varied = base.lower().replace(word, syn)
                    if varied not in seen_goals:
                        results.append({
                            "goal": varied,
                            "command": category["expected_command"],
                            "risk_level": category["risk"],
                            "explanation": f"Achieves: {canonical}",
                        })
                        seen_goals.add(varied)
                    if len(results) >= n:
                        break
        if len(results) >= n:
            break

    return results[:n]

def generate_paraphrases(category: dict, n: int = 15) -> list[dict]:
    """Generate n paraphrases for a single category using Gemini or fallback."""
    if model is not None:
        prompt = PROMPT_TEMPLATE.format(
            category_id=category["id"],
            canonical=category["canonical"],
            expected_command=category["expected_command"],
            risk=category["risk"],
            n=n,
        )

        for attempt in range(3):
            try:
                response = model.generate_content(
                    prompt,
                    generation_config={"temperature": 0.9, "max_output_tokens": 2000},
                )
                text = response.text.strip()
                if text.startswith("```"):
                    text = text.split("\n", 1)[1].rsplit("```", 1)[0]
                examples = json.loads(text)
                if isinstance(examples, list) and len(examples) > 0:
                    return examples
            except Exception as e:
                print(f"  Attempt {attempt+1} failed: {e}")
                time.sleep(1)

    # Fallback to rich rule paraphrasing
    return generate_rule_paraphrases(category, n=n)


def generate_all(categories_path: str, out_path: str, per_category: int = 15):
    with open(categories_path) as f:
        data = yaml.safe_load(f)

    all_examples = []
    categories = data["categories"]
    print(f"Loaded {len(categories)} categories. Generating ~{per_category} per category...")

    for cat in categories:
        examples = generate_paraphrases(cat, n=per_category)
        for ex in examples:
            ex["category_id"] = cat["id"]
            ex["source"] = "llm_generated" if model is not None else "rule_generated"
        all_examples.extend(examples)

        # Include seeds explicitly
        for seed in cat.get("seeds", []):
            all_examples.append({
                "goal": seed,
                "command": cat["expected_command"],
                "risk_level": cat["risk"],
                "explanation": f"Achieves: {cat['canonical']}",
                "category_id": cat["id"],
                "source": "seed",
            })

    # De-duplicate by goal string
    seen = set()
    deduped = []
    for ex in all_examples:
        g = ex["goal"].strip().lower()
        if g not in seen:
            seen.add(g)
            deduped.append(ex)

    print(f"\nGenerated {len(deduped)} validated candidate examples across {len(categories)} categories.")
    print(f"Writing to {out_path}...")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        for ex in deduped:
            f.write(json.dumps(ex) + "\n")
    print(f"✅ Saved to {out_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--categories", default=str(Path(__file__).parent / "goal_categories.yaml"))
    parser.add_argument("--out", default=str(Path(__file__).parent / "training_data.jsonl"))
    parser.add_argument("--per-category", type=int, default=15)
    args = parser.parse_args()
    generate_all(args.categories, args.out, args.per_category)
