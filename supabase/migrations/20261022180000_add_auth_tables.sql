-- ============================================================
-- Participant Login: Email + Password via Supabase Auth
-- Replaces the Layer 1 college_id + join_code login
-- ============================================================

-- Add new columns to students table
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS register_no TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS join_code_hash TEXT,
    ADD COLUMN IF NOT EXISTS join_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE,
    ADD COLUMN IF NOT EXISTS active_session_id TEXT,
    ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registered'
        CHECK (status IN (
            'registered',
            'account_created',
            'logged_in',
            'playing',
            'finished',
            'deactivated'
        )),
    ADD COLUMN IF NOT EXISTS display_name_preference TEXT DEFAULT 'full'
        CHECK (display_name_preference IN ('full', 'first_initial')),
    ADD COLUMN IF NOT EXISTS certificate_name_confirmed BOOLEAN DEFAULT FALSE;

-- Login events audit trail
CREATE TABLE IF NOT EXISTS login_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    auth_user_id UUID,
    event_type TEXT NOT NULL
        CHECK (event_type IN (
            'signup_success',
            'login_success',
            'login_fail_password',
            'login_fail_locked',
            'login_fail_not_found',
            'session_kicked',
            'password_reset',
            'admin_unlock',
            'admin_force_logout',
            'admin_deactivate',
            'test_login'
        )),
    hashed_ip TEXT,
    device_type TEXT,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_register_no ON students(register_no);
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON students(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_login_events_student ON login_events(student_id);
CREATE INDEX IF NOT EXISTS idx_login_events_type ON login_events(event_type);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events(created_at);

-- RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- Students can read their own row
CREATE POLICY "Students read own profile"
    ON students FOR SELECT
    USING (auth.uid() = auth_user_id);

-- Students can update their own name (before deadline, enforced in app)
CREATE POLICY "Students update own name"
    ON students FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (auth.uid() = auth_user_id);

-- Login events: students can read their own
CREATE POLICY "Students read own login events"
    ON login_events FOR SELECT
    USING (auth.uid() = auth_user_id);

-- No INSERT/UPDATE/DELETE policies for students on login_events
-- (server inserts via service_role)
