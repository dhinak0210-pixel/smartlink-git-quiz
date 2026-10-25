'use client';

import React, { useState, useEffect, useCallback } from 'react';
import FinalScore from '@/components/FinalScore';
import { LeaderboardEntry } from '@/components/Leaderboard';
import { Loader2 } from 'lucide-react';

export default function FinalPage() {
  const [loading, setLoading] = useState(true);
  const [top10, setTop10] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState<number>(0);
  const [studentName, setStudentName] = useState<string>('');
  const [collegeId, setCollegeId] = useState<string>('');

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTop10(data.top_10 || []);
        setMyRank(data.my_rank || null);
        setMyPoints(data.my_points || 0);
        if (data.my_name) setStudentName(data.my_name);
        if (data.my_college_id) setCollegeId(data.my_college_id);
      }

      // Check auth verify endpoint to ensure we have the participant's name & register number
      const authRes = await fetch('/api/auth/verify');
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.student) {
          setStudentName((prev) => prev || authData.student.name || '');
          setCollegeId((prev) => prev || authData.student.college_id || '');
        }
      }
    } catch (err) {
      console.error('[FinalPage] Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center space-y-4 px-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-sm font-mono text-zinc-400">
          Tabulating final tournament standings...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-6">
      <FinalScore
        score={myPoints}
        rank={myRank}
        top10={top10}
        studentName={studentName}
        collegeId={collegeId}
        onRefresh={fetchLeaderboard}
      />
    </div>
  );
}
