# SmartLink Git Quiz — Layer 5: Post-Event Analysis & ML (Private)

This directory contains the confidential data science, statistical psychometrics, and machine learning pipeline for the SmartLink Git Quiz.

## Core Rules & Constraints

1. **Privacy & Consent First:** No raw student PII (names, college IDs, join codes, IP addresses) is ever analyzed or committed. All analyses run on datasets produced by `scripts/anonymize.py`.
2. **Real Numbers Only:** No synthetic or inflated claims. The study comprises one college event, ~200 participants, and ~3,000 question responses.
3. **Student-Level Cross Validation:** Splits are partitioned strictly by student ID (`GroupKFold`), preventing answer leakage across train and test sets.
4. **Baselines Required:** Every predictive model is compared against simple baseline predictors (e.g. mean score, majority class).
5. **Reproducibility:** All seeds are fixed (`RANDOM_SEED = 42`).

## Pipeline Architecture

- `scripts/anonymize.py`: Step Zero anonymization, rounding timing to 500ms intervals, dropping identifiers.
- `scripts/question_stats.py`: Classical Item Analysis (p-value difficulty, point-biserial discrimination, distractor analysis, flaw detection).
- `scripts/event_report.py`: Comprehensive collegiate event report generation.
- `scripts/irt_calibration.py`: 1PL / 2PL Item Response Theory item parameter calibration.
- `scripts/skill_prediction.py`: Student final score prediction from first-5 responses with XGBoost vs Linear vs Baseline.
- `scripts/topic_clustering.py`: Unsupervised skill gap and curricular weakness clustering.
- `scripts/cheat_detection_ml.py`: Heuristic rules vs Isolation Forest & DBSCAN agreement analysis.
- `notebooks/`: Interactive walkthroughs (`01_eda.ipynb` through `06_elo_practice.ipynb`).
- `data/public/`: De-identified aggregate statistics and charts safe for publication.
