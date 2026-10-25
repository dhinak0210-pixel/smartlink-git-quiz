// scripts/test-server-routes.mjs
// Comprehensive test suite for SmartLink Git Quiz — Server Routes
// Testing:
// 10.1 Unit Tests (Timing, Scoring, Shuffling)
// 10.2 Integration Tests (Full Quiz Flow & Admin Flow)
// 10.3 Load Test (Concurrent Polling & Answering)

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

// ─── Unit Algorithms ──────────────────────────────────────
const DEFAULT_CONFIG = {
  questionSeconds: 20,
  gapSeconds: 5,
  totalQuestions: 15,
  graceMs: 1000,
};

function getQuestionWindow(startedAtMs, position, config = DEFAULT_CONFIG) {
  if (position < 1 || position > config.totalQuestions) {
    throw new Error(`Invalid question position: ${position}`);
  }
  const cycleMs = (config.questionSeconds + config.gapSeconds) * 1000;
  const opensAtMs = startedAtMs + (position - 1) * cycleMs;
  const closesAtMs = opensAtMs + config.questionSeconds * 1000;
  const resultClosesAtMs = closesAtMs + config.gapSeconds * 1000;
  return { position, opensAtMs, closesAtMs, resultClosesAtMs };
}

function getQuizPhase(status, startedAtMs, config = DEFAULT_CONFIG) {
  if (status === 'waiting' || !startedAtMs) {
    return { status: 'waiting', currentQuestion: 0, phase: 'waiting', timeRemainingMs: 0, totalElapsedMs: 0 };
  }
  if (status === 'finished') {
    return { status: 'finished', currentQuestion: config.totalQuestions, phase: 'finished', timeRemainingMs: 0, totalElapsedMs: Date.now() - startedAtMs };
  }
  const now = Date.now();
  const elapsed = now - startedAtMs;
  const cycleMs = (config.questionSeconds + config.gapSeconds) * 1000;
  const totalDurationMs = config.totalQuestions * cycleMs;
  if (elapsed >= totalDurationMs) {
    return { status: 'finished', currentQuestion: config.totalQuestions, phase: 'finished', timeRemainingMs: 0, totalElapsedMs: elapsed };
  }
  const cycleIndex = Math.floor(elapsed / cycleMs);
  const cyclePosition = elapsed % cycleMs;
  const questionNumber = cycleIndex + 1;
  if (cyclePosition < config.questionSeconds * 1000) {
    return { status, currentQuestion: questionNumber, phase: 'answering', timeRemainingMs: config.questionSeconds * 1000 - cyclePosition, totalElapsedMs: elapsed };
  } else {
    return { status, currentQuestion: questionNumber, phase: 'result', timeRemainingMs: cycleMs - cyclePosition, totalElapsedMs: elapsed };
  }
}

function validateAnswerTiming(startedAtMs, position, serverNowMs, config = DEFAULT_CONFIG) {
  const window = getQuestionWindow(startedAtMs, position, config);
  const responseMs = serverNowMs - window.opensAtMs;
  if (serverNowMs < window.opensAtMs) {
    return { valid: false, responseMs: 0, reason: 'Question not yet open.' };
  }
  if (serverNowMs > window.closesAtMs + config.graceMs) {
    return { valid: false, responseMs, reason: 'Time expired.' };
  }
  const clampedMs = Math.max(0, Math.min(config.questionSeconds * 1000, responseMs));
  return { valid: true, responseMs: clampedMs };
}

function computeScore(isCorrect, responseMs, pointsBase = 1000, maxResponseMs = 20000) {
  if (!isCorrect) {
    return { isCorrect: false, points: 0, responseMs, speedBonus: 0 };
  }
  const clamped = Math.max(0, Math.min(maxResponseMs, responseMs));
  const speedBonus = Math.round(500 * (1 - clamped / maxResponseMs));
  const points = pointsBase + speedBonus;
  return { isCorrect: true, points, responseMs, speedBonus };
}

function maxPossibleScore(totalQuestions = 15, pointsBase = 1000, maxSpeedBonus = 500) {
  return totalQuestions * (pointsBase + maxSpeedBonus);
}

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

function shuffleOptions(options, studentId, questionId) {
  const seed = hashString(`${studentId}:${questionId}`);
  const rng = mulberry32(seed);
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const labels = ['A', 'B', 'C', 'D'];
  return shuffled.map((opt, i) => ({
    id: opt.id,
    text: opt.text,
    label: labels[i],
  }));
}

