// apps/practice/src/lib/elo.ts
// Elo rating engine for SmartLink Git Quiz practice mode.

export interface EloUpdateResult {
  newPlayerRating: number;
  newQuestionRating: number;
  playerDelta: number;
  questionDelta: number;
  expectedScore: number;
}

export interface PracticeQuestion {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  explanation: string;
  rating: number;
  options: Array<{
    id: string;
    text: string;
    label: 'A' | 'B' | 'C' | 'D';
    is_correct?: boolean;
  }>;
}

export const INITIAL_RATING = 1500;
export const DEFAULT_TARGET_WIN_RATE = 0.65; // Zone of Proximal Development

/**
 * Maps categorical difficulty or IRT b parameter to initial Elo scale.
 */
export function difficultyToElo(difficulty: 'easy' | 'medium' | 'hard', irtB?: number): number {
  if (typeof irtB === 'number' && !isNaN(irtB)) {
    // b in [-3, +3] -> Elo in [1100, 1900]
    return Math.round(1500 + irtB * 150);
  }
  switch (difficulty) {
    case 'easy':
      return 1300;
    case 'medium':
      return 1500;
    case 'hard':
      return 1700;
    default:
      return 1500;
  }
}

/**
 * Returns expected win probability of player against a question.
 */
export function getExpectedScore(playerRating: number, questionRating: number): number {
  return 1 / (1 + Math.pow(10, (questionRating - playerRating) / 400));
}

/**
 * Dynamic K-Factor: higher for placement phase (first 20 answers), stabilizing later.
 */
export function getKFactor(answerCount: number): number {
  if (answerCount < 10) return 40;
  if (answerCount < 25) return 24;
  return 16;
}

/**
 * Computes updated player and question ratings following an answer submission.
 */
export function calculateNewRatings(
  playerRating: number,
  questionRating: number,
  isCorrect: boolean,
  answerCount: number = 0
): EloUpdateResult {
  const expected = getExpectedScore(playerRating, questionRating);
  const actual = isCorrect ? 1.0 : 0.0;
  const k = getKFactor(answerCount);

  const playerDelta = Math.round(k * (actual - expected));
  // Questions move symmetrically
  const questionDelta = -playerDelta;

  return {
    newPlayerRating: Math.max(800, Math.min(2500, playerRating + playerDelta)),
    newQuestionRating: Math.max(800, Math.min(2500, questionRating + questionDelta)),
    playerDelta,
    questionDelta,
    expectedScore: Number(expected.toFixed(3)),
  };
}

/**
 * Selects the question whose expected success rate is closest to targetWinRate (optimal learning).
 */
export function selectBestQuestion(
  playerRating: number,
  candidateQuestions: PracticeQuestion[],
  seenQuestionIds: Set<string> = new Set(),
  targetWinRate: number = DEFAULT_TARGET_WIN_RATE
): PracticeQuestion | null {
  const unseen = candidateQuestions.filter((q) => !seenQuestionIds.has(q.id));
  if (unseen.length === 0) return null;

  let bestQuestion: PracticeQuestion = unseen[0];
  let minDiff = Infinity;

  for (const q of unseen) {
    const expected = getExpectedScore(playerRating, q.rating);
    const diff = Math.abs(expected - targetWinRate);
    if (diff < minDiff) {
      minDiff = diff;
      bestQuestion = q;
    }
  }

  return bestQuestion;
}
