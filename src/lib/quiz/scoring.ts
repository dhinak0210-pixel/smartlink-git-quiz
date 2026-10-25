// src/lib/quiz/scoring.ts
// Server-side scoring with Layer 2 Anti-Cheat & Tab-Switch Penalty integration.

import { getSupabaseAdmin } from '@/lib/supabase-server';

export interface ScoreResult {
  isCorrect: boolean;
  points: number;
  responseMs: number;
  speedBonus: number;
  basePoints?: number;
  tabPenalty?: number;
  finalPoints?: number;
}

/**
 * Compute the score for a single answer.
 *
 * Formula:
 *   Wrong answer:  0 points
 *   Correct answer: pointsBase + speedBonus
 *   speedBonus = 500 × (1 - responseMs / maxResponseMs)
 *
 * Examples (with pointsBase=1000, maxResponseMs=20000):
 *   Instant (0ms):     1000 + 500 = 1500
 *   Half time (10s):   1000 + 250 = 1250
 *   Last second (20s): 1000 + 0   = 1000
 *   Wrong:             0
 */
export function computeScore(
  isCorrect: boolean,
  responseMs: number,
  pointsBase: number = 1000,
  maxResponseMs: number = 20_000
): ScoreResult {
  if (!isCorrect) {
    return {
      isCorrect: false,
      points: 0,
      responseMs,
      speedBonus: 0,
      basePoints: 0,
      finalPoints: 0,
    };
  }

  const clamped = Math.max(0, Math.min(maxResponseMs, responseMs));
  const speedBonus = Math.round(500 * (1 - clamped / maxResponseMs));
  const points = pointsBase + speedBonus;

  return {
    isCorrect: true,
    points,
    responseMs,
    speedBonus,
    basePoints: pointsBase,
    finalPoints: points,
  };
}

/**
 * Compute the total tab-switch penalty for a student.
 * 1st switch: 0 (warning)
 * 2nd switch: -200
 * 3rd+ switch: -200 each, i.e. (count - 1) * 200
 */
export async function getTabSwitchPenalty(studentId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('type', 'tab_switch');

  const switches = count ?? 0;

  if (switches <= 1) return 0;
  return (switches - 1) * 200;
}

/**
 * Compute the score for a single answer, including tab-switch penalties.
 *
 * Tab-switch penalty rules:
 *   1st switch: warning only (0 points)
 *   2nd switch: -200 points
 *   3rd+ switch: -200 points each
 *
 * The penalty is applied to the TOTAL quiz score during leaderboard aggregation,
 * but computed here for real-time display and telemetry tracking.
 */
export async function computeScoreWithPenalties(
  studentId: string,
  isCorrect: boolean,
  responseMs: number,
  pointsBase: number = 1000,
  maxResponseMs: number = 20_000
): Promise<ScoreResult> {
  const base = computeScore(isCorrect, responseMs, pointsBase, maxResponseMs);
  const tabPenalty = await getTabSwitchPenalty(studentId);

  return {
    ...base,
    basePoints: isCorrect ? pointsBase : 0,
    tabPenalty,
    finalPoints: base.points,
  };
}

/**
 * Compute the maximum possible score for the entire quiz.
 * Used for percentage calculations on the results screen.
 */
export function maxPossibleScore(
  totalQuestions: number = 15,
  pointsBase: number = 1000,
  maxSpeedBonus: number = 500
): number {
  return totalQuestions * (pointsBase + maxSpeedBonus);
}
// Default: 15 × 1500 = 22,500

/**
 * Backward compatibility alias returning number.
 */
export function calculateScore(
  isCorrect: boolean,
  responseMs: number,
  maxResponseMs: number = 20_000,
  pointsBase: number = 1000,
  _hasAnswered?: boolean
): number {
  const res = computeScore(isCorrect, responseMs, pointsBase, maxResponseMs);
  return res.points;
}
