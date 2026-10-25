'use client';

import { useState, useEffect } from 'react';
import { syncClock, getStoredClockOffset } from '@/lib/quiz/clock-sync';

export function useClockSync() {
  const [offsetMs, setOffsetMs] = useState<number>(getStoredClockOffset());
  const [isSynced, setIsSynced] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    async function runSync() {
      try {
        const offset = await syncClock();
        if (mounted) {
          setOffsetMs(offset);
          setIsSynced(true);
        }
      } catch (err) {
        console.warn('Clock sync warning:', err);
      }
    }

    runSync();

    // Re-sync every 2 minutes to keep drift minimal
    const interval = setInterval(runSync, 120000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { offsetMs, isSynced };
}
