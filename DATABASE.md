# SmartLink Git Quiz — Database Layer Architecture (Supabase PostgreSQL 15)

## 1. Overview
The database layer for **SmartLink Git Quiz** is engineered for **zero-cost (₹0)**, high-concurrency event reliability supporting **200 registered students** answering **15 unique questions** assigned from a master bank of **90 questions** (30 easy, 30 medium, 30 hard).

- **Hosting**: Supabase Free Tier (PostgreSQL 15)
- **Storage**: ~1.5 MB used / 500 MB quota (~0.3%)
- **Security**: Strict Row-Level Security (RLS) on all 7 tables with zero public access. Server routes access via `service_role`.
- **Connections**: Zero realtime subscriptions; students and admin poll REST endpoints.

---

## 2. Entity Relationship Overview

```text
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│  students   │       │ student_questions │       │  questions  │
│  (200 rows) │──1:N──│   (3,000 rows)   │──N:1──│  (90 rows)  │
│             │       │  THE ASSIGNMENT   │       │             │
│ college_id  │       │  TABLE (key!)     │       │ difficulty  │
│ join_code   │       │  position 1-15    │       │ topic       │
└──────┬──────┘       └──────────────────┘       └──────┬──────┘
       │                                                │
       │ 1:N                                            │ 1:N
       │                                                │
┌──────┴──────┐                                  ┌──────┴──────┐
│   answers   │                                  │   options   │
│ (3,000 rows)│──N:1─────────────────────────────│ (360 rows)  │
│             │                                  │             │
│ response_ms │                                  │ is_correct  │
│ points      │                                  │ label A-D   │
└──────┬──────┘                                  └─────────────┘
       │
       │ 1:N
       │
┌──────┴──────┐       ┌─────────────┐
│   events    │       │ quiz_state  │
│ (audit log) │       │ (1 row)     │
│             │       │             │
│ type        │       │ status      │
│ metadata    │       │ started_at  │
└─────────────┘       └─────────────┘
```

---

## 3. Database Tables

### 3.1 `students` (200 rows)
Stores the participant roster pre-populated from registration.
- `id` (UUID, PK, default `gen_random_uuid()`): Student unique identifier.
- `college_id` (VARCHAR(50), UNIQUE, NOT NULL): College roll number (e.g. `CS2024001`). Indexed.
- `name` (VARCHAR(100), NOT NULL): Participant full name.
- `join_code` (VARCHAR(20), UNIQUE, NOT NULL): Secret 6-char alphanumeric code (e.g. `ak7x9m`). Indexed on `LOWER(join_code)`.
- `is_active` (BOOLEAN, default TRUE): Participant status.
- `created_at` (TIMESTAMPTZ, default `NOW()`).

### 3.2 `questions` (90 rows)
The master question bank: 30 easy + 30 medium + 30 hard questions.
- `id` (UUID, PK, default `gen_random_uuid()`).
- `text` (TEXT, NOT NULL): The question prompt.
- `difficulty` (VARCHAR(10), CHECK `('easy', 'medium', 'hard')`): Determines selection pool.
- `topic` (VARCHAR(50), NOT NULL): Git subtopic (`basics`, `branching`, `rebase`, `internals`, etc.).
- `explanation` (TEXT, NOT NULL): Educational explanation shown during result phase.
- `points_base` (INTEGER, default 1000): Base points before speed bonus.
- `is_active` (BOOLEAN, default TRUE).
- `created_at` (TIMESTAMPTZ, default `NOW()`).

### 3.3 `options` (360 rows)
4 choices per question. Exactly 1 is correct.
- `id` (UUID, PK, default `gen_random_uuid()`).
- `question_id` (UUID, FK -> `questions(id)` ON DELETE CASCADE).
- `text` (TEXT, NOT NULL): Option choice text.
- `is_correct` (BOOLEAN, default FALSE): Correct answer flag.
- `label` (CHAR(1), CHECK `('A', 'B', 'C', 'D')`): Canonical choice letter.
- Constraints: `UNIQUE (question_id, label)`.

