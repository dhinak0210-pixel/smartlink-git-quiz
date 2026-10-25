-- =========================================================================
-- SmartLink Git Quiz — Consolidated Production Schema Migration
-- Migration: 20261022190000_full_schema_setup.sql
-- Covers Layers 1, 2, 4, Variants, Auth, Advanced Admin, and Adaptive Practice
-- All statements are strictly idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. Layer 1: Core Tournament & Quiz Tables
-- =========================================================================

-- 1.1 Events Table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('draft', 'waiting', 'active', 'paused', 'ended', 'finished')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Students Table (All core, auth, irt columns)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    register_no TEXT UNIQUE,
    college_id TEXT,
    join_code TEXT,
    join_code_hash TEXT,
    join_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    auth_user_id UUID UNIQUE,
    active_session_id TEXT,
    consent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'registered'
        CHECK (status IN ('registered', 'account_created', 'logged_in', 'playing', 'finished', 'deactivated')),
    display_name_preference TEXT DEFAULT 'full'
        CHECK (display_name_preference IN ('full', 'first_initial')),
    certificate_name_confirmed BOOLEAN DEFAULT FALSE,
    irt_ability_logit REAL DEFAULT 0.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    template_id TEXT,
    variant_id UUID,
    question_number INTEGER,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    difficulty_logit REAL DEFAULT 0.0,
    discrimination REAL DEFAULT 1.0,
    elo_rating REAL DEFAULT 1500.0,
    elo_games INTEGER DEFAULT 0,
    question_text TEXT NOT NULL,
    text TEXT,
    correct_answer_index INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    bank_hash TEXT,
    topic TEXT,
    explanation TEXT,
    points_base INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 Options Table
CREATE TABLE IF NOT EXISTS options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    text TEXT,
    option_index INTEGER NOT NULL DEFAULT 0,
    label CHAR(1) CHECK (label IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 Student Questions (Assignments)
CREATE TABLE IF NOT EXISTS student_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    variant_id UUID,
    position INTEGER,
    option_order JSONB DEFAULT '[]'::jsonb,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.6 Global Quiz State
CREATE TABLE IF NOT EXISTS quiz_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE REFERENCES events(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'active', 'paused', 'ended', 'finished')),
    started_at TIMESTAMPTZ,
    current_question INTEGER NOT NULL DEFAULT 0,
    ended_at TIMESTAMPTZ,
    results_published BOOLEAN NOT NULL DEFAULT FALSE,
    results_published_at TIMESTAMPTZ,
    question_seconds INTEGER DEFAULT 20,
    gap_seconds INTEGER DEFAULT 5,
    total_questions INTEGER DEFAULT 15
);

-- 1.7 Answers Table
CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    selected_option TEXT,
    selected_label CHAR(1),
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    points INTEGER NOT NULL DEFAULT 0,
    response_ms INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tab_switches INTEGER NOT NULL DEFAULT 0,
    visibility_hidden BOOLEAN NOT NULL DEFAULT FALSE
);

-- =========================================================================
-- 2. Layer 2: Anti-Cheat & Tiebreakers
-- =========================================================================

