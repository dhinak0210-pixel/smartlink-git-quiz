# Event-Day Operational Runbook — SmartLink Git Quiz

This runbook defines the exact operational timeline, command sequence, verification gates, and emergency procedures for the SmartLink Git Quiz competition.

---

## Roles and Responsibilities

| Role | Primary Contact | Responsibilities |
|---|---|---|
| **Lead Organizer (Owner)** | `dhina7250@gmail.com` | Primary decision maker, kill switch, final winner sign-off, bank freeze |
| **Co-Organizer** | `co_organizer@klu.ac.in` | Secondary sign-off on voids, penalties, disqualifications, and winner |
| **Volunteer Help Desk** | `helpdesk@klu.ac.in` | Unlocking contestant accounts, password assistance, hardware issues |

---

## Operational Timeline

### T-24 Hours: Pre-Flight Verification & Test Login Window
1. **Open Test Login Portal:**
   - Direct all participants to `https://smartlink-quiz.vercel.app/test-login`
   - Verify that credentials authenticate and display green confirmation badges without starting quiz state.
2. **Execute Database & Environment Audit:**
   ```bash
   node scripts/audit-supabase.js
   ```
   *Gate:* Must report 0 failures and all 35 tables present with active RLS.
3. **Execute Pre-Event IRT & Variant Calibration:**
   ```bash
   python3 variant-pipeline/run_pipeline.py
   python3 layer5-cheat/pipeline/precompute.py
   ```
4. **Freeze Question Bank:**
   - Verify SHA-256 hash in `bank_freeze` table.

---

### T-2 Hours: Production Infrastructure Warm-Up
1. **Supabase Awakening & Latency Check:**
   - Run wake script to prevent cold-start delays:
     ```bash
     bash scripts/wake-supabase.sh
     ```
2. **Automated Readiness Checklist Audit:**
   - Hit endpoint: `GET /api/admin/readiness`
   - Verify that all 6 checks return `ok: true`:
     - [x] Database online (<100ms latency)
     - [x] Student allowlist imported (>0 registered)
     - [x] Question bank loaded (15 questions)
     - [x] Bank hash verified & frozen
     - [x] Both organizer accounts active
     - [x] Emergency fallback URL verified

---

### T-30 Minutes: Student Lobby & Projector Display
1. **Projector Setup:**
   - Open projector screen on auditorium display: `https://smartlink-quiz.vercel.app/projector`
   - Verify clean display mode without administrative flags.
2. **Open Contestant Lobby:**
   - Direct students to `https://smartlink-quiz.vercel.app/lobby`
   - Monitor real-time join count on `/admin/live` and `/admin/students`.
3. **Help Desk Standby:**
   - Help-desk volunteers monitor `/admin/students` to unlock students with forgotten passwords.

---

### T-0: Official Competition Launch
1. **Live Start Trigger:**
   - Lead Organizer clicks **"Start Official Quiz"** on `/admin/live`.
   - The server initializes `started_at = NOW()`, transitions status to `running`.
   - All student lobby timers auto-transition to Question #1.
2. **Live Monitoring:**
   - Observe live submission counts, error rate, and response times on `/admin/live`.

---

### Contingency Protocols During Quiz

#### 1. Glitch / Projector Audio Interruption (Pause)
- Click **"Pause Quiz"** on `/admin/live`.
- Timer freezes on all contestant devices with full-screen pause notice.
- When ready, click **"Resume Competition"**. Timer resumes shifted by `pauseOffsetMs`.

#### 2. Faulty Question Detected Mid-Quiz (Void)
- Submit void request from `/admin/dashboard` or `/admin/live`.
- Co-Organizer visits `/admin/approvals` and clicks **"Second Sign-Off"**.
- The server records `question_voids`, halts accepting answers for that question, and shifts downstream timing.

#### 3. Unrecoverable Outage (Emergency Kill Switch)
- Lead Organizer clicks **"Kill Switch"** on `/admin/live`.
- Type confirmation: `ACTIVATE_KILL_SWITCH`.
- The server broadcasts emergency banner with the Google Form fallback link:
  `https://forms.google.com/...`

---

### T+30 Minutes: Post-Quiz Adjudication & Winner Verification
1. **Freeze Standings:**
   - Click **"End Quiz Gracefully"** or **"Freeze Standings"** on `/admin/results`.
   - Snapshot is written to `leaderboard_snapshots`.
2. **Run Post-Event Anti-Cheat Pipeline (<10 min):**
   ```bash
   python3 layer5-cheat/pipeline/event_day.py
   ```
3. **Review Flag Queue:**
   - Open `/admin/flags`.
   - Review evidence packs for contestants in the Top 10.
   - If a contestant is cleared or penalized, submit decision with dual sign-off.
4. **Recompute Final Scores:**
   - Click **"Recompute Scores"** on `/admin/results`.
   - If there is a tie for 1st place, trigger a Sudden Death question round.
5. **Two-Person Winner Approval:**
   - Lead Organizer and Co-Organizer approve winner on `/admin/results`.
   - Click **"Reveal to Projector"** and **"Publish Results"**.

---

### T+2 Hours: Certificate Distribution
1. Contestants visit `https://smartlink-quiz.vercel.app/results` or `/download`.
2. Digital certificates generated server-side with cryptographic tamper-evident hashes.
