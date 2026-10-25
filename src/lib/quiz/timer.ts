import { getServerTime } from './clock-sync';

export interface TimerState {
  remainingSeconds: number;
  remainingFraction: number; // 1.0 (full) down to 0.0 (expired)
  isExpired: boolean;
  timeTakenMs: number;
}

/**
 * Computes exact countdown time locally on the student browser using:
 * 1. question_started_at timestamp from server
 * 2. time_per_question_seconds
 * 3. NTP-Lite clock offset
 */
export function computeTimerState(
  questionStartedAt: string | null | undefined,
  timeLimitSeconds: number,
  clockOffsetMs: number = 0
): TimerState {
  if (!questionStartedAt) {
    return {
      remainingSeconds: timeLimitSeconds,
      remainingFraction: 1,
      isExpired: false,
      timeTakenMs: 0,
    };
  }

  const startMs = new Date(questionStartedAt).getTime();
  const currentServerMs = getServerTime(clockOffsetMs);
  const elapsedMs = Math.max(0, currentServerMs - startMs);
  const totalMs = timeLimitSeconds * 1000;

  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const remainingFraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const isExpired = remainingMs <= 0;

  return {
    remainingSeconds,
    remainingFraction,
    isExpired,
    timeTakenMs: elapsedMs,
  };
}
