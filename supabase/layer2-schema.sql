-- ============================================================
-- LAYER 2: ANTI-CHEATING & WINNER SELECTION
-- Run this AFTER the Layer 1 schema is deployed.
-- ============================================================

-- ============================================================
-- TABLE: flags
-- Statistical and behavioral flags computed per student.
-- Populated: After the quiz ends, by the flag computation script.
-- Each flag has a type, evidence (JSON), and a suggested penalty.
-- NO automatic action is taken — flags are for admin review.
-- ============================================================
CREATE TABLE IF NOT EXISTS flags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    flag_type     VARCHAR(40) NOT NULL,
    severity      VARCHAR(10) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    evidence      JSONB NOT NULL DEFAULT '{}',
    score_penalty INTEGER NOT NULL DEFAULT 0,
    is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flags_student ON flags(student_id);
CREATE INDEX IF NOT EXISTS idx_flags_type    ON flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_flags_severity ON flags(severity) WHERE is_resolved = FALSE;

COMMENT ON TABLE flags IS 'Behavioral and statistical flags. Computed post-quiz. No automatic action.';
COMMENT ON COLUMN flags.flag_type IS 'One of: tab_switch, superhuman_speed, hard_right_easy_wrong, identical_wrong_answers, synchronized_timing, heavy_tab_switching, suspicious_login, second_login';
COMMENT ON COLUMN flags.evidence IS 'JSON with flag-specific data. e.g., {"questions": [3,7,12], "avg_response_ms": 1200} for superhuman_speed';
COMMENT ON COLUMN flags.score_penalty IS 'Suggested point deduction. Admin can override during review.';

-- ============================================================
-- TABLE: reviews
-- Admin decisions on flagged students.
-- Every decision is audited: who decided, when, and why.
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    flag_id     UUID REFERENCES flags(id) ON DELETE SET NULL,
    admin_name  VARCHAR(100) NOT NULL,
    decision    VARCHAR(20) NOT NULL CHECK (decision IN ('clear', 'penalize', 'disqualify')),
    penalty     INTEGER NOT NULL DEFAULT 0,
    reason      TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_student ON reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_reviews_flag    ON reviews(flag_id);

COMMENT ON TABLE reviews IS 'Admin review decisions. Every flag resolution is recorded here with who, what, and why.';
COMMENT ON COLUMN reviews.decision IS 'clear = no action, penalize = deduct points, disqualify = remove from ranking';
COMMENT ON COLUMN reviews.penalty IS 'Actual points deducted (may differ from flag suggestion). 0 for clear/disqualify.';

