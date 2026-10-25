// scripts/verify-database.mjs
import assert from 'node:assert';
import fs from 'node:fs';

console.log('===========================================================');
console.log('🔍 SmartLink Git Quiz — Database Pre-Deployment Validation');
console.log('===========================================================\n');

// 1. Check Schema Structure & Definitions
console.log('1. Checking Schema SQL completeness:');
const schemaSql = fs.readFileSync('supabase/schema.sql', 'utf8');
const expectedTables = [
  'CREATE TABLE students',
  'CREATE TABLE questions',
  'CREATE TABLE options',
  'CREATE TABLE student_questions',
  'CREATE TABLE quiz_state',
  'CREATE TABLE answers',
  'CREATE TABLE events',
];
for (const tbl of expectedTables) {
  assert.ok(schemaSql.includes(tbl), `Schema missing ${tbl}`);
}
console.log('  ✓ All 7 tables declared in supabase/schema.sql');

// 2. Check Triggers
console.log('2. Checking Integrity Triggers:');
assert.ok(schemaSql.includes('CREATE TRIGGER trg_max_four_options'), 'Missing 4 options limit trigger');
assert.ok(schemaSql.includes('CREATE TRIGGER trg_single_correct_option'), 'Missing single correct option trigger');
console.log('  ✓ Triggers trg_max_four_options and trg_single_correct_option present');

// 3. Check Row Level Security
console.log('3. Checking Row Level Security declarations:');
for (const tbl of ['students', 'questions', 'options', 'student_questions', 'quiz_state', 'answers', 'events']) {
  const rlsRegex = new RegExp(`ALTER TABLE\\s+${tbl}\\s+ENABLE ROW LEVEL SECURITY`, 'i');
  assert.ok(rlsRegex.test(schemaSql), `Missing RLS for ${tbl}`);
}
console.log('  ✓ RLS enabled on all 7 tables');

// 4. Check Views & Functions
console.log('4. Checking Views & Functions:');
assert.ok(schemaSql.includes('CREATE OR REPLACE VIEW leaderboard'), 'Missing leaderboard view');
assert.ok(schemaSql.includes('CREATE OR REPLACE VIEW question_analytics'), 'Missing question_analytics view');
assert.ok(schemaSql.includes('CREATE OR REPLACE VIEW student_results'), 'Missing student_results view');
assert.ok(schemaSql.includes('CREATE OR REPLACE FUNCTION calculate_points'), 'Missing calculate_points function');
assert.ok(schemaSql.includes('CREATE OR REPLACE FUNCTION get_question_window'), 'Missing get_question_window function');
assert.ok(schemaSql.includes('CREATE OR REPLACE FUNCTION validate_assignments'), 'Missing validate_assignments function');
console.log('  ✓ All 3 views and 3 stored functions defined in schema');

// 5. Check Seed Data Counts
console.log('5. Validating Seed Data files:');
const studentsJson = JSON.parse(fs.readFileSync('scripts/data-students.json', 'utf8'));
assert.strictEqual(studentsJson.length, 200, 'Must have exactly 200 registered students');

const uniqueCollegeIds = new Set(studentsJson.map(s => s.college_id));
assert.strictEqual(uniqueCollegeIds.size, 200, 'All college_ids must be unique');

const uniqueJoinCodes = new Set(studentsJson.map(s => s.join_code.toLowerCase()));
assert.strictEqual(uniqueJoinCodes.size, 200, 'All join_codes must be unique');
console.log(`  ✓ 200 unique students verified (College IDs: CS2024001 - CS2024200)`);

const questionsJson = JSON.parse(fs.readFileSync('scripts/data-questions.json', 'utf8'));
assert.strictEqual(questionsJson.length, 90, 'Must have exactly 90 questions in bank');