function findOptionIdByLabel(shuffled, label) {
  const found = shuffled.find((o) => o.label === label.toUpperCase());
  return found?.id ?? null;
}

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
    totalPassed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${message}`);
    totalFailed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('SmartLink Git Quiz — Server Routes Test Suite');
  console.log('======================================================\n');

  // ─── 10.1 UNIT TESTS ─────────────────────────────────────
  console.log('--- 10.1 Unit Tests (Timing, Scoring, Shuffling) ---');

  // 1. Timing Engine
  const T = 1700000000000;
  const q1Win = getQuestionWindow(T, 1);
  assert(q1Win.opensAtMs === T && q1Win.closesAtMs === T + 20000, 'getQuestionWindow(1, T) opens at T, closes at T+20s');

  const q2Win = getQuestionWindow(T, 2);
  assert(q2Win.opensAtMs === T + 25000 && q2Win.closesAtMs === T + 45000, 'getQuestionWindow(2, T) opens at T+25s, closes at T+45s');

  const q15Win = getQuestionWindow(T, 15);
  assert(q15Win.opensAtMs === T + 350000 && q15Win.closesAtMs === T + 370000, 'getQuestionWindow(15, T) opens at T+350s, closes at T+370s');

  const valOnTime = validateAnswerTiming(T, 1, T + 10000);
  assert(valOnTime.valid === true && valOnTime.responseMs === 10000, 'validateAnswerTiming at T+10s for Q1 is valid, responseMs=10000');

  const valEarly = validateAnswerTiming(T, 1, T - 1000);
  assert(valEarly.valid === false && valEarly.reason === 'Question not yet open.', 'validateAnswerTiming at T-1s for Q1 is invalid (Question not yet open)');

  const valLate = validateAnswerTiming(T, 1, T + 22000);
  assert(valLate.valid === false && valLate.reason === 'Time expired.', 'validateAnswerTiming at T+22s for Q1 is invalid (Time expired)');

  const valGrace = validateAnswerTiming(T, 1, T + 20500);
  assert(valGrace.valid === true && valGrace.responseMs === 20000, 'validateAnswerTiming at T+20.5s for Q1 is valid within grace (response clamped to 20000)');

  // Quiz phase calculations
  const phaseWait = getQuizPhase('waiting', null);
  assert(phaseWait.status === 'waiting' && phaseWait.phase === 'waiting', 'getQuizPhase(waiting, null) returns waiting phase');

  // 2. Scoring Engine
  const sc1 = computeScore(true, 0);
  assert(sc1.points === 1500 && sc1.speedBonus === 500, 'computeScore(true, 0ms) -> 1500 points (1000 base + 500 bonus)');

  const sc2 = computeScore(true, 10000);
  assert(sc2.points === 1250 && sc2.speedBonus === 250, 'computeScore(true, 10000ms) -> 1250 points');

  const sc3 = computeScore(true, 20000);
  assert(sc3.points === 1000 && sc3.speedBonus === 0, 'computeScore(true, 20000ms) -> 1000 points');

  const sc4 = computeScore(false, 5000);
  assert(sc4.points === 0 && sc4.isCorrect === false, 'computeScore(false, 5000ms) -> 0 points');

  const sc5 = computeScore(true, 25000);
  assert(sc5.points === 1000, 'computeScore(true, 25000ms) -> 1000 points (clamped to maxResponseMs)');

  const sc6 = computeScore(true, -100);
  assert(sc6.points === 1500, 'computeScore(true, -100ms) -> 1500 points (clamped to 0ms)');

  const maxScore = maxPossibleScore();
  assert(maxScore === 22500, 'maxPossibleScore() -> 22,500 (15 × 1500)');

  // 3. Shuffling Engine
  const mockOptions = [
    { id: 'opt-1', text: 'Option 1' },
    { id: 'opt-2', text: 'Option 2' },
    { id: 'opt-3', text: 'Option 3' },
    { id: 'opt-4', text: 'Option 4' },
  ];
  const sId1 = 'student-uuid-1';
  const sId2 = 'student-uuid-2';
  const qId1 = 'question-uuid-1';
  const qId2 = 'question-uuid-2';

  const shufA1 = shuffleOptions(mockOptions, sId1, qId1);
  const shufA2 = shuffleOptions(mockOptions, sId1, qId1);
  assert(JSON.stringify(shufA1) === JSON.stringify(shufA2), 'Same student + same question produces identical order on repeated calls');

  const shufB = shuffleOptions(mockOptions, sId2, qId1);
  assert(JSON.stringify(shufA1) !== JSON.stringify(shufB), 'Different student + same question produces different order');

  const shufC = shuffleOptions(mockOptions, sId1, qId2);
  assert(JSON.stringify(shufA1) !== JSON.stringify(shufC), 'Same student + different question produces different order');

  const labels = shufA1.map((o) => o.label).join('');
  assert(labels === 'ABCD' && shufA1.length === 4, 'Shuffled options always contain all 4 options with labels A, B, C, D');

  const foundOptId = findOptionIdByLabel(shufA1, 'A');
  assert(foundOptId === shufA1[0].id, 'findOptionIdByLabel returns correct option ID');

  // ─── 10.2 INTEGRATION TESTS (Full Quiz & Admin Flow) ────
  console.log('\n--- 10.2 Integration Tests (Full Quiz Flow & Admin Routes) ---');

  // Step 1: Admin logs in
  let adminCookie = '';
  {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin123' }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) adminCookie = setCookie.split(';')[0];
    assert(res.status === 200, 'Admin login succeeded');
  }

  // Step 2: Admin resets quiz to waiting
  {
    const res = await fetch(`${BASE_URL}/api/admin/reset`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const data = await res.json();
    assert(res.status === 200 && data.ok === true, 'POST /api/admin/reset returns 200 and resets state');
  }

  // Step 3: GET /api/state returns waiting
  {
    const res = await fetch(`${BASE_URL}/api/state`);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'waiting' && data.current_question === 0, 'GET /api/state returns status="waiting"');
  }

  // Step 4: Student logs in
  let studentCookie = '';
  {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.55',
      },
      body: JSON.stringify({ college_id: 'CS2024001', join_code: 'baf4jc' }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) studentCookie = setCookie.split(';')[0];
    assert(res.status === 200, 'Student logs in successfully');
  }

  // Step 5: Admin starts the quiz
  {
    const res = await fetch(`${BASE_URL}/api/admin/start`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const data = await res.json();
    assert(res.status === 200 && data.ok === true && !!data.started_at, 'POST /api/admin/start starts quiz (status="running")');
  }

  // Step 6: GET /api/state returns running
  {
    const res = await fetch(`${BASE_URL}/api/state`);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'running' && data.current_question === 1, 'GET /api/state returns status="running" and current_question=1');
  }

  // Step 7: Student fetches Question 1
  let q1Data = null;
  {
    const res = await fetch(`${BASE_URL}/api/question/1`, {
      headers: { Cookie: studentCookie },
    });
    q1Data = await res.json();
    assert(res.status === 200, 'GET /api/question/1 returns 200');
    assert(!!q1Data.text && Array.isArray(q1Data.options) && q1Data.options.length === 4, 'Question 1 has question text and 4 shuffled options');
    assert(q1Data.options[0].is_correct === undefined, 'Question options DO NOT contain is_correct (security check)');
    assert(q1Data.correct_option_id === undefined, 'Question DOES NOT reveal correct_option_id before answering');
  }

  // Step 8: Student fetches Question 2 before it opens -> 403
  {
    const res = await fetch(`${BASE_URL}/api/question/2`, {
      headers: { Cookie: studentCookie },
    });
    assert(res.status === 403, 'GET /api/question/2 before opening returns 403 (Question not yet open)');
  }

  // Step 9: Student submits answer to Q1
  let answerResult = null;
  {
    const selectedOptId = q1Data.options[0].id;
    const res = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        question_position: 1,
        option_id: selectedOptId,
      }),
    });
    answerResult = await res.json();
    assert(res.status === 200, 'POST /api/answer accepts and grades submission');
    assert(typeof answerResult.is_correct === 'boolean', 'Response returns is_correct boolean');
    assert(typeof answerResult.points === 'number' && answerResult.points >= 0, 'Response returns server-computed points');
    assert(!!answerResult.correct_option_id, 'Response reveals correct_option_id after answer submission');
    assert(typeof answerResult.explanation === 'string', 'Response includes explanation');
  }

  // Step 10: Student submits answer to Q1 again -> 409 Conflict
  {
    const selectedOptId = q1Data.options[0].id;
    const res = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        question_position: 1,
        option_id: selectedOptId,
      }),
    });
    assert(res.status === 409, 'Submitting duplicate answer returns 409 Conflict');
  }

  // Step 11: Student submits wrong option_id -> 400
  {
    const res = await fetch(`${BASE_URL}/api/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: studentCookie,
      },
      body: JSON.stringify({
        question_position: 1,
        option_id: 'fake-invalid-option-id-12345',
      }),
    });
    assert(res.status === 400, 'Submitting invalid option_id returns 400 Bad Request');
  }

  // Step 12: GET /api/leaderboard returns ranked scores
  {
    const res = await fetch(`${BASE_URL}/api/leaderboard`, {
      headers: { Cookie: studentCookie },
    });
    const data = await res.json();
    assert(res.status === 200, 'GET /api/leaderboard returns 200');
    assert(Array.isArray(data.top_10) && data.top_10.length > 0, 'Leaderboard returns top_10 array');
    assert(data.my_rank !== null && typeof data.my_points === 'number', 'Leaderboard returns requesting student rank and points');
  }

  // Step 13: Admin pause and resume
  {
    const pauseRes = await fetch(`${BASE_URL}/api/admin/pause`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const pauseData = await pauseRes.json();
    assert(pauseRes.status === 200 && pauseData.status === 'paused', 'POST /api/admin/pause pauses quiz');

    const resumeRes = await fetch(`${BASE_URL}/api/admin/resume`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const resumeData = await resumeRes.json();
    assert(resumeRes.status === 200 && resumeData.status === 'running', 'POST /api/admin/resume resumes quiz');
  }

  // Step 14: Admin next skips to next question
  {
    const nextRes = await fetch(`${BASE_URL}/api/admin/next`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
    });
    const nextData = await nextRes.json();
    assert(nextRes.status === 200 && nextData.current_question === 2, 'POST /api/admin/next advances quiz to Q2');
  }

  // Step 15: Admin stats returns dashboard metrics
  {
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    const statsData = await statsRes.json();
    assert(statsRes.status === 200, 'GET /api/admin/stats returns 200');
    assert(statsData.students_joined >= 1, 'Admin stats reports correct students_joined count');
    assert(Array.isArray(statsData.answers_per_question) && statsData.answers_per_question.length === 15, 'Admin stats has answers_per_question for all 15 positions');
    assert(statsData.total_answers >= 1, 'Admin stats reports recorded answers');
  }

  // Step 16: Student results scorecard
  {
    const resultsRes = await fetch(`${BASE_URL}/api/results`, {
      headers: { Cookie: studentCookie },
    });
    const resultsData = await resultsRes.json();
    assert(resultsRes.status === 200, 'GET /api/results returns 200 scorecard');
    assert(resultsData.name === 'Aarav Sharma' && resultsData.total_questions === 15, 'Scorecard contains student name and total_questions');
    assert(Array.isArray(resultsData.questions) && resultsData.questions.length >= 1, 'Scorecard contains question breakdown');
  }

  // ─── 10.3 LOAD SIMULATION ────────────────────────────────
  console.log('\n--- 10.3 Load Simulation (Concurrent State Polling & Answers) ---');
  {
    // Warm up the endpoint once so JIT compilation is complete
    await fetch(`${BASE_URL}/api/state`);

    console.log('  Simulating 200 concurrent polling requests to GET /api/state...');
    const startPoll = Date.now();
    const pollLatencies = [];
    const pollPromises = Array.from({ length: 200 }, async (_, i) => {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/state`, {
        headers: { 'x-forwarded-for': `10.50.${Math.floor(i / 250)}.${(i % 250) + 1}` },
      });
      pollLatencies.push(Date.now() - t0);
      return res.status;
    });

    const pollStatuses = await Promise.all(pollPromises);
    const totalPollMs = Date.now() - startPoll;
    const okPolls = pollStatuses.filter((s) => s === 200).length;

    pollLatencies.sort((a, b) => a - b);
    const pollP95 = pollLatencies[Math.floor(pollLatencies.length * 0.95)] || 0;

    console.log(`  -> 200 polls completed in ${totalPollMs}ms (p95: ${pollP95}ms, success: ${okPolls}/200)`);
    assert(okPolls === 200, 'All 200 concurrent /api/state polls succeeded with 200 OK');
    assert(pollP95 < 500, `p95 response time for /api/state is < 500ms per Section 10.3 (${pollP95}ms < 500ms)`);
  }

  console.log('\n======================================================');
  console.log(`Results: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('======================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