-- 2.1 Flags Table
CREATE TABLE IF NOT EXISTS flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    flag_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence JSONB DEFAULT '{}'::jsonb,
    detector TEXT DEFAULT 'behavior'
        CHECK (detector IN ('person_fit', 'timing', 'pair', 'behavior')),
    tier TEXT DEFAULT 'watch'
        CHECK (tier IN ('strong', 'review', 'watch', 'clear')),
    score_penalty INTEGER DEFAULT 0,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Flag Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_id UUID REFERENCES flags(id) ON DELETE SET NULL,
    reviewer_id UUID,
    decision TEXT NOT NULL CHECK (decision IN ('clear', 'penalize', 'disqualify', 'hold')),
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Student Aggregated Status
CREATE TABLE IF NOT EXISTS student_status (
    student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    trust_score INTEGER NOT NULL DEFAULT 100,
    tier TEXT DEFAULT 'clear' CHECK (tier IN ('strong', 'review', 'watch', 'clear')),
    review_status TEXT DEFAULT 'clear',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 Reserve Questions (Tiebreakers)
CREATE TABLE IF NOT EXISTS reserve_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'hard',
    variant_id UUID,
    topic TEXT,
    explanation TEXT,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 Reserve Options
CREATE TABLE IF NOT EXISTS reserve_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reserve_question_id UUID NOT NULL REFERENCES reserve_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_index INTEGER NOT NULL DEFAULT 0,
    label CHAR(1),
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

-- 2.6 Sudden Death Ties
CREATE TABLE IF NOT EXISTS sudden_death (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    student_ids UUID[] DEFAULT '{}',
    question_id UUID REFERENCES reserve_questions(id),
    answers JSONB DEFAULT '{}'::jsonb,
    winner_id UUID REFERENCES students(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 3. Layer 4: Automation & Certificates
-- =========================================================================

-- 3.1 Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    filename TEXT,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    downloaded_at TIMESTAMPTZ
);

-- 3.2 Results Approval Table
CREATE TABLE IF NOT EXISTS results_approval (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    approved_by TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ranking_snapshot JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- 4. Question Variants Schema
-- =========================================================================

-- 4.1 Templates
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT UNIQUE NOT NULL,
    category TEXT,
    difficulty TEXT NOT NULL,
    source_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.2 Variants
CREATE TABLE IF NOT EXISTS variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
    variant_key TEXT UNIQUE NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer_index INTEGER NOT NULL DEFAULT 0,
    git_commands JSONB DEFAULT '[]'::jsonb,
    validation_status TEXT DEFAULT 'verified',
    bank_hash TEXT
);

-- 4.3 Variant Options
CREATE TABLE IF NOT EXISTS variant_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    option_index INTEGER NOT NULL DEFAULT 0,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

-- 4.4 Variant Assignments
CREATE TABLE IF NOT EXISTS variant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4.5 Bank Freeze
CREATE TABLE IF NOT EXISTS bank_freeze (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bank_hash TEXT NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 0,
    frozen_by TEXT NOT NULL DEFAULT 'pipeline_admin'
);

-- =========================================================================
-- 5. Participant Login Features
-- =========================================================================

-- 5.1 Login Events
CREATE TABLE IF NOT EXISTS login_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    auth_user_id UUID,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'signup_success', 'login_success', 'login_fail_password',
        'login_fail_locked', 'login_fail_not_found', 'session_kicked',
        'password_reset', 'admin_unlock', 'admin_force_logout',
        'admin_deactivate', 'test_login'
    )),
    hashed_ip TEXT,
    device_type TEXT,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 6. Advanced Admin Infrastructure
-- =========================================================================

-- 6.1 Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'co_organizer', 'reviewer', 'help_desk', 'projector')),
    display_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.2 Append-Only Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID,
    actor_id UUID,
    actor_name TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    before_values JSONB DEFAULT '{}'::jsonb,
    after_values JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.3 Approvals (Two-Person Rule)
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    requested_by UUID NOT NULL,
    approved_by UUID,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
    executed_at TIMESTAMPTZ
);

-- 6.4 Event Settings
CREATE TABLE IF NOT EXISTS event_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID UNIQUE NOT NULL,
    values JSONB NOT NULL DEFAULT '{}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    frozen_at TIMESTAMPTZ,
    bank_hash TEXT,
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.5 Pauses
CREATE TABLE IF NOT EXISTS pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    after_question INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    reason TEXT,
    created_by UUID NOT NULL
);

-- 6.6 Question Voids
CREATE TABLE IF NOT EXISTS question_voids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    question_id UUID NOT NULL,
    question_number INTEGER,
    reason TEXT NOT NULL,
    approval_id UUID REFERENCES approvals(id),
    voided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.7 Announcements / Banners
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info'
        CHECK (type IN ('info', 'warning', 'error', 'success')),
    shown_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shown_to TIMESTAMPTZ,
    created_by UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 6.8 Help Desk Actions
CREATE TABLE IF NOT EXISTS helpdesk_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    action TEXT NOT NULL
        CHECK (action IN ('unlock', 'reset_code', 'force_logout', 'resend_code', 'late_join')),
    id_checked BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.9 Student Notes
CREATE TABLE IF NOT EXISTS student_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.10 Flag Decisions
CREATE TABLE IF NOT EXISTS flag_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    flag_ids UUID[] NOT NULL DEFAULT '{}',
    decision TEXT NOT NULL
        CHECK (decision IN ('clear', 'penalize', 'disqualify', 'hold')),
    penalty_points INTEGER DEFAULT 0,
    reason TEXT NOT NULL,
    student_explanation TEXT,
    decided_by UUID NOT NULL,
    approval_id UUID REFERENCES approvals(id),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6.11 Winner Verification
CREATE TABLE IF NOT EXISTS winner_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    ranking JSONB NOT NULL DEFAULT '{}'::jsonb,
    winner_student_id UUID REFERENCES students(id),
    approved_by UUID[] DEFAULT '{}',
    revealed_places INTEGER[] DEFAULT '{}',
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 7. Adaptive Practice Mode
-- =========================================================================

-- 7.1 Practice Ratings
CREATE TABLE IF NOT EXISTS practice_ratings (
    student_id UUID PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    elo_rating REAL NOT NULL DEFAULT 1500.0,
    total_practice_answers INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    last_practice_at TIMESTAMPTZ,
    seeded_from_irt BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7.2 Practice Sessions
CREATE TABLE IF NOT EXISTS practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    questions_answered INTEGER NOT NULL DEFAULT 0,
    questions_correct INTEGER NOT NULL DEFAULT 0,
    elo_start REAL NOT NULL,
    elo_end REAL
);

