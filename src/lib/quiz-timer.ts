// lib/quiz-timer.ts

const QUESTION_DURATION = 20_000; // 20 seconds to answer
const GAP_DURATION = 5_000;       // 5 seconds for result screen
const CYCLE = QUESTION_DURATION + GAP_DURATION; // 25 seconds per question

export interface ActiveQuestionStatus {
  questionNumber: number;    // 1-15
  phase: 'answering' | 'result' | 'waiting' | 'paused' | 'finished';
  timeRemainingMs: number;   // ms left in current phase
  isVoided: boolean;
}

/**
 * Computes which question is active using the server's started_at timestamp,
 * client clock offset, cumulative pause duration, and voided questions.
 */
export function getActiveQuestion(
  startedAt: number,
  serverTimeOffset: number,
  pauseOffsetMs: number = 0,
  isPaused: boolean = false,
  voidedQuestions: number[] = []
): ActiveQuestionStatus {
  if (isPaused) {
    return {
      questionNumber: 1,
      phase: 'paused',
      timeRemainingMs: 0,
      isVoided: false,
    };
  }

  const now = Date.now() + serverTimeOffset;
  const elapsed = (now - startedAt) - pauseOffsetMs;

  if (elapsed < 0) {
    return { questionNumber: 1, phase: 'answering', timeRemainingMs: QUESTION_DURATION, isVoided: false };
  }

  const cycleIndex = Math.floor(elapsed / CYCLE);
  const cyclePosition = elapsed % CYCLE;

  if (cycleIndex >= 15) {
    return { questionNumber: 15, phase: 'finished', timeRemainingMs: 0, isVoided: false };
  }

  const questionNumber = cycleIndex + 1;
  const isVoided = voidedQuestions.includes(questionNumber);

  if (cyclePosition < QUESTION_DURATION) {
    return {
      questionNumber,
      phase: 'answering',
      timeRemainingMs: QUESTION_DURATION - cyclePosition,
      isVoided,
    };
  } else {
    return {
      questionNumber,
      phase: 'result',
      timeRemainingMs: CYCLE - cyclePosition,
      isVoided,
    };
  }
}
