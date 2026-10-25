'use client';

import { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry } from '@/lib/utils/types';
import { POLLING_INTERVALS } from '@/lib/utils/constants';

interface LeaderboardData {
  updated_at: string;
  total_participants: number;
  leaderboard: LeaderboardEntry[];
  my_rank?: LeaderboardEntry | null;
}

export function useLeaderboard(
  pollInterval: number = POLLING_INTERVALS.LEADERBOARD,
  isProjector: boolean = false
) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const url = isProjector ? '/api/leaderboard?source=projector' : '/api/leaderboard';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Leaderboard fetch failed');
      const json: LeaderboardData = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [isProjector]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, pollInterval);
    return () => clearInterval(interval);
  }, [fetchLeaderboard, pollInterval]);

  return { data, isLoading, error, refetch: fetchLeaderboard };
}
