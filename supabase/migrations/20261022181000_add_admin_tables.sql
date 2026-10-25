-- ============================================================
-- Advanced Admin Features
-- All tables carry event_id for dry-run isolation
-- ============================================================

-- 1. Admin users and roles
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
        'owner', 'co_organizer', 'reviewer', 'help_desk', 'projector'
    )),
    display_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Audit log (APPEND-ONLY — no UPDATE or DELETE policies)
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID NOT NULL,
    actor_id UUID,              -- admin_users.id
    actor_name TEXT,
    action TEXT NOT NULL,       -- e.g., 'start_quiz', 'void_question', 'penalize'
    target_type TEXT,           -- e.g., 'student', 'question', 'settings'
    target_id TEXT,             -- e.g., student_id, question_id
    before_values JSONB DEFAULT '{}',
    after_values JSONB DEFAULT '{}',
    reason TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Two-person approvals
CREATE TABLE IF NOT EXISTS approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    action TEXT NOT NULL,       -- e.g., 'void_question', 'disqualify', 'reveal_winner'
    payload JSONB NOT NULL,     -- all data needed to execute the action
    requested_by UUID NOT NULL, -- admin_users.id
    approved_by UUID,           -- admin_users.id (second organizer)
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
    executed_at TIMESTAMPTZ
);

-- 4. Event settings (versioned, frozen after bank freeze)
CREATE TABLE IF NOT EXISTS event_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL,
    values JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    frozen_at TIMESTAMPTZ,
    bank_hash TEXT,
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Pauses (only between questions)
CREATE TABLE IF NOT EXISTS pauses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    after_question INTEGER NOT NULL,  -- question number (1-indexed)
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,              -- computed on end
    reason TEXT,
    created_by UUID NOT NULL
);

-- 6. Question voids
CREATE TABLE IF NOT EXISTS question_voids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    question_id UUID NOT NULL,
    question_number INTEGER,
    reason TEXT NOT NULL,
    approval_id UUID REFERENCES approvals(id),
    voided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Announcements / broadcast banners
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info'
        CHECK (type IN ('info', 'warning', 'error', 'success')),
    shown_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shown_to TIMESTAMPTZ,
    created_by UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 8. Help desk actions
CREATE TABLE IF NOT EXISTS helpdesk_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    student_id UUID NOT NULL,
    action TEXT NOT NULL
        CHECK (action IN (
            'unlock', 'reset_code', 'force_logout', 'resend_code', 'late_join'
        )),
    id_checked BOOLEAN NOT NULL DEFAULT FALSE,
    note TEXT,
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Per-student notes
CREATE TABLE IF NOT EXISTS student_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    student_id UUID NOT NULL,
    note TEXT NOT NULL,
    actor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Flag decisions (integrity review outcomes)
CREATE TABLE IF NOT EXISTS flag_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    student_id UUID NOT NULL,
    flag_ids UUID[] NOT NULL,       -- which flags this decision covers
    decision TEXT NOT NULL
        CHECK (decision IN ('clear', 'penalize', 'disqualify', 'hold')),
    penalty_points INTEGER DEFAULT 0,
    reason TEXT NOT NULL,
    student_explanation TEXT,       -- what the student said
    decided_by UUID NOT NULL,
    approval_id UUID REFERENCES approvals(id),
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Winner verification
CREATE TABLE IF NOT EXISTS winner_verification (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL,
    ranking JSONB NOT NULL,         -- top 5 with scores, flags resolved
    winner_student_id UUID,
    approved_by UUID[],             -- array of admin_users.id (need 2)
    revealed_places INTEGER[] DEFAULT '{}',  -- e.g., [3, 2, 1]
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
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

-- ============================================================
-- RLS
-- ============================================================
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

-- Admin users can read their own role
CREATE POLICY "Admins read own role"
    ON admin_users FOR SELECT
    USING (auth.uid() = auth_user_id);

-- Audit log: admins can read, nobody can update/delete
CREATE POLICY "Admins read audit log"
    ON audit_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE auth_user_id = auth.uid() AND active = TRUE
        )
    );

-- Announcements: students can read active ones
CREATE POLICY "Students read active announcements"
    ON announcements FOR SELECT
    USING (active = TRUE AND shown_from <= NOW());
