'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Clock, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import Countdown from './Countdown';

interface LobbyProps {
  studentName?: string;
}

interface StateResponse {
  status: 'waiting' | 'running' | 'finished';
  started_at: string | null;
  server_time: number;
  question_seconds: number;
  gap_seconds: number;
  total_questions: number;
  students_joined: number;
}

export default function Lobby({ studentName }: LobbyProps) {
  const router = useRouter();
  const [joinedCount, setJoinedCount] = useState<number>(1);
  const [isStarting, setIsStarting] = useState(false);
  const [quizStatus, setQuizStatus] = useState<'waiting' | 'running' | 'finished'>('waiting');

  const pollState = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;

      const data: StateResponse = await res.json();
      setJoinedCount(data.students_joined);
      setQuizStatus(data.status);

      // Record clock synchronization offset: offset = server_time - Date.now()
      if (typeof window !== 'undefined' && data.server_time) {
        const offset = data.server_time - Date.now();
        sessionStorage.setItem('server_time_offset', offset.toString());
      }

      if (data.status === 'running') {
        setIsStarting(true);
      }
    } catch (err) {
      console.warn('[Lobby] State poll failed:', err);
    }
  }, []);

  useEffect(() => {
    // Initial poll
    pollState();

    // Poll every 2 seconds
    const interval = setInterval(pollState, 2000);
    return () => clearInterval(interval);
  }, [pollState]);

  const handleCountdownComplete = () => {
    router.push('/quiz');
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* 3-2-1 Countdown Overlay */}
      {isStarting && <Countdown from={3} onComplete={handleCountdownComplete} />}

      {/* Main Lobby Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 text-center">
        {/* Welcome greeting */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-medium mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Authenticated Student
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome{studentName ? `, ${studentName}` : ''}!
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            You are in the waiting room for SmartLink Git Quiz.
          </p>
        </div>

        {/* Live Host Status & Pulse Animation */}
        <div className="py-6 px-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 space-y-4">
          <div className="relative flex items-center justify-center w-16 h-16 mx-auto">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-25 animate-ping" />
            <div className="relative inline-flex items-center justify-center rounded-full w-14 h-14 bg-orange-500/20 border border-orange-500/50 text-orange-400">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold text-white">
              {quizStatus === 'waiting'
                ? 'Waiting for host to start the quiz...'
                : quizStatus === 'running'
                ? 'Quiz is starting now!'
                : 'Quiz finished'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              Screen will automatically advance the moment the host begins.
            </p>
          </div>

          {/* Students Joined Counter */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700/60 text-zinc-200">
            <Users className="w-4 h-4 text-orange-400" />
            <span className="font-mono text-sm font-semibold">
              <span className="text-white font-bold">{joinedCount}</span> / 200 joined
            </span>
          </div>
        </div>

        {/* Rules section */}
        <div className="text-left bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-4 sm:p-5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Rules of the Match
          </h4>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              <span><strong>15 questions</strong>, exactly 20 seconds each</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span><strong>Faster answer</strong> = up to 500 bonus speed points</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span><strong>Server-timed</strong>: Timer runs synchronously for everyone</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
