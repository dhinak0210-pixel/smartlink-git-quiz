-- ============================================================
-- Adaptive Practice Mode Tables
-- PRACTICE ONLY — never affects competition scores or leaderboard
-- ============================================================

-- Student Elo ratings for practice
CREATE TABLE IF NOT EXISTS practice_ratings (
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    elo_rating REAL NOT NULL DEFAULT 1500.0,
    total_practice_answers INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    last_practice_at TIMESTAMPTZ,
    seeded_from_irt BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (student_id)
);

-- Practice sessions (each time a student opens practice mode)
CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    questions_answered INTEGER NOT NULL DEFAULT 0,
    questions_correct INTEGER NOT NULL DEFAULT 0,
    elo_start REAL NOT NULL,
    elo_end REAL
);

-- Individual practice answers
CREATE TABLE IF NOT EXISTS practice_answers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES practice_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    is_correct BOOLEAN NOT NULL,
    response_ms INTEGER NOT NULL,
    student_elo_before REAL NOT NULL,
    student_elo_after REAL NOT NULL,
    question_elo_before REAL NOT NULL,
    question_elo_after REAL NOT NULL,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add Elo rating column to questions table (seeded from IRT)
ALTER TABLE questions
    ADD COLUMN IF NOT EXISTS elo_rating REAL DEFAULT 1500.0,
    ADD COLUMN IF NOT EXISTS elo_games INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_practice_ratings_student ON practice_ratings(student_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_student ON practice_answers(student_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_question ON practice_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON practice_sessions(student_id);

-- RLS (same pattern as all other tables: enabled, no public policies)
ALTER TABLE practice_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;
-- No public policies — only service_role key used server-side
