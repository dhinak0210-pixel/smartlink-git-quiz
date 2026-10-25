// src/lib/quiz/shuffle.ts
// Deterministic option shuffling per student per question.
// Ensures each student sees options in a different order,
// but the same order on re-fetch (so the UI doesn't jump).

export interface ShuffledOption {
  id: string;
  text: string;
  label: string; // 'A', 'B', 'C', 'D' (reassigned after shuffle)
}

/**
 * Simple seeded PRNG (mulberry32).
 * Deterministic: same seed always produces same sequence.
 */
export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a string to a 32-bit integer for use as a PRNG seed.
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

/**
 * Shuffle options deterministically for a specific student and question.
 * The original labels (A-D) are reassigned based on the new order.
 *
 * @param options - Array of { id, text } from the database (canonical order)
 * @param studentId - The student's UUID
 * @param questionId - The question's UUID
 * @returns Shuffled options with new labels A-D
 */
export function shuffleOptions(
  options: { id: string; text: string }[],
  studentId: string,
  questionId: string
): ShuffledOption[] {
  const seed = hashString(`${studentId}:${questionId}`);
  const rng = mulberry32(seed);

  // Fisher-Yates shuffle with seeded RNG
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Reassign labels
  const labels = ['A', 'B', 'C', 'D'];
  return shuffled.map((opt, i) => ({
    id: opt.id,
    text: opt.text,
    label: labels[i],
  }));
}

/**
 * Reverse lookup: given a shuffled label, find the original option ID.
 * Used when the student submits an answer by label.
 */
export function findOptionIdByLabel(
  shuffled: ShuffledOption[],
  label: string
): string | null {
  const found = shuffled.find((o) => o.label === label.toUpperCase());
  return found?.id ?? null;
}
