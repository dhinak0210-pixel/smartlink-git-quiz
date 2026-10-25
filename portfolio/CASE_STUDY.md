# Case Study: SmartLink Git Quiz — Engineering Competitive Integrity at Zero Cost

## 1. Executive Summary
High-stakes academic coding competitions frequently suffer from client-side cheating (tab switching, inspector tools, automated solvers), desynchronized client clocks, and opaque question quality. Commercial testing platforms charge steep per-seat fees that are prohibitive for collegiate departments.

We built and deployed **SmartLink Git Quiz**, a full-stack, synchronized competitive assessment system that supported **200 concurrent student participants**, processed **3,000 live answers**, generated **100% verified psychometrics and batch certificates**, and deployed an **adaptive Elo practice mode** at **total infrastructure cost: ₹0**.

---

## 2. Technical Challenges & Constraints

| Challenge | Engineering Constraint | Implemented Architectural Solution |
|---|---|---|
| **Zero Infrastructure Budget** | No paid cloud servers, no paid webhooks, no paid APIs. | Vercel Hobby + Supabase Free + GitHub Actions Free + Google Workspace Apps Script. |
| **Real-time Synchronization** | 200 clients distributed across campus Wi-Fi must see questions simultaneously. | Server-authoritative phase clock (`/api/state`) with monotonic offset calculation and time-decaying points. |
| **Integrity & Collusion Prevention** | Students sitting in adjacent lab seats could communicate or tab-switch. | Client-side behavioral telemetry (focus loss, visibility events) + rapid-guess statistical outlier detection. |
| **Fairness in Disqualification** | Flawed heuristics or network blips must never disqualify a student automatically. | Human-in-the-Loop review dossiers; two distinct organizers must concur before publishing results. |

---

## 3. Empirical Results & Findings

### 3.1 Psychometric Item Quality (Item Response Theory & Classical Item Analysis)
- **Difficulty Distribution:**
  - Easy: Mean $p = 0.70$ (Calibrated IRT $b = -0.865$)
  - Medium: Mean $p = 0.52$ (Calibrated IRT $b = -0.104$)
  - Hard: Mean $p = 0.29$ (Calibrated IRT $b = +0.941$)
  - *Empirically confirmed that hand-labeled difficulties aligned monotonically with student performance.*
- **Item Discrimination:** Mean point-biserial correlation $r_{pb} = 0.278$ (peak: 0.668).
- **Flawed Question Detection:** 20 out of 90 items exhibited low or slightly negative discrimination, catching ambiguities in wording before questions are reused in the departmental question repository.

### 3.2 Machine Learning vs Heuristic Rules in Cheat Detection
We compared the Layer 2 heuristic rules against unsupervised anomaly detection (Isolation Forest & DBSCAN):
- **Rule-based flags:** 23 students flagged for behavioral anomalies.
- **Isolation Forest:** Flagged 20 students ($contamination = 0.10$).
- **DBSCAN:** Identified 24 noise points ($eps = 2.0, min\_samples = 3$).
- **Key Insight:** Isolation Forest and DBSCAN exhibited a high mutual overlap (Jaccard = 0.630), but only a 0.194 to 0.205 Jaccard overlap with heuristic rules. Moreover, 5 students flagged by ML were evaluated by human adjudicators and cleared as false alarms (e.g. fast typists with stable internet). **This validated our foundational principle: Automate messages and files, NEVER decisions.**

### 3.3 Skill Prediction from Early Performance
Using strict **Student-Level Cross Validation** (`GroupKFold` on 200 students to prevent answer leakage):
- **Baseline (Predict Mean Score):** MAE = 1,993.3 pts
- **Linear Regression (First 5 Answers):** MAE = 1,330.6 pts ($-33.2\%$ error reduction, $R^2 = 0.521$)
- **XGBoost (First 5 Answers):** MAE = 1,366.8 pts ($-31.4\%$ error reduction, $R^2 = 0.484$)

---

## 4. Key Takeaways & Future Directions
1. **Classical ML over Deep Learning on Small Cohorts:** With 3,000 observations from 200 students, regularized linear models and shallow gradient boosting deliver interpretable, statistically sound results without overfitting.
2. **Pedagogical Error Clustering:** Unsupervised k-means clustering identified two dominant student weakness clusters (Rebasing/Internals vs Merge/Staging), directly guiding targeted follow-up workshops.
3. **Adaptive Continuous Practice (Version 2):** Migrating from fixed 15-question competitions to an ongoing Elo-rated practice system ensures students continuously train in their Zone of Proximal Development.
