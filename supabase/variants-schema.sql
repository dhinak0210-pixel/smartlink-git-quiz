-- Supabase Migration: Question Variants with Execution Validation
-- Extends Layer 1-4 schema with templates, variants, variant_options, variant_assignments, and bank_freeze

-- 1. Question Templates
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    type TEXT NOT NULL DEFAULT 'variant',
    stem_template TEXT NOT NULL,
    setup_commands JSONB NOT NULL DEFAULT '[]'::jsonb,
    goal_predicate TEXT NOT NULL,
    explanation_template TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Variants (Instantiated & Execution-Validated)
CREATE TABLE IF NOT EXISTS variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    variant_index INT NOT NULL,
    stem TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    explanation TEXT,
    status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'pending', 'wrong_key', 'ambiguous', 'leaks_across_variants', 'unsafe_command')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_template_variant_index UNIQUE (template_id, variant_index)
);

-- 3. Variant Options (MCQ Choices for each variant)
CREATE TABLE IF NOT EXISTS variant_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    label TEXT NOT NULL CHECK (label IN ('A', 'B', 'C', 'D')),
    distractor_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_variant_option_label UNIQUE (variant_id, label)
);

-- 4. Variant Assignments (Deterministic student mapping)
CREATE TABLE IF NOT EXISTS variant_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_student_question_assignment UNIQUE (student_id, question_id)
);

-- 5. Bank Freeze (Audit & Tamper Proofing)
CREATE TABLE IF NOT EXISTS bank_freeze (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_hash TEXT NOT NULL UNIQUE,
    git_version TEXT NOT NULL,
    total_templates INT NOT NULL,
    total_variants INT NOT NULL,
    frozen_by TEXT NOT NULL DEFAULT 'pipeline_admin',
    frozen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_variants_template_id ON variants(template_id);
CREATE INDEX IF NOT EXISTS idx_variant_options_variant_id ON variant_options(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_assignments_student ON variant_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_variant_assignments_lookup ON variant_assignments(student_id, question_id);

-- RLS: Security policies
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_freeze ENABLE ROW LEVEL SECURITY;

-- Service role has full access; Students can only query their assigned variant through secure server routes
CREATE POLICY "Service role full access on templates" ON templates
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on variants" ON variants
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on variant_options" ON variant_options
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on variant_assignments" ON variant_assignments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on bank_freeze" ON bank_freeze
    FOR ALL TO service_role USING (true) WITH CHECK (true);