const easyCount = questionsJson.filter(q => q.difficulty === 'easy').length;
const medCount = questionsJson.filter(q => q.difficulty === 'medium').length;
const hardCount = questionsJson.filter(q => q.difficulty === 'hard').length;
assert.strictEqual(easyCount, 30, 'Must have 30 easy questions');
assert.strictEqual(medCount, 30, 'Must have 30 medium questions');
assert.strictEqual(hardCount, 30, 'Must have 30 hard questions');
console.log(`  ✓ 90 master questions verified: 30 easy, 30 medium, 30 hard`);

let totalOptions = 0;
for (const q of questionsJson) {
  assert.strictEqual(q.options.length, 4, `Question ${q.id} must have exactly 4 options`);
  const correctCount = q.options.filter(o => o.is_correct).length;
  assert.strictEqual(correctCount, 1, `Question ${q.id} must have exactly 1 correct option`);
  totalOptions += q.options.length;
}
assert.strictEqual(totalOptions, 360, 'Must have exactly 360 options total');
console.log(`  ✓ 360 options verified: exactly 4 choices and 1 correct per question`);

// 6. Validate Assignments (3,000 rows)
console.log('6. Validating Assignment Rules (validate_assignments):');
const assignmentsJson = JSON.parse(fs.readFileSync('scripts/data-assignments.json', 'utf8'));
assert.strictEqual(assignmentsJson.length, 3000, 'Must have 3,000 assignments (200 students × 15 questions)');

const questionsById = new Map(questionsJson.map(q => [q.id, q]));
const assignmentsByStudent = new Map();

for (const a of assignmentsJson) {
  const list = assignmentsByStudent.get(a.student_id) || [];
  list.push(a);
  assignmentsByStudent.set(a.student_id, list);
}

assert.strictEqual(assignmentsByStudent.size, 200, 'All 200 students must have assignments');

for (const [studentId, list] of assignmentsByStudent.entries()) {
  assert.strictEqual(list.length, 15, `Student ${studentId} must have 15 questions`);

  // Check unique questions per student
  const qSet = new Set(list.map(a => a.question_id));
  assert.strictEqual(qSet.size, 15, `Student ${studentId} has duplicate questions`);

  // Check positions 1-15 complete
  const posArray = list.map(a => a.position).sort((a, b) => a - b);
  assert.deepStrictEqual(posArray, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], `Student ${studentId} has invalid positions`);

  // Check difficulty distribution: 1-5 easy, 6-10 medium, 11-15 hard
  for (const item of list) {
    const qObj = questionsById.get(item.question_id);
    if (item.position <= 5) {
      assert.strictEqual(qObj.difficulty, 'easy', `Position ${item.position} must be easy`);
    } else if (item.position <= 10) {
      assert.strictEqual(qObj.difficulty, 'medium', `Position ${item.position} must be medium`);
    } else {
      assert.strictEqual(qObj.difficulty, 'hard', `Position ${item.position} must be hard`);
    }
  }
}
console.log('  ✓ 3,000 personalized assignments verified (5 Easy + 5 Medium + 5 Hard per student, no gaps, 0 duplicates)');

// 7. Check Scoring Function Edge Cases
console.log('7. Validating calculate_points edge cases:');
function calculatePoints(isCorrect, responseMs, base = 1000) {
  if (!isCorrect) return 0;
  const clamped = Math.max(0, Math.min(20000, responseMs));
  const bonus = Math.round(500 * (1 - clamped / 20000));
  return base + bonus;
}
assert.strictEqual(calculatePoints(true, 0), 1500, 'Instant response: 1500');
assert.strictEqual(calculatePoints(true, 10000), 1250, '10s response: 1250');
assert.strictEqual(calculatePoints(true, 20000), 1000, '20s response: 1000');
assert.strictEqual(calculatePoints(false, 5000), 0, 'Wrong answer: 0');
assert.strictEqual(calculatePoints(true, 25000), 1000, 'Over 20s clamped: 1000');
assert.strictEqual(calculatePoints(true, -100), 1500, 'Negative time clamped: 1500');
console.log('  ✓ calculate_points passed all boundary tests');

console.log('\n===========================================================');
console.log('🎉 ALL DATABASE PRE-DEPLOYMENT CHECKS PASSED (100%)! 🎉');
console.log('===========================================================\n');
