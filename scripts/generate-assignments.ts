// scripts/generate-assignments.ts
// Run ONCE before the event: npx tsx scripts/generate-assignments.ts (or node scripts/generate-assignments.mjs)
// Creates 3,000 personalized assignments in student_questions table.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function generateAssignments() {
  console.log('Generating 3,000 question assignments for 200 students...');

  // Load from Supabase if configured, or fallback to generated data assets
  let studentsData: { id: string; name: string }[] = [];
  let easyQuestions: { id: string }[] = [];
  let mediumQuestions: { id: string }[] = [];
  let hardQuestions: { id: string }[] = [];

  const isConfigured = !SUPABASE_URL.includes('placeholder') && !SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');

  if (isConfigured) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: stds, error: sErr } = await supabase
      .from('students')
      .select('id, name')
      .eq('is_active', true);
    if (sErr || !stds) throw sErr;
    studentsData = stds;

    const fetchByDiff = async (diff: string) => {
      const { data, error } = await supabase
        .from('questions')
        .select('id')
        .eq('difficulty', diff)
        .eq('is_active', true);
      if (error || !data || data.length < 30) throw new Error(`Need 30+ ${diff} questions, got ${data?.length || 0}`);
      return data;
    };

    easyQuestions = await fetchByDiff('easy');
    mediumQuestions = await fetchByDiff('medium');
    hardQuestions = await fetchByDiff('hard');
  } else {
    // Local data assets fallback
    const stds = JSON.parse(fs.readFileSync('scripts/data-students.json', 'utf8'));
    const qs = JSON.parse(fs.readFileSync('scripts/data-questions.json', 'utf8'));
    studentsData = stds.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name }));
    easyQuestions = qs.filter((q: { difficulty: string }) => q.difficulty === 'easy').map((q: { id: string }) => ({ id: q.id }));
    mediumQuestions = qs.filter((q: { difficulty: string }) => q.difficulty === 'medium').map((q: { id: string }) => ({ id: q.id }));
    hardQuestions = qs.filter((q: { difficulty: string }) => q.difficulty === 'hard').map((q: { id: string }) => ({ id: q.id }));
  }

  const assignments: { student_id: string; question_id: string; position: number }[] = [];

  for (const student of studentsData) {
    // 5 Easy (from 30 pool)
    const e5 = fisherYatesShuffle(easyQuestions).slice(0, 5);
    // 5 Medium (from 30 pool)
    const m5 = fisherYatesShuffle(mediumQuestions).slice(0, 5);
    // 5 Hard (from 30 pool)
    const h5 = fisherYatesShuffle(hardQuestions).slice(0, 5);

    const ordered = [
      ...fisherYatesShuffle(e5).map((q, i) => ({ question_id: q.id, position: i + 1 })),
      ...fisherYatesShuffle(m5).map((q, i) => ({ question_id: q.id, position: i + 6 })),
      ...fisherYatesShuffle(h5).map((q, i) => ({ question_id: q.id, position: i + 11 })),
    ];

    for (const item of ordered) {
      assignments.push({ student_id: student.id, ...item });
    }
  }

  // Save generated assignments to JSON and SQL script for offline insertion
  fs.writeFileSync('scripts/data-assignments.json', JSON.stringify(assignments, null, 2));

  const assignmentSql = `-- ============================================================
-- SmartLink Git Quiz — Student Question Assignments (3,000 Rows)
-- Generated: ${new Date().toISOString()}
-- ============================================================
DELETE FROM student_questions;

INSERT INTO student_questions (student_id, question_id, position) VALUES
${assignments.map(a => `('${a.student_id}', '${a.question_id}', ${a.position})`).join(',\n')};
`;
  fs.writeFileSync('scripts/seed-assignments.sql', assignmentSql);
  console.log(`✓ Generated ${assignments.length} assignments in scripts/seed-assignments.sql`);

  if (isConfigured) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    await supabase.from('student_questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const BATCH = 500;
    for (let i = 0; i < assignments.length; i += BATCH) {
      const chunk = assignments.slice(i, i + BATCH);
      const { error } = await supabase.from('student_questions').insert(chunk);
      if (error) throw error;
      console.log(`Uploaded to Supabase: ${Math.min(i + BATCH, assignments.length)} / ${assignments.length}`);
    }

    const { data: validation } = await supabase.rpc('validate_assignments');
    console.log('\nSupabase RPC Validation Results:');
    console.table(validation);
  }
}

if (process.argv[1]?.includes('generate-assignments')) {
  generateAssignments().catch(console.error);
}