-- ============================================================
-- TABLE: student_status
-- Aggregated trust score and status per student.
-- Computed from flags and reviews.
-- ============================================================
CREATE TABLE IF NOT EXISTS student_status (
    student_id   UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    trust_score  INTEGER NOT NULL DEFAULT 100 CHECK (trust_score BETWEEN 0 AND 100),
    status       VARCHAR(20) NOT NULL DEFAULT 'clear'
                   CHECK (status IN ('clear', 'review', 'held', 'disqualified')),
    total_penalty INTEGER NOT NULL DEFAULT 0,
    flags_count  INTEGER NOT NULL DEFAULT 0,
    reviewed_at  TIMESTAMPTZ,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE student_status IS 'Per-student trust score and review status. Computed after flags, updated after reviews.';
COMMENT ON COLUMN student_status.trust_score IS '100 = fully trusted, 0 = maximum suspicion. Thresholds: 70+ clear, 40-69 review, <40 held.';
COMMENT ON COLUMN student_status.status IS 'clear = no issues, review = needs human look, held = blocked from winner until reviewed, disqualified = admin decision';

-- ============================================================
-- TABLE: reserve_questions
-- Hidden question bank for sudden-death tiebreakers.
-- NEVER part of the main quiz. Students never see these
-- until a sudden-death round is triggered.
-- ============================================================
CREATE TABLE IF NOT EXISTS reserve_questions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text        TEXT NOT NULL,
    difficulty  VARCHAR(10) NOT NULL DEFAULT 'hard' CHECK (difficulty IN ('medium', 'hard')),
    topic       VARCHAR(50) NOT NULL,
    explanation TEXT NOT NULL,
    is_used     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: reserve_options
-- 4 options per reserve question. Exactly 1 correct.
-- ============================================================
CREATE TABLE IF NOT EXISTS reserve_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES reserve_questions(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    label       CHAR(1) NOT NULL CHECK (label IN ('A', 'B', 'C', 'D'))
);

CREATE INDEX IF NOT EXISTS idx_reserve_options_question ON reserve_options(question_id);

-- ============================================================
-- TABLE: sudden_death
-- Records sudden-death rounds and answers.
-- ============================================================
CREATE TABLE IF NOT EXISTS sudden_death (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round       INTEGER NOT NULL DEFAULT 1,
    question_id UUID NOT NULL REFERENCES reserve_questions(id),
    student_id  UUID NOT NULL REFERENCES students(id),
    option_id   UUID NOT NULL REFERENCES reserve_options(id),
    is_correct  BOOLEAN NOT NULL,
    response_ms INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (round, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sudden_death_round ON sudden_death(round);

-- ============================================================
-- TABLE: winner_verification
-- Audit trail for the entire winner verification process.
-- ============================================================
CREATE TABLE IF NOT EXISTS winner_verification (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step            VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'completed', 'overridden')),
    admin_name      VARCHAR(100),
    details         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

COMMENT ON TABLE winner_verification IS 'Audit trail for the 8-step winner verification workflow.';

-- ============================================================
-- RLS for new tables
-- ============================================================
ALTER TABLE flags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_options    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sudden_death       ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_verification ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VIEW: flagged_students
-- Students with unresolved flags, sorted by trust score.
-- Used by the admin review page.
-- ============================================================
CREATE OR REPLACE VIEW flagged_students AS
SELECT
    s.id AS student_id,
    s.name,
    s.college_id,
    COALESCE(ss.trust_score, 100) AS trust_score,
    COALESCE(ss.status, 'clear') AS status,
    COALESCE(ss.total_penalty, 0) AS total_penalty,
    COUNT(f.id) FILTER (WHERE NOT f.is_resolved) AS unresolved_flags,
    ARRAY_AGG(f.flag_type) FILTER (WHERE NOT f.is_resolved) AS flag_types,
    lb.total_points,
    lb.rank AS original_rank,
    lb.total_points - COALESCE(ss.total_penalty, 0) AS adjusted_score
FROM students s
LEFT JOIN student_status ss ON ss.student_id = s.id
LEFT JOIN flags f ON f.student_id = s.id
LEFT JOIN leaderboard lb ON lb.student_id = s.id
WHERE s.is_active = TRUE
GROUP BY s.id, s.name, s.college_id, ss.trust_score, ss.status,
         ss.total_penalty, lb.total_points, lb.rank
HAVING COUNT(f.id) FILTER (WHERE NOT f.is_resolved) > 0
    OR COALESCE(ss.status, 'clear') IN ('review', 'held', 'disqualified')
ORDER BY COALESCE(ss.trust_score, 100) ASC;

-- ============================================================
-- VIEW: verified_leaderboard
-- Final leaderboard after penalties and disqualifications.
-- Only includes students who are not disqualified.
-- ============================================================
CREATE OR REPLACE VIEW verified_leaderboard AS
SELECT
    s.id AS student_id,
    s.name,
    s.college_id,
    lb.total_points AS original_score,
    COALESCE(ss.total_penalty, 0) AS penalty,
    lb.total_points - COALESCE(ss.total_penalty, 0) AS final_score,
    lb.correct_count,
    lb.avg_response_ms,
    COALESCE(ss.status, 'clear') AS status,
    RANK() OVER (
        ORDER BY
            lb.total_points - COALESCE(ss.total_penalty, 0) DESC,
            lb.correct_count DESC,
            lb.avg_response_ms ASC
    ) AS final_rank
FROM students s
JOIN leaderboard lb ON lb.student_id = s.id
LEFT JOIN student_status ss ON ss.student_id = s.id
WHERE s.is_active = TRUE
  AND COALESCE(ss.status, 'clear') != 'disqualified'
ORDER BY final_rank;

-- ============================================================
-- FUNCTION: compute_trust_score
-- Calculates the trust score for a single student.
-- Starts at 100, deducts for each flag/event.
-- ============================================================
CREATE OR REPLACE FUNCTION compute_trust_score(p_student_id UUID)
RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 100;
    tab_switches INTEGER;
    flag_record RECORD;
BEGIN
    -- Deduct for tab switches (after the first, which is a warning)
    SELECT COUNT(*) INTO tab_switches
    FROM events
    WHERE student_id = p_student_id
      AND type = 'tab_switch';

    IF tab_switches > 1 THEN
        score := score - (tab_switches - 1) * 10;
    END IF;

    -- Deduct for each unresolved flag
    FOR flag_record IN
        SELECT flag_type, score_penalty
        FROM flags
        WHERE student_id = p_student_id
          AND NOT is_resolved
    LOOP
        CASE flag_record.flag_type
            WHEN 'superhuman_speed' THEN
                score := score - 20;
            WHEN 'identical_wrong_answers' THEN
                score := score - 30;
            WHEN 'synchronized_timing' THEN
                score := score - 30;
            WHEN 'hard_right_easy_wrong' THEN
                score := score - 20;
            WHEN 'heavy_tab_switching' THEN
                score := score - 15;
            WHEN 'suspicious_login' THEN
                score := score - 10;
            WHEN 'second_login' THEN
                score := score - 10;
            ELSE
                score := score - 5;
        END CASE;
    END LOOP;

    -- Clamp to [0, 100]
    RETURN GREATEST(0, LEAST(100, score));
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: compute_all_trust_scores
-- Batch-compute trust scores for all active students.
-- Run after flag computation, before admin review.
-- ============================================================
CREATE OR REPLACE FUNCTION compute_all_trust_scores()
RETURNS TABLE (
    student_id UUID,
    trust_score INTEGER,
    status VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        compute_trust_score(s.id),
        CASE
            WHEN compute_trust_score(s.id) >= 70 THEN 'clear'
            WHEN compute_trust_score(s.id) >= 40 THEN 'review'
            ELSE 'held'
        END
    FROM students s
    WHERE s.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: apply_review_decision
-- Apply an admin's review decision and update student_status.
-- ============================================================
CREATE OR REPLACE FUNCTION apply_review_decision(
    p_student_id UUID,
    p_admin_name VARCHAR,
    p_decision VARCHAR,
    p_penalty INTEGER,
    p_reason TEXT,
    p_flag_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_new_status VARCHAR;
    v_new_penalty INTEGER;
BEGIN
    -- 1. Insert the review record
    INSERT INTO reviews (student_id, flag_id, admin_name, decision, penalty, reason)
    VALUES (p_student_id, p_flag_id, p_admin_name, p_decision, p_penalty, p_reason);

    -- 2. Mark the flag as resolved (if linked to a specific flag)
    IF p_flag_id IS NOT NULL THEN
        UPDATE flags SET is_resolved = TRUE WHERE id = p_flag_id;
    END IF;

    -- 3. Determine new status
    IF p_decision = 'disqualify' THEN
        v_new_status := 'disqualified';
        v_new_penalty := 0; -- Score doesn't matter for disqualified
    ELSIF p_decision = 'penalize' THEN
        v_new_status := 'clear'; -- Penalized but cleared
        v_new_penalty := p_penalty;
    ELSE
        v_new_status := 'clear';
        v_new_penalty := 0;
    END IF;

    -- 4. Upsert student_status
    INSERT INTO student_status (student_id, trust_score, status, total_penalty)
    VALUES (
        p_student_id,
        compute_trust_score(p_student_id),
        v_new_status,
        v_new_penalty
    )
    ON CONFLICT (student_id) DO UPDATE SET
        status = v_new_status,
        total_penalty = student_status.total_penalty + v_new_penalty,
        reviewed_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
