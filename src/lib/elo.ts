/**
 * Elo rating system for adaptive practice.
 *
 * Key rules:
 * - K=32 for first 20 answers (fast calibration)
 * - K=16 after 20 answers (stabilization)
 * - Question Elo moves opposite to student Elo
 * - Expected score: 1 / (1 + 10^((Q_elo - S_elo) / 400))
 *
 * PRACTICE ONLY — these ratings NEVER affect competition.
 */

export const ELO_CENTER = 1500;
export const ELO_SCALE = 400;
export const K_NEW = 32;    // First 20 answers
export const K_STABLE = 16; // After 20 answers
export const K_THRESHOLD = 20;

export interface EloUpdate {
  studentEloBefore: number;
  studentEloAfter: number;
  questionEloBefore: number;
  questionEloAfter: number;
  expected: number;
  kFactor: number;
}

/**
 * Compute expected probability of student answering correctly.
 */
export function expectedScore(studentElo: number, questionElo: number): number {
  return 1 / (1 + Math.pow(10, (questionElo - studentElo) / ELO_SCALE));
}

/**
 * Get K-factor based on number of practice answers so far.
 */
export function getKFactor(totalAnswers: number): number {
  return totalAnswers < K_THRESHOLD ? K_NEW : K_STABLE;
}

/**
 * Compute Elo updates after a single answer.
 */
export function computeEloUpdate(
  studentElo: number,
  questionElo: number,
  isCorrect: boolean,
  totalStudentAnswers: number,
): EloUpdate {
  const expected = expectedScore(studentElo, questionElo);
  const actual = isCorrect ? 1 : 0;
  const k = getKFactor(totalStudentAnswers);

  const studentDelta = k * (actual - expected);
  const questionDelta = k * (expected - actual); // Opposite direction

  return {
    studentEloBefore: studentElo,
    studentEloAfter: Math.round((studentElo + studentDelta) * 10) / 10,
    questionEloBefore: questionElo,
    questionEloAfter: Math.round((questionElo + questionDelta) * 10) / 10,
    expected: Math.round(expected * 1000) / 1000,
    kFactor: k,
  };
}

/**
 * Convert IRT difficulty (logits) to Elo rating.
 * Uses the same conversion as the IRT calibration layer:
 *   elo = 1500 + 173.7178 × logit
 */
export function irtDifficultyToElo(difficultyLogit: number): number {
  return Math.round(ELO_CENTER + 173.7178 * difficultyLogit);
}

/**
 * Convert IRT ability (logits) to Elo rating.
 */
export function irtAbilityToElo(abilityLogit: number): number {
  return Math.round(ELO_CENTER + 173.7178 * abilityLogit);
}
