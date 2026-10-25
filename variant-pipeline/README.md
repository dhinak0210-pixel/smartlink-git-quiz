# Question Variants with Execution Validation Pipeline (Private)

This subsystem generates, validates, and freezes parameterized question variants for the SmartLink Git Quiz.

## Core Architectural Rules

1. **Code makes the variants, LLM only drafts:** Parameters are sampled deterministically.
2. **Answer key is a measured result:** Proven by executing Git inside an isolated disposable sandbox.
3. **Untrusted code territory:** Disallows network, shell pipes, and unverified flags.
4. **Fairness & Parity:** Variants of the same item possess identical reading load, option count, and distractor mechanics.
5. **Self-Testing Validator:** Planted bad variants (wrong key, ambiguous distractor, cross-variant leak, unsafe command) must be rejected by the validation gates.

## Workflow

```bash
# 1. Run all validator unit tests
pytest variant-pipeline/tests/

# 2. Run the end-to-end variant pipeline
python variant-pipeline/run_pipeline.py
```
