import { simpleHash } from '@/lib/utils/helpers';

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShuffledOption {
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  originalLabel: 'a' | 'b' | 'c' | 'd';
}

/**
 * Shuffles options deterministically for each student to prevent screen sharing / cheating.
 */
export function shuffleStudentOptions(
  options: { originalLabel: 'a' | 'b' | 'c' | 'd'; text: string }[],
  studentId: string,
  questionId: string,
  seed: number = 42
): ShuffledOption[] {
  const hash = simpleHash(`${studentId}-${questionId}-${seed}`);
  const rng = createSeededRng(hash);

  const labels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  const items = [...options];

  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  // Re-assign display labels a, b, c, d
  return items.map((item, index) => ({
    label: labels[index],
    text: item.text,
    originalLabel: item.originalLabel,
  }));
}

/**
 * Given a student's chosen display label ('a'|'b'|'c'|'d'), resolves which original option letter it corresponds to.
 */
export function resolveOriginalAnswer(
  selectedDisplayLabel: string,
  studentId: string,
  questionId: string,
  seed: number = 42
): 'a' | 'b' | 'c' | 'd' {
  const defaultOptions: { originalLabel: 'a' | 'b' | 'c' | 'd'; text: string }[] = [
    { originalLabel: 'a', text: 'a' },
    { originalLabel: 'b', text: 'b' },
    { originalLabel: 'c', text: 'c' },
    { originalLabel: 'd', text: 'd' },
  ];

  const shuffled = shuffleStudentOptions(defaultOptions, studentId, questionId, seed);
  const match = shuffled.find((opt) => opt.label === selectedDisplayLabel.toLowerCase());
  return match ? match.originalLabel : (selectedDisplayLabel.toLowerCase() as 'a' | 'b' | 'c' | 'd');
}
