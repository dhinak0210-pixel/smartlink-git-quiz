-- =========================================================================
-- SmartLink Git Quiz — Layer 4: Automation & Verification Schema Migration
-- =========================================================================

-- Certificate tracking
CREATE TABLE IF NOT EXISTS certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  college_id TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('winner', 'runner_up', 'second_runner_up', 'top10', 'participant')),
  cert_id TEXT NOT NULL UNIQUE,
  file_token TEXT NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
-- No public policies — service_role only

CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_college_id ON certificates(college_id);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_file_token ON certificates(file_token);

-- Results approval tracking (requires 2 organizer approvals before publishing)
CREATE TABLE IF NOT EXISTS results_approval (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  approved_by TEXT NOT NULL,            -- admin identifier
  approved_at TIMESTAMPTZ DEFAULT now(),
  approval_type TEXT NOT NULL CHECK (approval_type IN ('first', 'second')),
  notes TEXT
);

ALTER TABLE results_approval ENABLE ROW LEVEL SECURITY;

-- Results page publication control on quiz_state
ALTER TABLE quiz_state ADD COLUMN IF NOT EXISTS results_published BOOLEAN DEFAULT false;
ALTER TABLE quiz_state ADD COLUMN IF NOT EXISTS results_published_at TIMESTAMPTZ;
