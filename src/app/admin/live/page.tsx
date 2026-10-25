'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  Megaphone,
  Radio,
  Trophy,
  ArrowLeft,
  RefreshCw,
  Clock,
  Users,
  ShieldAlert,
  ShieldCheck,
  Flame,
  CheckCircle2
} from 'lucide-react';

export default function AdminLiveControlPage() {
  const [state, setState] = useState<any>(null);
  const [top10, setTop10] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcementMsg, setAnnouncementMsg] = useState('');
  const [killReason, setKillReason] = useState('');
  const [killConfirm, setKillConfirm] = useState('');
  const [showKillModal, setShowKillModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [malpracticeData, setMalpracticeData] = useState<{ totalFlags: number; totalFlaggedStudents: number; flaggedStudents: any[] }>({
    totalFlags: 0,
    totalFlaggedStudents: 0,
    flaggedStudents: [],
  });

  const fetchState = useCallback(async () => {
    try {
      const [resState, resLeaderboard, resMalpractice] = await Promise.all([
        fetch('/api/quiz/state'),
        fetch('/api/leaderboard?limit=10'),
        fetch('/api/admin/malpractice'),
      ]);

      if (resState.ok) {
        const data = await resState.json();
        setState(data);
      }
      if (resLeaderboard.ok) {
        const lbData = await resLeaderboard.json();
        setTop10(lbData.leaderboard || lbData || []);
      }
      if (resMalpractice.ok) {
        const malData = await resMalpractice.json();
        setMalpracticeData(malData);
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleStart = async () => {
    if (!confirm('Start the official quiz competition? All student timers will activate.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'START_QUIZ' }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        alert(d?.error || 'Failed to start quiz');
      }
      await fetchState();
    } catch (e: any) {
      alert(e.message || 'Failed to start quiz');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/quiz/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin temporary pause' }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to pause quiz');
      }
      await fetchState();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/resume', { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to resume quiz');
      }
      await fetchState();
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!confirm('End the quiz competition now? This will freeze the leaderboard standings.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/quiz/end', { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Failed to end quiz');
      }
      await fetchState();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementMsg.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: announcementMsg.trim(), type: 'info', active: true }),
      });
      if (res.ok) {
        setAnnouncementMsg('');
        alert('Broadcast announcement published to all active contestant screens!');
        await fetchState();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearBanner = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false, message: '' }),
      });
      await fetchState();
    } finally {
      setActionLoading(false);
    }
  };

  const handleKillSwitch = async () => {
    if (killConfirm !== 'ACTIVATE_KILL_SWITCH') {
      alert('Please type ACTIVATE_KILL_SWITCH to confirm emergency failover.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typedConfirmation: killConfirm,
          reason: killReason || 'Emergency failover initiated by admin',
          fallbackUrl: process.env.NEXT_PUBLIC_FALLBACK_URL || 'https://forms.google.com',
        }),
      });
      if (res.ok) {
        alert('Kill switch engaged. Contestants redirected to emergency form.');
        setShowKillModal(false);
        await fetchState();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const isRunning = state?.status === 'active' || state?.status === 'running';
  const isPaused = state?.status === 'paused';
  const isEnded = state?.status === 'ended' || state?.status === 'finished';

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Radio className="w-6 h-6 text-red-500 animate-pulse" />
                Live Control Room
              </h1>
              <p className="text-xs text-zinc-400">
                Synchronized real-time orchestration &bull; State: <span className="font-mono text-orange-400 uppercase">{state?.status || 'loading'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/monitor"
              className="px-3 py-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-700/60 rounded-lg text-xs font-semibold text-emerald-200 transition-colors flex items-center gap-1.5 shadow"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              Watch Contestants Live
            </Link>
            <Link
              href="/projector"
              target="_blank"
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              Open Projector View ↗
            </Link>
            <button
              onClick={() => setShowKillModal(true)}
              className="px-3 py-2 bg-red-950/60 hover:bg-red-900 border border-red-700/60 rounded-lg text-xs font-semibold text-red-200 transition-colors flex items-center gap-1.5"
            >
              <Flame className="w-4 h-4 text-red-400" />
              Kill Switch
            </button>
          </div>
        </div>

        {/* Primary Controls Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 md:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Live Competition Controls
            </h2>
            <div className="flex flex-wrap gap-3">
              {!isRunning && !isEnded && (
                <button
                  disabled={actionLoading}
                  onClick={handleStart}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Start Official Quiz
                </button>
              )}

              {isRunning && (
                <button
                  disabled={actionLoading}
                  onClick={handlePause}
                  className="px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-950/40 flex items-center gap-2"
                >
                  <Pause className="w-4 h-4" /> Pause Quiz
                </button>
              )}

              {isPaused && (
                <button
                  disabled={actionLoading}
                  onClick={handleResume}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-950/40 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Resume Competition
                </button>
              )}

              {(isRunning || isPaused) && (
                <button
                  disabled={actionLoading}
                  onClick={handleEnd}
                  className="px-5 py-3 bg-zinc-800 hover:bg-red-900/50 text-red-200 font-semibold rounded-xl text-sm border border-zinc-700 hover:border-red-700 transition-all flex items-center gap-2"
                >
                  End Quiz Gracefully
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 text-xs font-mono">
              <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-500 block">Question</span>
                <span className="text-white font-bold text-base">{state?.currentQuestion || 0} / {state?.totalQuestions || 15}</span>
              </div>
              <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-500 block">Pause Offset</span>
                <span className="text-amber-400 font-bold text-base">{Math.round((state?.pauseOffsetMs || 0) / 1000)}s</span>
              </div>
              <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/80">
                <span className="text-zinc-500 block">Voided</span>
                <span className="text-purple-400 font-bold text-base">{state?.voidedQuestions?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Broadcast Announcement Widget */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 md:col-span-2 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" /> Broadcast Announcement
                </h2>
                {state?.banner && (
                  <button
                    onClick={handleClearBanner}
                    className="text-[11px] text-zinc-400 hover:text-white underline"
                  >
                    Clear Banner
                  </button>
                )}
              </div>
              {state?.banner && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 mb-3">
                  <strong>Active:</strong> {state.banner.message}
                </div>
              )}
            </div>

            <form onSubmit={handleSendBanner} className="space-y-2">
              <input
                type="text"
                placeholder="Type an announcement to display on all active screens..."
                value={announcementMsg}
                onChange={(e) => setAnnouncementMsg(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={actionLoading || !announcementMsg.trim()}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Publish to All Screens Now
              </button>
            </form>
          </div>
        </div>

        {/* Live Top 10 Standings */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" /> Live Top 10 Standings
            </h2>
            <Link
              href="/admin/results"
              className="text-xs text-orange-400 hover:underline"
            >
              Full Results & Verification →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase font-mono">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Contestant</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">Correct</th>
                  <th className="py-2.5 px-3">Total Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {top10.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-500 font-sans">
                      No answers recorded yet in this round.
                    </td>
                  </tr>
                ) : (
                  top10.map((entry, idx) => (
                    <tr key={entry.student_id || idx} className="hover:bg-zinc-800/20">
                      <td className="py-2.5 px-3 font-bold text-orange-400">#{idx + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-white">
                        {entry.student_name || entry.name || 'Anonymous'}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400">{entry.score || 0}</td>
                      <td className="py-2.5 px-3 text-zinc-300">{entry.correct_count || 0}</td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {entry.total_time_ms ? `${(entry.total_time_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Malpractice & Screen Exit Feed */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Live Malpractice & Screen Exit Monitor
              </h2>
              {malpracticeData.totalFlags > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950/80 border border-red-500/60 text-red-400 animate-pulse">
                  {malpracticeData.totalFlags} Incidents ({malpracticeData.totalFlaggedStudents} Contestants)
                </span>
              )}
            </div>
            <Link
              href="/admin/flags"
              className="text-xs text-red-400 hover:underline"
            >
              Detailed Flag Audit →
            </Link>
          </div>

          {malpracticeData.flaggedStudents.length === 0 ? (
            <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-xl flex items-center gap-3 text-xs text-zinc-400 font-mono">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>All contestants are currently locked in fullscreen mode. No screen exit malpractice recorded.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {malpracticeData.flaggedStudents.map((item: any, idx: number) => {
                const s = item.student;
                const isDisq = item.strikeCount >= 3 || s.status === 'disqualified';
                return (
                  <div
                    key={s.id || idx}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-3 font-mono text-xs ${
                      isDisq
                        ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-950/40'
                        : 'bg-zinc-950/60 border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-sans font-bold text-white text-sm">
                          {s.name || 'Contestant'}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {s.college_id}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                          isDisq
                            ? 'bg-red-900 text-red-200 border border-red-600'
                            : 'bg-amber-950 text-amber-300 border border-amber-600'
                        }`}
                      >
                        {isDisq ? 'DISQUALIFIED' : `STRIKE ${item.strikeCount}/3`}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-zinc-300">
                      <div className="flex justify-between text-zinc-400">
                        <span>Violation:</span>
                        <span className="text-red-300 font-bold">Screen Exit / Blur</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Score Penalty:</span>
                        <span className="text-amber-400 font-bold">-{item.strikeCount * 200} pts</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kill Switch Modal */}
        {showKillModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-red-500/50 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-lg font-bold text-white">Emergency Kill Switch</h3>
              </div>
              <p className="text-xs text-zinc-300">
                This will immediately abort the live platform, freeze all student sessions, and redirect contestants to the Emergency Fallback Google Form.
              </p>
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  Type <span className="text-red-400 font-bold">ACTIVATE_KILL_SWITCH</span> to confirm:
                </label>
                <input
                  type="text"
                  value={killConfirm}
                  onChange={(e) => setKillConfirm(e.target.value)}
                  className="w-full bg-zinc-950 border border-red-500/40 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowKillModal(false)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-300 text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleKillSwitch}
                  disabled={killConfirm !== 'ACTIVATE_KILL_SWITCH' || actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 text-white font-semibold text-xs rounded-xl"
                >
                  Execute Emergency Failover
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
