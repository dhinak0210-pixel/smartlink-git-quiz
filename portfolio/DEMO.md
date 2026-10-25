# SmartLink Git Quiz — Demonstration Walkthrough

This guide walks through running a complete live demonstration of all five platform layers locally.

---

## 1. Prerequisites & Setup

```bash
# Clone and enter repository
cd "smart links"

# Install Node.js dependencies
npm install

# Activate Python virtual environment
source layer3-ai/.venv/bin/activate
```

---

## 2. Launching the Platform

Start the production server:
```bash
npm run build
npm start
```
The application will be live at `http://localhost:3000`.

---

## 3. Platform Tour & Verification Steps

### 3.1 Student Experience & Live Quiz
1. Open `http://localhost:3000` in your browser.
2. Log in using demo credentials:
   - **College ID:** `CS2024001`
   - **Join Code:** `baf4jc`
3. Enter the student lobby (`/lobby`).
4. Notice that question clocks sync to the master state server.

### 3.2 Admin Control Deck & Anti-Cheat Monitor
1. In an Incognito window, navigate to `http://localhost:3000/admin/login`.
2. Enter the admin password: `admin123`.
3. View the live monitoring deck (`/admin/monitor`):
   - Real-time active student counts.
   - Live telemetry feed showing focus events and flag alerts.
   - Admin controls: Start Quiz, Pause, Resume, and Emergency Reset.

### 3.3 Two-Organizer Results Approval Gate
1. Navigate to `/results`.
2. Notice that public results are initially hidden: *"The results are currently being verified and finalized by the organizers."*
3. As Organizer 1, submit the first approval via API or Admin Panel.
4. Attempting to submit a second approval with the same account returns `HTTP 409 Conflict: already_approved`.
5. Submit the second approval as Organizer 2.
6. Refresh `/results` — the **Live Podium and Top 10 Leaderboard** immediately go live!

### 3.4 Student Certificate & Report Download
1. Navigate to `http://localhost:3000/download`.
2. Log in with `CS2024001` and `baf4jc`.
3. Click **Download Certificate** — generates a cryptographically signed, 300-second expiring download URL for the student's high-resolution A4 certificate.

### 3.5 Version 2 Adaptive Practice Mode
1. Navigate to `http://localhost:3000/practice`.
2. Notice your baseline **Elo Rating (1500)** and Tier (**Proficient**).
3. Select an answer and click **Submit Answer**.
4. Observe the instant feedback:
   - Dynamic Elo adjustment (e.g. `+24 Elo`).
   - In-depth pedagogical explanation of the underlying Git concept.
   - Automatic fetching of the next adaptive question matched to your updated rating.

---

## 4. Running Post-Event ML & Data Science Pipeline

```bash
# Step Zero: Data Anonymization & Re-identification Risk Verification
python layer5-analysis/scripts/anonymize.py --verify

# Phase A: Classical Item Analysis (p-value, discrimination, distractor heatmaps)
python layer5-analysis/scripts/question_stats.py

# Phase A: Automated Event Summary Report Generator
python layer5-analysis/scripts/event_report.py

# Phase B: Item Response Theory (IRT 1PL/2PL) Calibration
python layer5-analysis/scripts/irt_calibration.py

# Phase B: Early-Score Prediction (Student-Level Cross Validation)
python layer5-analysis/scripts/skill_prediction.py

# Phase B: Heuristic Rules vs Unsupervised ML Cheat Detection
python layer5-analysis/scripts/cheat_detection_ml.py

# Phase B: Curricular Weakness & Skill Gap Clustering
python layer5-analysis/scripts/topic_clustering.py
```

---

## 5. Testing the Sandboxed Git Judge Agent

```bash
python apps/judge-agent/src/test_judge.py
```
Expected output:
```
....
----------------------------------------------------------------------
Ran 4 tests in 0.004s

OK
```
All unit tests verify that Git challenge grading succeeds across rebase squashes, conflict resolution, and detached HEAD recovery without requiring native git binaries.
