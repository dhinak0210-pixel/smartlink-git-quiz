# SmartLink Git Quiz — Layer 5 Cheat Detection & Forensic Pipeline (Private)

A forensic statistical integrity pipeline for the SmartLink Git Quiz. Built to process 200 participants with 3,000 live answers, running locally in <30 minutes at **₹0 infrastructure expenditure**.

---

## 🛡️ Foundational Principles & Hard Rules

1. **Patterns, Never Proof:** This system flags statistical patterns. It **NEVER proves cheating**. Every report includes explicit uncertainty, caveats, and notes on benign explanations (e.g. erratic guessing, shared misconceptions, rapid reading).
2. **Zero Automated Penalties:** Tiers produce a ranked review list for human adjudicators. A human reviewer with a second organizer sign-off decides every action.
3. **Simulation-Grounded Thresholds:** With 15 items and ~19,900 student pairs, textbook asymptotic formulas are unreliable. Thresholds are derived from 1,000 honest-class simulations, taking the 99th (Strong) and 90th (Review) percentiles of maximum statistics.
4. **Prevention First:** Deterministic option shuffling, randomized question variants, and synchronized server clocks eliminate 95% of opportunism. Detection is strictly a backstop.
5. **Two-Pass IRT Calibration:** Person-fit uses Rasch difficulties calibrated exclusively from the clean response pass. No student's own flag influences their baseline.
6. **₹0 Total Cost:** Pure Python using NumPy, SciPy, pandas, statsmodels, scikit-learn, and NetworkX.
7. **Zero Row-Level PII Published:** Row-level flags are private confidential data. Public portfolio pages publish only aggregate statistics.
8. **Pre-Specified Cleaning Rules:** Committed to `data/cleaning_rules.yaml` prior to inspection.
9. **Non-Directional Pair Matches:** Sibling matches record shared error frequency; directionality (who copied whom) is mathematically indeterminate.
10. **Integrates with Layers 1–5:** Consumes anonymized responses, clean IRT parameters, variant assignments, and Layer 2 behavioral events; updates Layer 2 Trust Scores.

---

## 📊 Detection Capabilities

| Situation | Detectable? | Why / Limitation |
|---|---|---|
| **Heavy copying from a weaker student** | **Yes, best case** | Shared wrong answers on rare distractors are virtually impossible by chance. |
| **Copying from a strong student** | **Mostly no** | Few shared wrong answers exist; person-fit may flag if weak student gets very hard items right. |
| **External help (search, AI assistant)** | **Partly** | Slower response times, window blur events, high accuracy beyond estimated ability. |
| **Answer key leaked in advance** | **Partly** | Rapid-fire correct answers on items hard for that student profile. |
| **Perfect 15/15 score** | **Person-fit cannot flag** | Perfect answers contain no Guttman error inversions; only timing and telemetry can audit. |
| **One answer relayed by voice** | **No** | Insufficient statistical signal in a 15-question instrument. |

---

## 🚀 Execution & Workflow

```bash
# 1. Run all detector unit tests
python -m pytest layer5-cheat/tests/

# 2. Precompute simulation thresholds (prior to event day)
python layer5-cheat/pipeline/precompute.py

# 3. Run full event-day pipeline (<30 min target)
python layer5-cheat/pipeline/event_day.py

# 4. Emergency spreadsheet fallback (in case of runtime issues)
python layer5-cheat/pipeline/fallback.py
```
