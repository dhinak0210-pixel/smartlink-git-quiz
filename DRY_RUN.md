# Rehearsal & Dry-Run Procedure — SmartLink Git Quiz

This guide documents how to conduct an end-to-end rehearsal with 20–30 simulated or volunteer contestants using isolated `event_id` scoping.

---

## 1. Dry-Run Isolation Strategy
- All tables in Supabase (`events`, `quiz_state`, `event_settings`, `answers`, `leaderboard_snapshots`) are scoped by `event_id`.
- The production event uses `DEFAULT_EVENT_ID` (`00000000-0000-0000-0000-000000000001`).
- The dry-run rehearsal uses `REHEARSAL_EVENT_ID` (`ffffffff-ffff-ffff-ffff-ffffffffffff`).
- This guarantees zero pollution of production scores, audit logs, or student records.

---

## 2. Setting Up the Rehearsal Event

Run the automated rehearsal setup script:
```bash
node scripts/simulate-full-tournament.js --dry-run
```

Or manually initialize via SQL/API:
```sql
INSERT INTO events (id, title, status, started_at, created_by)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Dry-Run Rehearsal Tournament',
  'waiting',
  NULL,
  '1c0ad6c5-0949-4964-916f-8806d4cf4c3f'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO event_settings (event_id, values)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '{"seconds_per_question": 10, "gap_seconds": 3, "total_questions": 5}'::jsonb
) ON CONFLICT (event_id) DO NOTHING;
```

---

## 3. Seed 25 Rehearsal Contestants

Generate 25 test student accounts:
```bash
node -e '
const fs = require("fs");
const students = [];
for (let i = 1; i <= 25; i++) {
  students.push({
    name: `Dry Run Contestant ${i}`,
    email: `dryrun${i}@klu.ac.in`,
    register_no: `DRYRUN${String(i).padStart(3, "0")}`,
    join_code: `DRY2026_${i}`,
    status: "registered"
  });
}
fs.writeFileSync("scripts/dryrun-students.json", JSON.stringify(students, null, 2));
console.log("Generated 25 dry-run contestant accounts in scripts/dryrun-students.json");
'
```

Import them into the allowlist:
```bash
curl -X POST http://localhost:3000/api/admin/allowlist/import \
  -H "Content-Type: application/json" \
  -d '{"students": '"$(cat scripts/dryrun-students.json)"'}'
```

---

## 4. Rehearsal Execution Protocol

| Step | Action | Expected Result |
|---|---|---|
| **1. Login Verification** | 25 contestants log in via `/login` or `/test-login` | All 25 transition to `logged_in`, appear on `/admin/students` |
| **2. Lobby Countdown** | Contestants wait at `/lobby` | Real-time countdown matches server start time |
| **3. Quiz Launch** | Admin clicks **Start Quiz** on `/admin/live` | Status changes to `running`, contestants see Question 1 |
| **4. Pause Rehearsal** | At Question 2, Admin triggers **Pause** | All contestant screens show Pause overlay; timers hold |
| **5. Resume Rehearsal** | Admin clicks **Resume** | Quiz unfreezes; timers adjust by elapsed pause time |
| **6. Void Rehearsal** | Admin voids Question 3 via dual sign-off | Question 3 marked voided; submissions rejected |
| **7. Tournament Finish** | After Question 5, quiz concludes | Standings frozen; snapshot stored in `leaderboard_snapshots` |
| **8. Anti-Cheat Pipeline** | Run `python3 layer5-cheat/pipeline/event_day.py` | Generates evidence packs and flags anomalous response times |
| **9. Recompute & Winner** | Admin recomputes on `/admin/results` and approves winner | Winner revealed on `/projector` display |

---

## 5. Teardown / Cleanup
After completing the dry run, reset the rehearsal event:
```bash
curl -X POST http://localhost:3000/api/admin/reset \
  -H "Content-Type: application/json" \
  -d '{"eventId": "ffffffff-ffff-ffff-ffff-ffffffffffff"}'
```
Production records remain completely pristine.
