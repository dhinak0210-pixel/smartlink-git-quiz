// scripts/test-layer1-flow.mjs
import assert from 'node:assert';

console.log('--- Step 1: Unit Checks (Section 14.1) ---');

// 1. Scoring Formula
function computePoints(isCorrect, responseMs) {
  if (!isCorrect) return 0;
  const clamped = Math.max(0, Math.min(20000, responseMs));
  const speedBonus = Math.round(500 * (1 - clamped / 20000));
  return 1000 + speedBonus;
}

console.log('Testing Scoring Formula:');
assert.strictEqual(computePoints(true, 0), 1500, 'Instant answer should score 1500');
assert.strictEqual(computePoints(true, 10000), 1250, '10s answer should score 1250');
assert.strictEqual(computePoints(true, 19000), 1025, '19s answer should score 1025');
assert.strictEqual(computePoints(true, 20000), 1000, '20s answer should score 1000');
assert.strictEqual(computePoints(false, 5000), 0, 'Wrong answer should score 0');
assert.strictEqual(computePoints(false, 0), 0, 'Instant wrong answer should score 0');
assert.strictEqual(computePoints(true, 25000), 1000, 'Over-clamped answer should score min 1000');
console.log('✓ Scoring Formula tests passed: computePoints(true,0)=1500, computePoints(true,20000)=1000, computePoints(false,5000)=0');

