'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventStatusResponse } from '@/lib/utils/types';
import { POLLING_INTERVALS } from '@/lib/utils/constants';

export function useQuizState(pollInterval: number = POLLING_INTERVALS.STATUS) {
  const [eventState, setEventState] = useState<EventStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/event/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('Status error');
      const data: EventStatusResponse = await res.json();
      setEventState(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  return { eventState, isLoading, error, refetch: fetchStatus };
}