-- 7.3 Practice Answers
CREATE TABLE IF NOT EXISTS practice_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- =========================================================================
-- 8. Indexes (All 30 Required Indexes)
-- =========================================================================

-- Core Indexes
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_register_no ON students(register_no);
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_questions_event ON questions(event_id);
CREATE INDEX IF NOT EXISTS idx_questions_number ON questions(question_number);
CREATE INDEX IF NOT EXISTS idx_answers_student ON answers(student_id);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_event ON answers(event_id);
CREATE INDEX IF NOT EXISTS idx_student_questions_student ON student_questions(student_id);

-- Anti-Cheat Indexes
CREATE INDEX IF NOT EXISTS idx_flags_student ON flags(student_id);
CREATE INDEX IF NOT EXISTS idx_flags_tier ON flags(tier);
CREATE INDEX IF NOT EXISTS idx_flags_event ON flags(event_id);

-- Login Indexes
CREATE INDEX IF NOT EXISTS idx_login_events_student ON login_events(student_id);
CREATE INDEX IF NOT EXISTS idx_login_events_type ON login_events(event_type);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events(created_at);

-- Admin Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_event ON audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_event ON approvals(event_id);
CREATE INDEX IF NOT EXISTS idx_pauses_event ON pauses(event_id);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(event_id, active);
CREATE INDEX IF NOT EXISTS idx_flag_decisions_student ON flag_decisions(student_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_student ON helpdesk_actions(student_id);

-- Practice Indexes
CREATE INDEX IF NOT EXISTS idx_practice_ratings_student ON practice_ratings(student_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_student ON practice_answers(student_id);
CREATE INDEX IF NOT EXISTS idx_practice_answers_question ON practice_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON practice_sessions(student_id);

-- =========================================================================
-- 9. Row Level Security (RLS) Enforcement
-- =========================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE options ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE sudden_death ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE results_approval ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_freeze ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flag_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_answers ENABLE ROW LEVEL SECURITY;

-- 9.1 Students: Read/update own record
DROP POLICY IF EXISTS "Students read own profile" ON students;
CREATE POLICY "Students read own profile" ON students
    FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Students update own profile" ON students;
CREATE POLICY "Students update own profile" ON students
    FOR UPDATE USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- 9.2 Login Events: Read own login events
DROP POLICY IF EXISTS "Students read own login events" ON login_events;
CREATE POLICY "Students read own login events" ON login_events
    FOR SELECT USING (auth.uid() = auth_user_id);

-- 9.3 Announcements: Read active ones
DROP POLICY IF EXISTS "Students read active announcements" ON announcements;
CREATE POLICY "Students read active announcements" ON announcements
    FOR SELECT USING (active = TRUE AND shown_from <= NOW());

-- 9.4 Practice Ratings: Read/update own
DROP POLICY IF EXISTS "Students read own practice ratings" ON practice_ratings;
CREATE POLICY "Students read own practice ratings" ON practice_ratings
    FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id));

DROP POLICY IF EXISTS "Students update own practice ratings" ON practice_ratings;
CREATE POLICY "Students update own practice ratings" ON practice_ratings
    FOR UPDATE USING (auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id));

-- 9.5 Practice Sessions: Read/insert own
DROP POLICY IF EXISTS "Students read own practice sessions" ON practice_sessions;
CREATE POLICY "Students read own practice sessions" ON practice_sessions
    FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id));

DROP POLICY IF EXISTS "Students insert own practice sessions" ON practice_sessions;
CREATE POLICY "Students insert own practice sessions" ON practice_sessions
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id));

-- 9.6 Practice Answers: Read/insert own
DROP POLICY IF EXISTS "Students read own practice answers" ON practice_answers;
CREATE POLICY "Students read own practice answers" ON practice_answers
    FOR SELECT USING (auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id));

DROP POLICY IF EXISTS "Students insert own practice answers" ON practice_answers;
CREATE POLICY "Students insert own practice answers" ON practice_answers
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT auth_user_id FROM students WHERE id = student_id));

-- 9.7 Admin users: Read own role
DROP POLICY IF EXISTS "Admins read own role" ON admin_users;
CREATE POLICY "Admins read own role" ON admin_users
    FOR SELECT USING (auth.uid() = auth_user_id);

-- 9.8 Audit Log: Read-only for active admins, strictly NO client modifications
DROP POLICY IF EXISTS "Admins read audit log" ON audit_log;
CREATE POLICY "Admins read audit log" ON audit_log
    FOR SELECT USING (EXISTS (SELECT 1 FROM admin_users WHERE auth_user_id = auth.uid() AND active = TRUE));

-- =========================================================================
-- 10. Storage Bucket Setup: Certificates
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificates', 'certificates', false, 10485760, ARRAY['application/pdf', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false;
