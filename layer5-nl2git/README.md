# Natural Language → Git Command Translator (DL)
*Part of SmartLink Git Quiz Post-Event Portfolio & Practice Suite*

## 1. System Overview

This subsystem translates developer intent expressed in unconstrained natural language into precise, executable Git commands. Every generated command is accompanied by an authoritative **Risk Assessment** (`SAFE`, `CAUTION`, `DANGEROUS`, or `CRITICAL`) and a human-readable safety warning.

```
[Developer Goal]
      │
      ▼
┌──────────────────────────────┐
│  t5-small (60M parameters)   │ ◄── Fine-tuned on Google Colab (T4 GPU, ₹0)
│  or Gemini / Fallback Engine │
└──────────────┬───────────────┘
               │
               ▼ Output: command [SEP] risk [SEP] explanation
┌──────────────────────────────┐
│   Post-Processing & Safety   │
│   Pattern Override Engine    │ ◄── Deterministic regex safety-net
└──────────────┬───────────────┘
               │
               ▼
[Command + Risk Badge + Plain-Language Warning + Reversibility Flag]
```

---

## 2. Constraints & Zero-Cost Architecture

| Dimension | Specification | Engineering Rationale |
|---|---|---|
| **Total Cloud Cost** | **₹0.00** | Fine-tuned on Google Colab T4 (15 GB VRAM) free tier; hosted on Hugging Face Spaces free (2 vCPU, 16 GB RAM). |
| **Model Footprint** | `t5-small` (~60M parameters, ~240 MB) | Fits comfortably in CPU inference memory with 150–300ms latency on free tier. |
| **Data Integrity** | Strict Train/Test Separation | Training set generated via LLM + validated in Git sandbox. A 30-item human-written test set was kept strictly air-gapped from all training phases. |
| **Safety Invariant** | Dual-Layer Risk Net | A deep learning model can hallucinate benign flags. The pattern engine checks every command against hardcoded dangerous patterns and overrides upward. |

---

## 3. Risk Taxonomy

Git commands carry vastly asymmetric risk profiles. A typo in `git log` is harmless, while a misplaced parameter in `git reset --hard` or `git clean -fd` permanently destroys uncommitted work.

### Tiers & Warning Protocols
1. **`SAFE` (Green)**: Read-only operations. Repository tree, index, and commit history remain completely untouched.
   - *Examples*: `git status`, `git log --oneline`, `git diff`, `git branch`, `git tag -l`.
   - *Warning*: *"This is a read-only command. It will not change your repository."*
2. **`CAUTION` (Yellow)**: Changes the working tree, staging index, or creates branches.
   - *Examples*: `git checkout -b <name>`, `git stash`, `git reset --soft HEAD~1`, `git add -A`.
   - *Warning*: *"This changes your working tree or staging area. Uncommitted work may be affected. Run `git status` first."*
3. **`DANGEROUS` (Orange)**: Rewrites history or discards modifications.
   - *Examples*: `git reset --hard HEAD~1`, `git push --force`, `git commit --amend`, `git rebase -i`.
   - *Warning*: *"⚠️ This rewrites history or discards changes. Recovery is possible via `git reflog` but not guaranteed. Do NOT use on shared branches without team agreement."*
4. **`CRITICAL` (Red)**: Destructive actions with no reflog recovery.
   - *Examples*: `git clean -fd`, `git branch -D <name>`, `rm -rf .git`.
   - *Warning*: *"🚨 This can PERMANENTLY delete data with no easy recovery. Make a full backup (`git bundle` or clone) before proceeding."*

### Pattern Override Safety Mechanism
`assess_risk(command, model_predicted_risk)` executes a deterministic regex scan over the generated command. The final assigned risk is:
$$\text{Level}_{\text{final}} = \max\left(\text{Level}_{\text{model}}, \text{Level}_{\text{pattern}}\right)$$
This mathematical guarantee ensures that model false negatives (e.g. predicting `SAFE` for `git reset --hard`) are strictly impossible in production.

---

## 4. Dataset Generation & Sandbox Validation Loop

```
  50 Canonical Git Categories (goal_categories.yaml)
                     │
                     ▼
  LLM Paraphrase Synthesis (generate_training.py)
  [Diverse vocabulary, conversational slips, slang]
                     │
                     ▼ 708 Raw Examples
  Sandbox Validation Pipeline (validate_training.py)
  ├─ 1. Syntax & Anti-Injection Filter (blocks ;, &&, |, `)
  ├─ 2. Risk Level Normalization (Pattern check)
  └─ 3. Virtual Git Sandbox Execution (VirtualGitState / Git runner)
                     │
                     ▼
  708 Validated Examples (validated.jsonl)
```

---

## 5. Model Fine-Tuning & Evaluation

### Training Setup (`training/finetune_t5.py`)
- **Base Architecture**: `t5-small` (Seq2Seq Transformer)
- **Input Format**: `translate goal to git: <natural language goal>`
- **Target Format**: `<command> [SEP] <risk_level> [SEP] <explanation>`
- **Optimizer**: AdamW ($\text{lr} = 5 \times 10^{-5}$, linear warmup across 10% steps)
- **Batch Size**: 16 with gradient clipping (max norm 1.0)
- **Epochs**: 5

### Handwritten Test Set Results (`training/evaluate.py`)
Tested on 30 human-written edge cases never seen during training:
- **Subcommand Verb Accuracy**: **63.3%**
- **Risk Classification Accuracy**: **50.0%** (with pattern safety-net: 100% safe from under-categorization)
- **Exact String Match**: **43.3%**

---

## 6. Directory Structure

```
layer5-nl2git/
├── data/
│   ├── goal_categories.yaml        # 50 canonical Git categories + seeds
│   ├── generate_training.py        # LLM + rule paraphrase generator
│   ├── validate_training.py        # Sandbox & safety validation
│   ├── training_data.jsonl         # Raw generated candidates
│   ├── validated.jsonl             # 708 validated (goal, command, risk, explanation)
│   └── handwritten_test.jsonl      # 30 human-written evaluation items
├── training/
│   ├── dataset.py                  # PyTorch Dataset for t5-small
│   ├── finetune_t5.py              # Colab T4 training loop with evaluation
│   └── evaluate.py                 # Out-of-sample test set benchmark
├── inference/
│   ├── risk_taxonomy.py            # Risk levels, pattern scanner, warning templates
│   ├── model.py                    # Inference pipeline (t5 + Gemini + offline)
│   └── postprocess.py              # Output cleaner and risk validator
├── space/
│   ├── app.py                      # Hugging Face Gradio Space UI
│   ├── requirements.txt            # Zero-GPU pip dependencies
│   └── README.md                   # Space configuration metadata
└── README.md                       # This engineering document
```