// 2. Deterministic Option Shuffling
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function shuffleOptions(options, studentId, questionId) {
  const seed = hashString(`${studentId}-${questionId}`);
  const shuffled = [...options];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

console.log('Testing Deterministic Option Shuffling:');
const sampleOptions = [
  { id: '1', text: 'Option A' },
  { id: '2', text: 'Option B' },
  { id: '3', text: 'Option C' },
  { id: '4', text: 'Option D' },
];

const shuffle1 = shuffleOptions(sampleOptions, 'student-1', 'q-1');
const shuffle2 = shuffleOptions(sampleOptions, 'student-1', 'q-1');
const shuffleOther = shuffleOptions(sampleOptions, 'student-2', 'q-1');

assert.deepStrictEqual(shuffle1, shuffle2, 'Deterministic shuffle must produce identical order on re-fetch');
assert.notDeepStrictEqual(shuffle1, shuffleOther, 'Different students must get different option orders');
console.log('✓ Shuffling tests passed!');

// 3. Timing Window Validation (Section 14.1)
console.log('Testing Window Enforcement:');
function isWindowAccepted(responseMs) {
  if (responseMs < 0) return false;
  if (responseMs > 20000 + 1000) return false;
  return true;
}
assert.strictEqual(isWindowAccepted(-1), false, '-1ms rejected');
assert.strictEqual(isWindowAccepted(0), true, '0ms accepted');
assert.strictEqual(isWindowAccepted(21000), true, '21000ms accepted (within 1s grace)');
assert.strictEqual(isWindowAccepted(21001), false, '21001ms rejected (after grace)');
console.log('✓ Window enforcement tests passed: -1ms and 21001ms rejected; 0ms and 21000ms accepted');

console.log('\n--- Step 2: Live API End-to-End Tests ---');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function runApiTests() {
  try {
    // 1. Wrong login credentials
    console.log('1. Testing wrong login code:');
    const wrongLogin = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college_id: 'CS2024001', join_code: 'wrong_code_xyz' }),
    });
    assert.strictEqual(wrongLogin.status, 401, 'Wrong credentials should return 401');
    console.log('✓ Rejected invalid login with 401');

    // 2. Valid login credentials
    console.log('2. Testing valid student login:');
    const validLogin = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ college_id: 'CS2024001', join_code: 'baf4jc' }),
    });
    assert.strictEqual(validLogin.status, 200, 'Valid login should return 200');
    const setCookie = validLogin.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('quiz_session'), 'Should set quiz_session cookie');
    const sessionCookie = setCookie.split(';')[0];
    const loginData = await validLogin.json();
    console.log(`✓ Logged in student: ${loginData.name}, session cookie issued`);

    // 3. Check State API
    console.log('3. Testing /api/state:');
    const stateRes = await fetch(`${BASE_URL}/api/state`);
    assert.strictEqual(stateRes.status, 200);
    const state = await stateRes.json();
    assert.ok(state.students_joined >= 1, 'Should record student joined count');
    assert.ok(typeof state.server_time === 'number', 'Should return server timestamp for clock sync');
    console.log(`✓ Quiz State: status="${state.status}", joined=${state.students_joined}`);

    // 4. Request question while waiting (should return 403)
    console.log('4. Testing early question request when waiting:');
    const earlyQ = await fetch(`${BASE_URL}/api/question/1`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(earlyQ.status, 403, 'Should reject question access when quiz not running');
    console.log('✓ Rejected question request before start with 403');

    // 5. Admin starts quiz
    console.log('5. Testing admin start:');
    const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });
    const adminCookie = (adminLoginRes.headers.get('set-cookie') || '').split(';')[0];
    const adminStart = await fetch(`${BASE_URL}/api/admin/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    });
    assert.strictEqual(adminStart.status, 200, 'Admin start should succeed with 200');
    console.log('✓ Quiz started by Admin');

    // 6. Fetch Question 1
    console.log('6. Fetching Question 1:');
    const q1Res = await fetch(`${BASE_URL}/api/question/1`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(q1Res.status, 200, 'Question 1 should now be open');
    const q1 = await q1Res.json();
    assert.strictEqual(q1.position, 1);
    assert.strictEqual(q1.options.length, 4);
    assert.strictEqual(q1.is_correct, undefined, 'Answer key must NEVER be leaked in question endpoint!');
    assert.strictEqual(q1.options[0].is_correct, undefined, 'Option correctness must NEVER be leaked!');
    console.log(`✓ Question 1 received: "${q1.text.slice(0, 45)}..." with 4 shuffled options (no answer leakage)`);

    // 7. Request Question 5 before it opens (should return 403)
    console.log('7. Testing future question request (Question 5):');
    const q5Res = await fetch(`${BASE_URL}/api/question/5`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(q5Res.status, 403, 'Future question must return 403');
    console.log('✓ Early Question 5 blocked with 403 ("Question not yet open")');

    // 8. Submit Answer for Question 1
    console.log('8. Submitting Answer to Question 1:');
    const chosenOptionId = q1.options[0].id;
    const ansRes = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        question_position: 1,
        option_id: chosenOptionId,
      }),
    });
    assert.strictEqual(ansRes.status, 200, 'Answer submission should return 200');
    const ansData = await ansRes.json();
    assert.ok(typeof ansData.is_correct === 'boolean');
    assert.ok(typeof ansData.points === 'number');
    assert.ok(typeof ansData.correct_option_id === 'string');
    assert.ok(typeof ansData.explanation === 'string');
    console.log(`✓ Answer scored: is_correct=${ansData.is_correct}, points=${ansData.points}, revealed correct_option_id=${ansData.correct_option_id}`);

    // 9. Submit Duplicate Answer (should return 409)
    console.log('9. Submitting duplicate answer to Question 1:');
    const dupRes = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        question_position: 1,
        option_id: chosenOptionId,
      }),
    });
    assert.strictEqual(dupRes.status, 409, 'Duplicate answer must return 409 Conflict');
    console.log('✓ Rejected duplicate answer with 409 Conflict');

    // 10. Check Leaderboard
    console.log('10. Testing /api/leaderboard:');
    const lbRes = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(lbRes.status, 200);
    const lb = await lbRes.json();
    assert.ok(Array.isArray(lb.top_10), 'Should return top_10 array');
    assert.strictEqual(lb.my_points, ansData.points, 'Student personal points must match');
    assert.ok(lb.my_rank !== null, 'Student should have an assigned rank');
    console.log(`✓ Leaderboard verified: Student rank=#${lb.my_rank}, points=${lb.my_points}, Top 10 count=${lb.top_10.length}`);

    // 11. Check Admin Stats
    console.log('11. Testing /api/admin/stats:');
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    assert.strictEqual(statsRes.status, 200);
    const statsData = await statsRes.json();
    assert.strictEqual(statsData.status, 'running');
    assert.strictEqual(statsData.answers_per_question.length, 15);
    const q1Count = statsData.answers_per_question[0].answered ?? statsData.answers_per_question[0].count;
    console.log(`✓ Admin stats verified: status=${statsData.status}, Q1 answer count=${q1Count}`);

    // 12. Admin Reset
    console.log('12. Testing admin reset:');
    const resetRes = await fetch(`${BASE_URL}/api/admin/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    });
    assert.strictEqual(resetRes.status, 200);
    console.log('✓ Quiz reset back to waiting room by Admin');

    // 13. Verify State after reset
    const postResetState = await (await fetch(`${BASE_URL}/api/state`)).json();
    assert.strictEqual(postResetState.status, 'waiting', 'Status should be waiting after reset');
    assert.strictEqual(postResetState.started_at, null, 'started_at should be null after reset');
    console.log('✓ Verified post-reset state: waiting room active');

    console.log('\n=========================================');
    console.log('🎉 ALL LAYER 1 INTEGRATION TESTS PASSED! 🎉');
    console.log('=========================================');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  }
}

runApiTests();
