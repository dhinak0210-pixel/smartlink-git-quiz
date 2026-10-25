// src/hooks/useAntiCheat.ts
// React hook to integrate the monitor with the quiz UI.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { antiCheatMonitor } from '@/lib/anti-cheat/monitor';

export function useAntiCheat(isActiveOrPosition: boolean | number = true) {
  const [warning, setWarning] = useState<string | null>(null);

  const isActive = typeof isActiveOrPosition === 'boolean' ? isActiveOrPosition : true;
  const initialPosition = typeof isActiveOrPosition === 'number' ? isActiveOrPosition : 0;

  useEffect(() => {
    if (initialPosition > 0) {
      antiCheatMonitor.setQuestion(initialPosition);
    }
  }, [initialPosition]);

  useEffect(() => {
    if (!isActive) return;

    antiCheatMonitor.start();

    const handleWarning = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setWarning(detail.message);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setWarning(null), 5000);
    };

    window.addEventListener('quiz-warning', handleWarning);

    return () => {
      antiCheatMonitor.stop();
      window.removeEventListener('quiz-warning', handleWarning);
    };
  }, [isActive]);

  const setQuestion = useCallback((position: number) => {
    antiCheatMonitor.setQuestion(position);
  }, []);

  const dismissWarning = useCallback(() => {
    setWarning(null);
  }, []);

  return { warning, setQuestion, dismissWarning };
}
