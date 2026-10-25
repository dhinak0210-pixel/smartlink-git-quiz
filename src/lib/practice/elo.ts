// src/lib/practice/elo.ts
// Unified Elo module exporting both current Layer 5 adaptive Elo engine
// and compatibility interfaces for legacy endpoints.

export * from '../elo';
export {
  type PracticeQuestion,
  type EloUpdateResult,
  INITIAL_RATING,
  DEFAULT_TARGET_WIN_RATE,
  difficultyToElo,
  getExpectedScore,
  calculateNewRatings,
  selectBestQuestion,
} from '../../../apps/practice/src/lib/elo';
