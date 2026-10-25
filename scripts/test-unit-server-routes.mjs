// scripts/test-unit-server-routes.mjs
// Section 10.1 Unit Tests for SmartLink Git Quiz — Timing, Scoring, Shuffling, and Caching

import assert from 'node:assert';

// ─── 1. Timing Engine Tests ──────────────────────────────────────────
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
    return {
      status: 'waiting',
      currentQuestion: 0,
      phase: 'waiting',
      timeRemainingMs: 0,
      totalElapsedMs: 0,
    };
  }
  if (status === 'finished') {
    return {
      status: 'finished',
      currentQuestion: config.totalQuestions,
      phase: 'finished',
      timeRemainingMs: 0,
      totalElapsedMs: Date.now() - startedAtMs,
    };
  }
  const now = Date.now();
  const elapsed = now - startedAtMs;
  const cycleMs = (config.questionSeconds + config.gapSeconds) * 1000;
  const totalDurationMs = config.totalQuestions * cycleMs;

  if (elapsed >= totalDurationMs) {
    return {
      status: 'finished',
      currentQuestion: config.totalQuestions,
      phase: 'finished',
      timeRemainingMs: 0,
      totalElapsedMs: elapsed,
    };
  }

  const cycleIndex = Math.floor(elapsed / cycleMs);
  const cyclePosition = elapsed % cycleMs;
  const questionNumber = cycleIndex + 1;

  if (cyclePosition < config.questionSeconds * 1000) {
    return {
      status,
      currentQuestion: questionNumber,
      phase: 'answering',
      timeRemainingMs: config.questionSeconds * 1000 - cyclePosition,
      totalElapsedMs: elapsed,
    };
  } else {
    return {
      status,
      currentQuestion: questionNumber,
      phase: 'result',
      timeRemainingMs: cycleMs - cyclePosition,
      totalElapsedMs: elapsed,
    };
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

// ─── 2. Scoring Engine Tests ─────────────────────────────────────────
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

// ─── 3. Shuffling Engine Tests ───────────────────────────────────────
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

// ─── RUN UNIT TESTS ──────────────────────────────────────────────────
console.log('--- Running Timing Engine Tests ---');
const T = 1700000000000;
const w1 = getQuestionWindow(T, 1);
assert.strictEqual(w1.opensAtMs, T, 'Q1 opens at T');
assert.strictEqual(w1.closesAtMs, T + 20000, 'Q1 closes at T+20s');

const w2 = getQuestionWindow(T, 2);
assert.strictEqual(w2.opensAtMs, T + 25000, 'Q2 opens at T+25s');
assert.strictEqual(w2.closesAtMs, T + 45000, 'Q2 closes at T+45s');

const w15 = getQuestionWindow(T, 15);
assert.strictEqual(w15.opensAtMs, T + 350000, 'Q15 opens at T+350s');
assert.strictEqual(w15.closesAtMs, T + 370000, 'Q15 closes at T+370s');

const tValid = validateAnswerTiming(T, 1, T + 10000);
assert.strictEqual(tValid.valid, true, 'Timing at T+10s is valid');
assert.strictEqual(tValid.responseMs, 10000, 'responseMs is 10000');

const tEarly = validateAnswerTiming(T, 1, T - 1000);
assert.strictEqual(tEarly.valid, false, 'Timing at T-1s is invalid');
assert.strictEqual(tEarly.reason, 'Question not yet open.');

const tLate = validateAnswerTiming(T, 1, T + 22000);
assert.strictEqual(tLate.valid, false, 'Timing at T+22s is invalid');
assert.strictEqual(tLate.reason, 'Time expired.');

const tGrace = validateAnswerTiming(T, 1, T + 20500);
assert.strictEqual(tGrace.valid, true, 'Timing at T+20.5s is valid (within grace)');
assert.strictEqual(tGrace.responseMs, 20000, 'Timing within grace clamped to 20000ms');

console.log('✓ All Timing Engine unit tests passed');

console.log('--- Running Scoring Engine Tests ---');
const s0 = computeScore(true, 0);
assert.strictEqual(s0.points, 1500, 'computeScore(true, 0) = 1500');

const s10 = computeScore(true, 10000);
assert.strictEqual(s10.points, 1250, 'computeScore(true, 10000) = 1250');

const s20 = computeScore(true, 20000);
assert.strictEqual(s20.points, 1000, 'computeScore(true, 20000) = 1000');

const sWrong = computeScore(false, 5000);
assert.strictEqual(sWrong.points, 0, 'computeScore(false, 5000) = 0');
assert.strictEqual(sWrong.isCorrect, false);

const sOver = computeScore(true, 25000);
assert.strictEqual(sOver.points, 1000, 'computeScore(true, 25000) = 1000 (clamped)');

const sNeg = computeScore(true, -100);
assert.strictEqual(sNeg.points, 1500, 'computeScore(true, -100) = 1500 (clamped)');

const maxPts = maxPossibleScore();
assert.strictEqual(maxPts, 22500, 'maxPossibleScore() = 22500');

console.log('✓ All Scoring Engine unit tests passed');

console.log('--- Running Shuffling Engine Tests ---');
const options = [
  { id: 'opt-1', text: 'Option 1' },
  { id: 'opt-2', text: 'Option 2' },
  { id: 'opt-3', text: 'Option 3' },
  { id: 'opt-4', text: 'Option 4' },
];

const shuf1 = shuffleOptions(options, 'student-1', 'q-1');
const shuf2 = shuffleOptions(options, 'student-1', 'q-1');
assert.deepStrictEqual(shuf1, shuf2, 'Same student + same question -> same order every time');

const shufDiffStudent = shuffleOptions(options, 'student-2', 'q-1');
assert.notDeepStrictEqual(shuf1, shufDiffStudent, 'Different student + same question -> different order');

const shufDiffQuestion = shuffleOptions(options, 'student-1', 'q-2');
assert.notDeepStrictEqual(shuf1, shufDiffQuestion, 'Same student + different question -> different order');

assert.strictEqual(shuf1.length, 4, 'All 4 options present');
assert.deepStrictEqual(shuf1.map(o => o.label), ['A', 'B', 'C', 'D'], 'Labels are always A, B, C, D');

assert.strictEqual(findOptionIdByLabel(shuf1, 'A'), shuf1[0].id, 'findOptionIdByLabel returns correct ID');
assert.strictEqual(findOptionIdByLabel(shuf1, 'Z'), null, 'findOptionIdByLabel returns null for invalid label');

console.log('✓ All Shuffling Engine unit tests passed');

console.log('\n=============================================');
console.log('ALL SECTION 10.1 UNIT TESTS PASSED (100%)');
console.log('=============================================\n');
