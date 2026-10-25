'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Users,
  Tv,
  HelpCircle,
  Activity,
  Trophy,
  Megaphone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  ArrowUpRight,
} from 'lucide-react';

interface EventStatus {
  status: 'waiting' | 'live' | 'active' | 'running' | 'paused' | 'finished' | 'ended';
  event_name?: string;
  current_question_number?: number;
  total_questions?: number;
  students_joined?: number;
  question_started_at?: string | null;
  server_time?: number;
}

export default function AdminDashboardPage() {
  const [eventData, setEventData] = useState<EventStatus>({
    status: 'waiting',
    event_name: 'SmartLink Git Quiz 2026',
    current_question_number: 1,
    total_questions: 15,
    students_joined: 0,
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'error'>('info');

  // Fetch Event Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/event/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setEventData({
          status: data.status || 'waiting',
          event_name: data.event_name || 'SmartLink Git Quiz 2026',
          current_question_number: data.current_question_number || 1,
          total_questions: data.total_questions || 15,
          students_joined: data.students_joined ?? 0,
          question_started_at: data.question_started_at,
          server_time: data.server_time,
        });
      }
    } catch (err) {
      console.error('Failed to fetch event status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  // Action Handlers
  const handleStart = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      // Trigger both event start endpoints for full consistency
      const [res1] = await Promise.all([
        fetch('/api/event/start', { method: 'POST' }),
        fetch('/api/admin/quiz/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: 'START_QUIZ' }),
        }).catch(() => null),
      ]);

      const data = await res1.json().catch(() => ({}));
      if (!res1.ok && res1.status !== 401) {
        throw new Error(data.error || 'Failed to start quiz');
      }

      setFeedback({ type: 'success', message: 'Quiz started! Question 1 is now live for all students.' });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error starting quiz.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/event/next', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to advance question');
      }

      const qNum = (eventData.current_question_number || 1) + 1;
      setFeedback({
        type: 'success',
        message: data.status === 'finished' ? 'All questions completed! Event finished.' : `Advanced to Question ${qNum}.`,
      });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error advancing question.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePause = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/event/pause', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update pause state');
      }

      setFeedback({
        type: 'success',
        message: data.status === 'paused' ? 'Quiz paused. Student clocks paused.' : 'Quiz resumed.',
      });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating pause state.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndQuiz = async () => {
    if (!confirm('End the quiz competition now? This will finalize the leaderboard.')) {
      return;
    }
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/event/end', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to end quiz');
      }

      setFeedback({ type: 'success', message: 'Quiz ended. Final results are now frozen.' });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error ending quiz.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetQuiz = async () => {
    if (!confirm('Reset quiz state back to "waiting"? Use this only for practice or fresh re-runs.')) {
      return;
    }
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset quiz');
      }

      setFeedback({ type: 'success', message: 'Quiz reset back to waiting lobby.' });
      await fetchStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error resetting quiz.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: broadcastMessage.trim(), type: broadcastType }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send broadcast');
      }

      setFeedback({ type: 'success', message: 'Announcement sent to all student screens.' });
      setBroadcastMessage('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Could not send announcement.' });
    } finally {
      setActionLoading(false);
    }
  };

  const isLive = eventData.status === 'live' || eventData.status === 'active' || eventData.status === 'running';
  const isPaused = eventData.status === 'paused';
  const isFinished = eventData.status === 'finished' || eventData.status === 'ended';
  const isWaiting = eventData.status === 'waiting' || (!isLive && !isPaused && !isFinished);

  const currentQ = eventData.current_question_number || 1;
  const totalQ = eventData.total_questions || 15;
  const progressPercent = Math.min(100, Math.round((currentQ / totalQ) * 100));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Admin Dashboard</h1>
            <span
              className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-semibold border ${
                isLive
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : isPaused
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : isFinished
                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                  : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
              }`}
            >
              {isLive ? '🔴 LIVE NOW' : isPaused ? '⏸️ PAUSED' : isFinished ? '🏁 FINISHED' : '⏳ WAITING'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {eventData.event_name} • Live event controls & management overview
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/projector"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 text-xs font-medium transition"
          >
            <Tv className="w-3.5 h-3.5 text-cyan-400" />
            <span>Projector</span>
            <ArrowUpRight className="w-3 h-3 text-zinc-500" />
          </Link>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-mono ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-zinc-500 hover:text-white ml-2 text-sm leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4 Essential Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Status Card */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Quiz Status</div>
          <div className="text-base font-bold text-white flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-emerald-400 animate-pulse' : isPaused ? 'bg-amber-400' : isFinished ? 'bg-zinc-500' : 'bg-cyan-400'
              }`}
            />
            <span>{isLive ? 'Live' : isPaused ? 'Paused' : isFinished ? 'Finished' : 'Waiting in Lobby'}</span>
          </div>
          <div className="text-[11px] text-zinc-400">
            {isLive ? 'Timing active' : isWaiting ? 'Ready for launch' : 'State locked'}
          </div>
        </div>

        {/* Question Progress Card */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Question</div>
          <div className="text-base font-bold text-white">
            Q{currentQ} <span className="text-xs font-normal text-zinc-400">of {totalQ}</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-1 overflow-hidden">
            <div className="bg-orange-500 h-full rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Contestants Joined */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Contestants</div>
          <div className="text-base font-bold text-white flex items-center gap-1.5">
            <Users className="w-4 h-4 text-orange-400" />
            <span>{eventData.students_joined ?? 0}</span>
          </div>
          <Link href="/admin/students" className="text-[11px] text-orange-400 hover:underline block">
            View student directory →
          </Link>
        </div>

        {/* Question Bank Link */}
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Questions Pool</div>
          <div className="text-base font-bold text-white flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>{totalQ} Scenarios</span>
          </div>
          <Link href="/admin/questions" className="text-[11px] text-cyan-400 hover:underline block">
            Manage question bank →
          </Link>
        </div>
      </div>

      {/* Main Event Conductor Controls */}
      <div className="p-5 sm:p-6 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-900 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Live Event Controls</h2>
            <p className="text-xs text-zinc-400">
              Control question flow, pause timer for announcements, or conclude the tournament.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            Current: Question {currentQ} / {totalQ}
          </span>
        </div>

        {/* Action Button Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Start Button (Visible when waiting or finished) */}
          {(isWaiting || isFinished) && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-emerald-950/40"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isFinished ? 'Restart Quiz' : 'Start Quiz (Launch Q1)'}</span>
            </button>
          )}

          {/* Controls visible when quiz is Live or Paused */}
          {(isLive || isPaused) && (
            <>
              {/* Next Question Button */}
              <button
                onClick={handleNextQuestion}
                disabled={actionLoading || currentQ >= totalQ}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-sm transition shadow-lg shadow-orange-950/40"
              >
                <SkipForward className="w-4 h-4" />
                <span>Next Question (Q{currentQ + 1})</span>
              </button>

              {/* Pause / Resume Button */}
              <button
                onClick={handleTogglePause}
                disabled={actionLoading}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${
                  isPaused
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-600/30'
                    : 'bg-amber-600/20 text-amber-400 border-amber-500/40 hover:bg-amber-600/30'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume Quiz' : 'Pause Quiz'}</span>
              </button>

              {/* End Quiz Button */}
              <button
                onClick={handleEndQuiz}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-sm font-medium transition"
              >
                <Square className="w-4 h-4" />
                <span>End Event</span>
              </button>
            </>
          )}

          {/* Reset Event (Safe Fallback) */}
          <button
            onClick={handleResetQuiz}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 text-xs font-mono transition ml-auto"
            title="Reset to lobby state"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset State</span>
          </button>
        </div>
      </div>

      {/* Broadcast Announcement to Students */}
      <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Megaphone className="w-4 h-4 text-orange-400" />
          <span>Broadcast Message to Students</span>
        </div>
        <p className="text-xs text-zinc-400">
          Sends an instant banner to all 200 contestant screens (e.g. "Stay in fullscreen", "30 seconds left").
        </p>

        <form onSubmit={handleBroadcast} className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <input
            type="text"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="Type announcement here..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
          />

          <select
            value={broadcastType}
            onChange={(e: any) => setBroadcastType(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Urgent</option>
          </select>

          <button
            type="submit"
            disabled={actionLoading || !broadcastMessage.trim()}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-medium text-xs transition whitespace-nowrap shadow-sm"
          >
            Send Alert
          </button>
        </form>
      </div>

      {/* Admin Quick Management Modules */}
      <div>
        <h2 className="text-sm font-mono text-zinc-400 uppercase tracking-wider mb-3">Management Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Students */}
          <Link
            href="/admin/students"
            className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-orange-500/40 transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors">
                Contestants
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage 202 registered students, credentials, and unlock accounts.
              </p>
            </div>
          </Link>

          {/* Card 2: Question Bank */}
          <Link
            href="/admin/questions"
            className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-cyan-500/40 transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                Question Bank
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Review, edit, or customize the 15 quiz questions and options.
              </p>
            </div>
          </Link>

          {/* Card 3: Live Monitor */}
          <Link
            href="/admin/monitor"
            className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-emerald-500/40 transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                Live Monitor
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Watch participant connections, answer rates, and screen focus in real time.
              </p>
            </div>
          </Link>

          {/* Card 4: Results & Podium */}
          <Link
            href="/admin/results"
            className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-amber-500/40 transition space-y-2"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                Results &amp; Winners
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Official leaderboard scores, podium ceremony, and certificate generation.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
