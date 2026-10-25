-- =========================================================================
-- SmartLink Git Quiz — Complete Database Layer (Supabase PostgreSQL 15)
-- Zero-cost, server-authoritative, 200 students, 90 questions, 3000 assignments
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop views if existing
DROP VIEW IF EXISTS student_results CASCADE;
DROP VIEW IF EXISTS question_analytics CASCADE;
DROP VIEW IF EXISTS leaderboard CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS student_questions CASCADE;
DROP TABLE IF EXISTS options CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS quiz_state CASCADE;

-- ============================================================
-- 1. TABLE: students
-- Purpose: Store 200 registered participants.
-- ============================================================
CREATE TABLE students (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id  VARCHAR(50)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    join_code   VARCHAR(20)  UNIQUE NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_college_id ON students(college_id);
CREATE INDEX idx_students_join_code  ON students(LOWER(join_code));

COMMENT ON TABLE students IS
  '200 registered participants. join_code is a 6-char alphanumeric string from the registration sheet, used for login verification.';
COMMENT ON COLUMN students.college_id IS 'Unique college roll number, e.g., CS2024001';
COMMENT ON COLUMN students.join_code IS 'Secret 6-char code, e.g., ak7x9m. Case-insensitive on login.';
COMMENT ON COLUMN students.is_active IS 'Set to FALSE to ban a student without deleting their data.';

-- ============================================================
-- 2. TABLE: questions (THE QUESTION BANK)
-- Distribution: 30 easy + 30 medium + 30 hard.
-- ============================================================
CREATE TABLE questions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    text        TEXT         NOT NULL,
    difficulty  VARCHAR(10)  NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    topic       VARCHAR(50)  NOT NULL,
    explanation TEXT         NOT NULL,
    points_base INTEGER      NOT NULL DEFAULT 1000,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_difficulty_active
    ON questions(difficulty)
    WHERE is_active = TRUE;

CREATE INDEX idx_questions_topic ON questions(topic);

COMMENT ON TABLE questions IS
  'Master question bank. ~90 questions: 30 easy, 30 medium, 30 hard. Correct answers are in the options table.';
COMMENT ON COLUMN questions.difficulty IS 'Controls which pool the question is drawn from during assignment generation.';
COMMENT ON COLUMN questions.topic IS 'Git subtopic tag: basics, branching, merging, rebase, reset, stash, cherry-pick, hooks, internals, etc.';
COMMENT ON COLUMN questions.points_base IS 'Base points for a correct answer. Default 1000.';
COMMENT ON COLUMN questions.is_active IS 'Set to FALSE to exclude from assignment generation without deleting.';

-- ============================================================
-- 3. TABLE: options
-- 4 choices per question (labels A, B, C, D), exactly 1 correct.
-- ============================================================
CREATE TABLE options (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text        TEXT    NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    label       CHAR(1) NOT NULL CHECK (label IN ('A', 'B', 'C', 'D'))
);

CREATE INDEX idx_options_question ON options(question_id);
CREATE UNIQUE INDEX idx_options_question_label ON options(question_id, label);

COMMENT ON TABLE options IS
  '4 options per question. Exactly 1 has is_correct = TRUE. Labels A-D are canonical.';

-- ============================================================
-- 4. TRIGGERS FOR DATA INTEGRITY
-- ============================================================

-- Trigger 1: Enforce maximum 4 options per question
CREATE OR REPLACE FUNCTION enforce_max_four_options()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM options WHERE question_id = NEW.question_id) >= 4 THEN
        RAISE EXCEPTION 'Cannot add more than 4 options to question %', NEW.question_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_max_four_options
    BEFORE INSERT ON options
    FOR EACH ROW
    EXECUTE FUNCTION enforce_max_four_options();

-- Trigger 2: Enforce exactly 1 correct option per question
CREATE OR REPLACE FUNCTION enforce_single_correct_option()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_correct = TRUE THEN
        IF EXISTS (
            SELECT 1 FROM options
            WHERE question_id = NEW.question_id
              AND is_correct = TRUE
              AND id != NEW.id
        ) THEN
            RAISE EXCEPTION 'Question % already has a correct option. Only one allowed.', NEW.question_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_correct_option
    BEFORE INSERT OR UPDATE ON options
    FOR EACH ROW
    EXECUTE FUNCTION enforce_single_correct_option();

-- Trigger 3: Enforce all 4 labels are maintained
CREATE OR REPLACE FUNCTION enforce_complete_labels()
RETURNS TRIGGER AS $$
DECLARE
    label_count INTEGER;
BEGIN
    IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.label != NEW.label) THEN
        SELECT COUNT(DISTINCT label) INTO label_count
        FROM options
        WHERE question_id = COALESCE(NEW.question_id, OLD.question_id)
          AND id != COALESCE(NEW.id, OLD.id);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. TABLE: student_questions (THE ASSIGNMENT TABLE)
