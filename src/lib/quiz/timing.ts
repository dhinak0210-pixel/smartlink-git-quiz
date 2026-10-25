// src/lib/quiz/timing.ts
// The single source of truth for all quiz timing calculations.

export interface QuizTimingConfig {
  questionSeconds: number;  // Default: 20
  gapSeconds: number;       // Default: 5
  totalQuestions: number;   // Default: 15
  graceMs: number;          // Default: 1000 (1 second grace for network lag)
}

export interface QuestionWindow {
  position: number;
  opensAtMs: number;       // Unix timestamp (ms)
  closesAtMs: number;      // Unix timestamp (ms)
  resultClosesAtMs: number; // closesAtMs + gapSeconds (end of result screen)
}

export interface QuizPhase {
  status: 'waiting' | 'running' | 'paused' | 'finished';
  currentQuestion: number;    // 1-15, or 0 if waiting
  phase: 'answering' | 'result' | 'gap' | 'waiting' | 'finished';
  timeRemainingMs: number;    // ms left in current phase
  totalElapsedMs: number;     // ms since started_at
}

export const DEFAULT_CONFIG: QuizTimingConfig = {
  questionSeconds: 20,
  gapSeconds: 5,
  totalQuestions: 15,
  graceMs: 1000,
};

/**
 * Compute the absolute time window for question N.
 * All timestamps are Unix milliseconds.
 */
export function getQuestionWindow(
  startedAtMs: number,
  position: number,
  config: QuizTimingConfig = DEFAULT_CONFIG
): QuestionWindow {
  if (position < 1 || position > config.totalQuestions) {
    throw new Error(`Invalid question position: ${position}`);
  }

  const cycleMs = (config.questionSeconds + config.gapSeconds) * 1000;
  const opensAtMs = startedAtMs + (position - 1) * cycleMs;
  const closesAtMs = opensAtMs + config.questionSeconds * 1000;
  const resultClosesAtMs = closesAtMs + config.gapSeconds * 1000;

  return { position, opensAtMs, closesAtMs, resultClosesAtMs };
}

/**
 * Determine the current quiz phase based on the server clock.
 */
export function getQuizPhase(
  status: string,
  startedAtMs: number | null,
  config: QuizTimingConfig = DEFAULT_CONFIG
): QuizPhase {
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
      status: status as 'running' | 'paused',
      currentQuestion: questionNumber,
      phase: 'answering',
      timeRemainingMs: config.questionSeconds * 1000 - cyclePosition,
      totalElapsedMs: elapsed,
    };
  } else {
    return {
      status: status as 'running' | 'paused',
      currentQuestion: questionNumber,
      phase: 'result',
      timeRemainingMs: cycleMs - cyclePosition,
      totalElapsedMs: elapsed,
    };
  }
}

/**
 * Check if an answer submission is within the valid time window.
 * Returns the server-computed response time in milliseconds.
 */
export function validateAnswerTiming(
  startedAtMs: number,
  position: number,
  serverNowMs: number,
  config: QuizTimingConfig = DEFAULT_CONFIG
): { valid: boolean; responseMs: number; reason?: string } {
  const window = getQuestionWindow(startedAtMs, position, config);
  const responseMs = serverNowMs - window.opensAtMs;

  if (serverNowMs < window.opensAtMs) {
    return { valid: false, responseMs: 0, reason: 'Question not yet open.' };
  }

  if (serverNowMs > window.closesAtMs + config.graceMs) {
    return { valid: false, responseMs, reason: 'Time expired.' };
  }

  // Clamp response time to [0, questionSeconds * 1000] for scoring
  const clampedMs = Math.max(0, Math.min(config.questionSeconds * 1000, responseMs));

  return { valid: true, responseMs: clampedMs };
}