### 3.4 `student_questions` (3,000 rows)
Personalized assignment table mapping each student to 15 unique questions.
- `id` (UUID, PK, default `gen_random_uuid()`).
- `student_id` (UUID, FK -> `students(id)` ON DELETE CASCADE).
- `question_id` (UUID, FK -> `questions(id)`).
- `position` (INTEGER, CHECK `BETWEEN 1 AND 15`):
  - Positions 1–5: Easy questions (from 30-question easy pool)
  - Positions 6–10: Medium questions (from 30-question medium pool)
  - Positions 11–15: Hard questions (from 30-question hard pool)
- Constraints: `UNIQUE (student_id, position)`, `UNIQUE (student_id, question_id)`.

### 3.5 `quiz_state` (1 row)
Singleton global quiz clock and tournament state.
- `id` (INTEGER, PK, CHECK `id = 1`).
- `status` (VARCHAR(10), CHECK `('waiting', 'running', 'paused', 'finished')`).
- `started_at` (TIMESTAMPTZ): Anchor timestamp set when admin starts tournament.
- `question_seconds` (INTEGER, default 20).
- `gap_seconds` (INTEGER, default 5).
- `total_questions` (INTEGER, default 15).

### 3.6 `answers` (up to 3,000 rows)
Server-graded responses submitted during tournament.
- `id` (UUID, PK, default `gen_random_uuid()`).
- `student_id` (UUID, FK -> `students(id)`).
- `question_id` (UUID, FK -> `questions(id)`).
- `option_id` (UUID, FK -> `options(id)`).
- `position` (INTEGER, CHECK `BETWEEN 1 AND 15`).
- `response_ms` (INTEGER, NOT NULL): Server-computed response latency.
- `is_correct` (BOOLEAN, NOT NULL).
- `points` (INTEGER, default 0): Server-calculated score.
- `created_at` (TIMESTAMPTZ, default `NOW()`).
- Constraints: `UNIQUE (student_id, question_id)`, `UNIQUE (student_id, position)`.

### 3.7 `events` (Audit log)
Security and telemetry audit log.
- `id` (UUID, PK).
- `student_id` (UUID, FK -> `students(id)`).
- `type` (VARCHAR(30), e.g. `login`, `kick`, `logout`, `late_join`).
- `metadata` (JSONB, default `{}`).
- `created_at` (TIMESTAMPTZ, default `NOW()`).

---

## 4. Integrity Triggers

1. **`trg_max_four_options`**: Prevents adding a 5th option to any question (`RAISE EXCEPTION`).
2. **`trg_single_correct_option`**: Enforces that only 1 option per question can have `is_correct = TRUE`.
3. **`enforce_complete_labels`**: Ensures labels A, B, C, D are preserved.

---

## 5. PostgreSQL Views

- **`leaderboard`**: Ranks students by `SUM(points) DESC`, then by `AVG(response_ms) FILTER (WHERE a.is_correct) ASC` as the speed tiebreaker.
- **`question_analytics`**: Aggregates question accuracy percentage, total attempts, and average response times.
- **`student_results`**: Detailed per-question report for each student with question text, student's selected answer, and correct answer text.

---

## 6. Stored Helper Functions

- **`calculate_points(p_is_correct, p_response_ms, p_points_base)`**:
  $$0 \text{ if wrong}, \quad 1000 + \text{round}\left(500 \times \left(1 - \frac{\text{clamp}(ms, 0, 20000)}{20000}\right)\right) \text{ if correct}$$
- **`get_question_window(p_position)`**: Returns `(opens_at, closes_at, is_open)` using `quiz_state.started_at` + 1s network grace.
- **`validate_assignments()`**: Automated 4-point verification function checking assignment integrity.

---

## 7. Deployment Instructions

1. **Apply Schema**: Copy and paste [`supabase/schema.sql`](supabase/schema.sql) into the Supabase SQL Editor and execute.
2. **Import Participants**: Run [`scripts/seed-students.sql`](scripts/seed-students.sql).
3. **Import Questions & Options**: Run [`scripts/seed-questions.sql`](scripts/seed-questions.sql) and [`scripts/seed-options.sql`](scripts/seed-options.sql).
4. **Generate Assignments**:
   - Run `npx tsx scripts/generate-assignments.ts` (or execute [`scripts/seed-assignments.sql`](scripts/seed-assignments.sql) in SQL Editor).
5. **Verify**:
   - Run `SELECT * FROM validate_assignments();` in SQL Editor. All checks must return `true`.
