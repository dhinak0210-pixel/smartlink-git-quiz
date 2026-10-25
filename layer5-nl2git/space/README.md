---
title: NL to Git Command
emoji: 🔧
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: mit
---

# NL → Git Command Translator

Describe a Git task in plain English and get the correct command with an automated risk assessment.

**Model:** Fine-tuned `t5-small` (60M parameters) on ~800 sandbox-validated examples.
**Fallback:** Gemini 2.0 Flash / deterministic rules when offline or running without GPU weights.

## Risk Levels
- ✅ **SAFE** — Read-only, no state change (e.g. `git status`, `git log`, `git diff`)
- ⚠️ **CAUTION** — Changes working tree or index, reversible with care (e.g. `git checkout -b`, `git stash`, `git reset --soft`)
- 🔶 **DANGEROUS** — Rewrites history or discards changes (e.g. `git reset --hard`, `git push --force`, `git rebase -i`)
- 🚨 **CRITICAL** — Permanent data loss possible with no easy recovery (e.g. `git clean -fd`, `git branch -D`)

## Methodology
1. Generated ~1,000 paraphrases across 50 Git goal categories using LLM prompting.
2. Validated every command against a Git sandbox (syntax parsing + virtual commit state execution).
3. Fine-tuned `t5-small` for 5 epochs on Colab T4 GPU (₹0 cost).
4. Evaluated on a 30-example hand-written test set kept strictly isolated from training data.
5. Pattern-based risk taxonomy overrides model predictions when model underestimates danger (safety-first guarantee).
