'use client';

import { useState, useEffect } from 'react';
import { computeTimerState, TimerState } from '@/lib/quiz/timer';
import { playSound } from '@/lib/utils/helpers';

export function useTimer(
  questionStartedAt: string | null | undefined,
  timeLimitSeconds: number = 30,
  clockOffsetMs: number = 0,
  enableSounds: boolean = true
) {
  const [timer, setTimer] = useState<TimerState>(() =>
    computeTimerState(questionStartedAt, timeLimitSeconds, clockOffsetMs)
  );

  useEffect(() => {
    let lastSecondTicked = -1;

    const interval = setInterval(() => {
      const state = computeTimerState(questionStartedAt, timeLimitSeconds, clockOffsetMs);
      setTimer(state);

      // Play tick sound when countdown <= 5 seconds and not expired
      if (
        enableSounds &&
        state.remainingSeconds <= 5 &&
        state.remainingSeconds > 0 &&
        state.remainingSeconds !== lastSecondTicked &&
        !state.isExpired
      ) {
        lastSecondTicked = state.remainingSeconds;
        playSound('tick');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [questionStartedAt, timeLimitSeconds, clockOffsetMs, enableSounds]);

  return timer;
}
