// scripts/generate-assignments.mjs
import fs from 'node:fs';

function fisherYatesShuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateAssignmentsLocal() {
  console.log('Generating 3,000 question assignments for 200 students...');

  const stds = JSON.parse(fs.readFileSync('scripts/data-students.json', 'utf8'));
  const qs = JSON.parse(fs.readFileSync('scripts/data-questions.json', 'utf8'));

  const studentsData = stds.map((s) => ({ id: s.id, name: s.name }));
  const easyQuestions = qs.filter((q) => q.difficulty === 'easy').map((q) => ({ id: q.id }));
  const mediumQuestions = qs.filter((q) => q.difficulty === 'medium').map((q) => ({ id: q.id }));
  const hardQuestions = qs.filter((q) => q.difficulty === 'hard').map((q) => ({ id: q.id }));

  const assignments = [];

  for (const student of studentsData) {
    const e5 = fisherYatesShuffle(easyQuestions).slice(0, 5);
    const m5 = fisherYatesShuffle(mediumQuestions).slice(0, 5);
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
  return assignments;
}

generateAssignmentsLocal();
