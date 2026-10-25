'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Play, RotateCcw, Lock, Users, Clock, AlertTriangle, ShieldCheck, Trophy, CheckCircle2, Radio } from 'lucide-react';

interface AnswerPerQuestion {
  position: number;
  count: number;
  avg_response_ms: number;
}

interface TopStudent {
  rank: number;
  name: string;
  college_id: string;
  total_points: number;
}

interface AdminStats {
  status: 'waiting' | 'running' | 'finished';
  students_joined: number;
  answers_per_question: AnswerPerQuestion[];
  top_10: TopStudent[];
}

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const fetchStats = useCallback(
    async (pwd: string) => {
      try {
        const res = await fetch(`/api/admin/stats?password=${encodeURIComponent(pwd)}`, {
          cache: 'no-store',
        });

        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthError('Invalid admin password');
          return;
        }

        if (res.ok) {
          const data: AdminStats = await res.json();
          setStats(data);
          setIsAuthenticated(true);
          setAuthError(null);

          if (data.status === 'running' && !startTimeRef.current) {
            startTimeRef.current = Date.now();
          } else if (data.status === 'waiting') {
            startTimeRef.current = null;
            setElapsedSeconds(0);
          }
        }
      } catch (err) {
        console.error('[AdminPanel] Error fetching stats:', err);
      }
    },
    []
  );

  // Poll stats every 5 seconds once authenticated
  useEffect(() => {
    if (!isAuthenticated || !password) return;

    fetchStats(password);
    const interval = setInterval(() => {
      fetchStats(password);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated, password, fetchStats]);

  // Elapsed timer tick when running
  useEffect(() => {
    if (stats?.status !== 'running') return;

    const timer = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [stats?.status]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    fetchStats(password.trim());
  };

  const handleStart = async () => {
    if (stats?.status === 'running') return;
    const confirmed = window.confirm('Are you sure you want to start the tournament for all students now?');
    if (!confirmed) return;

    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        startTimeRef.current = Date.now();
        await fetchStats(password);
      } else {
        alert('Failed to start tournament. Check server logs.');
      }
    } catch {
      alert('Network error while starting tournament.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReset = async () => {
    const firstConfirm = window.confirm('⚠️ Are you sure you want to RESET the tournament?');
    if (!firstConfirm) return;

    const secondConfirm = window.confirm('DOUBLE CONFIRMATION: This will DELETE all student answers and return to the waiting state. Proceed?');
    if (!secondConfirm) return;

    setLoadingAction(true);
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        startTimeRef.current = null;
        setElapsedSeconds(0);
        await fetchStats(password);
        alert('Tournament successfully reset to waiting state.');
      } else {
        alert('Failed to reset tournament.');
      }
    } catch {
      alert('Network error while resetting tournament.');
    } finally {
      setLoadingAction(false);
    }
  };

  // 1. Password Protection Screen
  if (!isAuthenticated) {
    return (
      <div className="w-full max-w-sm mx-auto px-4 py-12">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Admin Access
            </h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono">
              SmartLink Git Quiz Layer 1 Control Panel
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {authError && (
              <p className="text-xs text-red-400 bg-red-950/60 border border-red-800/60 p-2.5 rounded-xl font-medium">
                {authError}
              </p>
            )}

            <input
              type="password"
              placeholder="Enter Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-zinc-950 border border-zinc-700 text-white placeholder-zinc-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            />

            <button
              type="submit"
              className="w-full min-h-[48px] h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
            >
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Authenticated Admin Panel
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Host Admin Dashboard
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Server-Authoritative Control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                stats?.status === 'running'
                  ? 'bg-emerald-400 animate-pulse'
                  : stats?.status === 'finished'
                  ? 'bg-blue-400'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-200">
              {stats?.status || 'WAITING'}
            </span>
          </div>

          {/* Joined Badge */}
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs font-semibold">
            <Users className="w-3.5 h-3.5 text-orange-400" />
            <span>{stats?.students_joined ?? 0} / 200</span>
          </div>
        </div>
      </div>

      {/* Live Participant Condition Watcher Banner */}
      <Link
        href="/admin/monitor"
        className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 hover:border-emerald-500 flex items-center justify-between text-zinc-100 transition group shadow-md"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-mono text-sm font-bold text-zinc-100 group-hover:text-emerald-300 transition">
              Live Participant Condition Watcher
            </h3>
            <p className="text-xs text-zinc-400 font-mono">
              Watch contestant conditions in real-time (In Quiz, In Lobby, Tab Hidden, or Offline)
            </p>
          </div>
        </div>
        <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1 group-hover:translate-x-1 transition">
          <span>Watch Live</span>
          <span>&rarr;</span>
        </span>
      </Link>

      {/* Control Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* START Button */}
        <button
          type="button"
          onClick={handleStart}
          disabled={loadingAction || stats?.status === 'running'}
          className={`min-h-[52px] py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg transition-all ${
            stats?.status === 'running'
              ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 cursor-default'
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20 active:scale-[0.99] cursor-pointer'
          }`}
        >
          {stats?.status === 'running' ? (
            <>
              <Clock className="w-5 h-5 animate-spin" />
              <span>TOURNAMENT RUNNING ({elapsedSeconds}s)</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>START TOURNAMENT</span>
            </>
          )}
        </button>

        {/* RESET Button */}
        <button
          type="button"
          onClick={handleReset}
          disabled={loadingAction}
          className="min-h-[52px] py-3.5 px-6 rounded-2xl bg-zinc-900 hover:bg-red-950/40 border border-zinc-800 hover:border-red-500/50 text-zinc-300 hover:text-red-300 font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" />
          <span>RESET TOURNAMENT</span>
        </button>
      </div>

      {/* Layer 2 Anti-Cheat & Winner Protocol Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/admin/review"
          className="min-h-[48px] py-3 px-5 rounded-2xl font-bold text-xs font-mono tracking-wide flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition shadow"
        >
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <span>LAYER 2: ANTI-CHEAT REVIEW PANEL</span>
        </a>
        <a
          href="/admin/verify"
          className="min-h-[48px] py-3 px-5 rounded-2xl font-bold text-xs font-mono tracking-wide flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition shadow"
        >
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span>LAYER 2: WINNER VERIFICATION PROTOCOL</span>
        </a>
      </div>

      {/* Stats Grid: Answers Per Question + Live Top 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Answers Per Question */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
              Answers Per Question (1-15)
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">Auto-refreshes 5s</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {stats?.answers_per_question.map((q) => (
              <div
                key={q.position}
                className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs font-mono"
              >
                <span className="font-bold text-zinc-200">
                  Question {q.position}
                </span>

                <div className="flex items-center gap-3 text-zinc-400">
                  <span className="text-orange-400 font-semibold">
                    {q.count} / 200 answers
                  </span>
                  <span>
                    avg {(q.avg_response_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Top 10 */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              Live Tournament Top 10
            </h2>
            <span className="text-[11px] font-mono text-zinc-500">Auto-refreshes 5s</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {stats?.top_10 && stats.top_10.length > 0 ? (
              stats.top_10.map((entry) => (
                <div
                  key={entry.rank}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs font-mono"
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span className="text-amber-400 font-bold w-4">
                      {entry.rank}.
                    </span>
                    <span className="text-white font-medium truncate">
                      {entry.name}
                    </span>
                    <span className="text-zinc-500 text-[10px]">
                      ({entry.college_id})
                    </span>
                  </div>

                  <span className="font-bold text-orange-400 shrink-0 ml-2">
                    {entry.total_points.toLocaleString()} pts
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-xs text-zinc-500 font-mono">
                No scores recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