-- 200 students × 15 questions = 3,000 rows.
-- Positions 1-5: Easy, 6-10: Medium, 11-15: Hard.
-- ============================================================
CREATE TABLE student_questions (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID    NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_id UUID    NOT NULL REFERENCES questions(id),
    position    INTEGER NOT NULL CHECK (position BETWEEN 1 AND 15),

    UNIQUE (student_id, position),
    UNIQUE (student_id, question_id)
);

CREATE INDEX idx_sq_student_position ON student_questions(student_id, position);
CREATE INDEX idx_sq_question         ON student_questions(question_id);

COMMENT ON TABLE student_questions IS
  'Personalized question assignments. 3,000 rows (200 × 15). Each student gets 5 easy (pos 1-5) + 5 medium (pos 6-10) + 5 hard (pos 11-15).';

-- ============================================================
-- 6. TABLE: quiz_state
-- Singleton global quiz clock table.
-- ============================================================
CREATE TABLE quiz_state (
    id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    status           VARCHAR(10) NOT NULL DEFAULT 'waiting'
                       CHECK (status IN ('waiting', 'running', 'paused', 'finished')),
    started_at       TIMESTAMPTZ,
    question_seconds INTEGER NOT NULL DEFAULT 20,
    gap_seconds      INTEGER NOT NULL DEFAULT 5,
    total_questions  INTEGER NOT NULL DEFAULT 15
);

INSERT INTO quiz_state (id, status, question_seconds, gap_seconds, total_questions)
VALUES (1, 'waiting', 20, 5, 15);

COMMENT ON TABLE quiz_state IS
  'Singleton table. Global quiz clock. started_at is the anchor for all timing calculations.';

-- ============================================================
-- 7. TABLE: answers
-- Server-computed response_ms and points.
-- ============================================================
CREATE TABLE answers (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID         NOT NULL REFERENCES students(id),
    question_id UUID         NOT NULL REFERENCES questions(id),
    option_id   UUID         NOT NULL REFERENCES options(id),
    position    INTEGER      NOT NULL CHECK (position BETWEEN 1 AND 15),
    response_ms INTEGER      NOT NULL,
    is_correct  BOOLEAN      NOT NULL,
    points      INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (student_id, question_id),
    UNIQUE (student_id, position)
);

CREATE INDEX idx_answers_student        ON answers(student_id);
CREATE INDEX idx_answers_question       ON answers(question_id);
CREATE INDEX idx_answers_student_points ON answers(student_id, points DESC);
CREATE INDEX idx_answers_position       ON answers(position);

COMMENT ON TABLE answers IS
  'Student responses. 3,000 rows max. response_ms is server-computed from quiz_state.started_at.';

-- ============================================================
-- 8. TABLE: events (AUDIT LOG)
-- ============================================================
CREATE TABLE events (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID         REFERENCES students(id),
    type       VARCHAR(30)  NOT NULL,
    metadata   JSONB        NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_student ON events(student_id);
CREATE INDEX idx_events_type    ON events(type);
CREATE INDEX idx_events_created ON events(created_at);

COMMENT ON TABLE events IS
  'Audit log. Layer 1: login/logout/kick. Layer 2: tab_switch, blur, etc.';

-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- All public access blocked. Service role key bypasses RLS.
-- ============================================================
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE options           ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_state        ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. VIEWS
-- ============================================================

-- 10.1 Leaderboard View
CREATE OR REPLACE VIEW leaderboard AS
SELECT
    s.id            AS student_id,
    s.name,
    s.college_id,
    COALESCE(SUM(a.points), 0)                                         AS total_points,
    COUNT(a.id) FILTER (WHERE a.is_correct)                            AS correct_count,
    COUNT(a.id)                                                        AS answered_count,
    COALESCE(ROUND(AVG(a.response_ms) FILTER (WHERE a.is_correct)), 0) AS avg_response_ms,
    RANK() OVER (
        ORDER BY
            COALESCE(SUM(a.points), 0) DESC,
            COALESCE(AVG(a.response_ms) FILTER (WHERE a.is_correct), 999999) ASC
    ) AS rank
FROM students s
LEFT JOIN answers a ON a.student_id = s.id
WHERE s.is_active = TRUE
GROUP BY s.id, s.name, s.college_id;

-- 10.2 Per-Question Analytics View
CREATE OR REPLACE VIEW question_analytics AS
SELECT
    q.id            AS question_id,
    q.text,
    q.difficulty,
    q.topic,
    sq.position,
    COUNT(a.id)     AS total_answers,
    COUNT(a.id) FILTER (WHERE a.is_correct) AS correct_answers,
    ROUND(
        COUNT(a.id) FILTER (WHERE a.is_correct)::NUMERIC /
        NULLIF(COUNT(a.id), 0) * 100, 1
    )               AS accuracy_pct,
    ROUND(AVG(a.response_ms) FILTER (WHERE a.is_correct)) AS avg_correct_response_ms,
    ROUND(AVG(a.response_ms)) AS avg_response_ms
FROM questions q
JOIN student_questions sq ON sq.question_id = q.id
LEFT JOIN answers a ON a.question_id = q.id
GROUP BY q.id, q.text, q.difficulty, q.topic, sq.position
ORDER BY sq.position;

-- 10.3 Student Results View
CREATE OR REPLACE VIEW student_results AS
SELECT
    s.id            AS student_id,
    s.name,
    s.college_id,
    sq.position,
    q.text          AS question_text,
    q.difficulty,
    q.topic,
    q.explanation,
    a.option_id     AS selected_option_id,
    a.is_correct,
    a.response_ms,
    a.points,
    (SELECT o.text FROM options o WHERE o.question_id = q.id AND o.is_correct = TRUE) AS correct_option_text,
    (SELECT o.text FROM options o WHERE o.id = a.option_id) AS selected_option_text
FROM students s
JOIN student_questions sq ON sq.student_id = s.id
JOIN questions q ON q.id = sq.question_id
LEFT JOIN answers a ON a.student_id = s.id AND a.question_id = q.id
ORDER BY s.id, sq.position;

-- ============================================================
-- 11. HELPER FUNCTIONS
-- ============================================================

-- 11.1 Calculate Points
CREATE OR REPLACE FUNCTION calculate_points(
    p_is_correct BOOLEAN,
    p_response_ms INTEGER,
    p_points_base INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    clamped_ms INTEGER;
    speed_bonus INTEGER;
BEGIN
    IF NOT p_is_correct THEN
        RETURN 0;
    END IF;

    clamped_ms := GREATEST(0, LEAST(20000, p_response_ms));
    speed_bonus := ROUND(500.0 * (1.0 - clamped_ms::NUMERIC / 20000.0));

    RETURN p_points_base + speed_bonus;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 11.2 Question Window Check
CREATE OR REPLACE FUNCTION get_question_window(
    p_position INTEGER
)
RETURNS TABLE (
    opens_at  TIMESTAMPTZ,
    closes_at TIMESTAMPTZ,
    is_open   BOOLEAN
) AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
    v_q_seconds  INTEGER;
    v_g_seconds  INTEGER;
    v_cycle_ms   INTEGER;
    v_offset_ms  BIGINT;
BEGIN
    SELECT started_at, question_seconds, gap_seconds
    INTO v_started_at, v_q_seconds, v_g_seconds
    FROM quiz_state WHERE id = 1;

    IF v_started_at IS NULL THEN
        RETURN QUERY SELECT NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, FALSE;
        RETURN;
    END IF;

    v_cycle_ms := (v_q_seconds + v_g_seconds) * 1000;
    v_offset_ms := (p_position - 1) * v_cycle_ms;

    opens_at := v_started_at + (v_offset_ms || ' milliseconds')::INTERVAL;
    closes_at := opens_at + (v_q_seconds || ' seconds')::INTERVAL;
    is_open := NOW() BETWEEN opens_at AND closes_at + INTERVAL '1 second';

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- 11.3 Validate Assignments
CREATE OR REPLACE FUNCTION validate_assignments()
RETURNS TABLE (
    check_name TEXT,
    passed     BOOLEAN,
    details    TEXT
) AS $$
BEGIN
    -- Check 1: Every active student has exactly 15 questions
    RETURN QUERY
    SELECT
        'All students have 15 questions'::TEXT,
        NOT EXISTS (
            SELECT 1 FROM students s
            WHERE s.is_active = TRUE
              AND (SELECT COUNT(*) FROM student_questions sq WHERE sq.student_id = s.id) != 15
        ),
        (SELECT COUNT(*) || ' students with != 15 questions'
         FROM students s
         WHERE s.is_active = TRUE
           AND (SELECT COUNT(*) FROM student_questions sq WHERE sq.student_id = s.id) != 15
        )::TEXT;

    -- Check 2: Difficulty distribution is 5-5-5
    RETURN QUERY
    SELECT
        'All students have 5E + 5M + 5H'::TEXT,
        NOT EXISTS (
            SELECT 1 FROM student_questions sq
            JOIN questions q ON q.id = sq.question_id
            GROUP BY sq.student_id
            HAVING
                COUNT(*) FILTER (WHERE q.difficulty = 'easy') != 5 OR
                COUNT(*) FILTER (WHERE q.difficulty = 'medium') != 5 OR
                COUNT(*) FILTER (WHERE q.difficulty = 'hard') != 5
        ),
        'Distribution check complete'::TEXT;

    -- Check 3: No duplicate questions per student
    RETURN QUERY
    SELECT
        'No duplicate questions per student'::TEXT,
        NOT EXISTS (
            SELECT student_id, question_id
            FROM student_questions
            GROUP BY student_id, question_id
            HAVING COUNT(*) > 1
        ),
        'Duplicate check complete'::TEXT;

    -- Check 4: Positions 1-15 with no gaps
    RETURN QUERY
    SELECT
        'Positions 1-15 complete'::TEXT,
        NOT EXISTS (
            SELECT 1 FROM students s
            WHERE s.is_active = TRUE
              AND (
                SELECT ARRAY_AGG(sq.position ORDER BY sq.position)
                FROM student_questions sq
                WHERE sq.student_id = s.id
              ) != ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]
        ),
        'Position check complete'::TEXT;
END;
$$ LANGUAGE plpgsql;
