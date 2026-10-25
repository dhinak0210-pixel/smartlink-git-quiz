'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, CreditCard, ArrowRight, AlertCircle, Users, Sparkles } from 'lucide-react';
import { useQuizState } from '@/hooks/useQuizState';

export function StudentLoginForm() {
  const router = useRouter();
  const { eventState } = useQuizState();

  const [collegeId, setCollegeId] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normId = collegeId.trim();
    const normName = name.trim();

    if (!normId || normId.length < 3) {
      setError('Please enter a valid College ID (e.g., 21CS042)');
      return;
    }
    if (!normName || normName.length < 2) {
      setError('Please enter your full name');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ college_id: normId, name: normName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      // Store in sessionStorage for fast client access
      sessionStorage.setItem('smartlink_student_name', data.student.name);
      sessionStorage.setItem('smartlink_student_college_id', data.student.college_id);
      sessionStorage.setItem('smartlink_student_id', data.student.id);

      // Route based on event status
      if (eventState && eventState.status === 'live') {
        router.push('/quiz');
      } else {
        router.push('/quiz/lobby');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Card Wrapper */}
      <div className="relative rounded-2xl border border-surface-border bg-surface/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/50">
        {/* Glow Accent */}
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-git-orange to-transparent" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-git-orange/10 border border-git-orange/20 text-git-orange text-xs font-mono mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>200-Player Live Arena</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text tracking-tight font-sans">
            SmartLink <span className="text-git-orange font-mono">Git Quiz</span>
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5">
            Authenticate with your student credentials to join the live session
          </p>
        </div>

        {/* Live Lobby Counter */}
        <div className="mb-6 flex items-center justify-between px-4 py-2.5 rounded-xl bg-background/60 border border-surface-border text-xs font-mono">
          <div className="flex items-center gap-2 text-text-muted">
            <Users className="w-4 h-4 text-git-orange" />
            <span>Students in Arena:</span>
          </div>
          <span className="font-bold text-text bg-surface px-2.5 py-0.5 rounded-full border border-surface-border">
            {eventState?.students_joined ?? 0} / 200
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-wrong/10 border border-wrong/30 flex items-start gap-3 text-xs text-wrong font-sans">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Access Notice</p>
              <p className="text-wrong/90 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-text-muted mb-1.5">
              COLLEGE ID / REGISTER NUMBER
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                placeholder="e.g. 21CS042 or 717821F101"
                className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted/60 focus:outline-none focus:border-git-orange focus:ring-1 focus:ring-git-orange transition font-mono uppercase"
              />
              <span className="absolute right-3.5 top-3.5 text-text-muted">
                <CreditCard className="w-4 h-4" />
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-text-muted mb-1.5">
              FULL NAME
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted/60 focus:outline-none focus:border-git-orange focus:ring-1 focus:ring-git-orange transition font-sans"
              />
              <span className="absolute right-3.5 top-3.5 text-text-muted">
                <User className="w-4 h-4" />
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-git-orange hover:bg-git-dark text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-git-orange/20 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2 font-mono text-xs">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Synchronizing Clock & Arena...
              </span>
            ) : (
              <>
                <span>Join Live Quiz</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-surface-border text-center">
          <p className="text-[11px] text-text-muted font-mono">
            Same college ID can rejoin automatically if disconnected.
          </p>
        </div>
      </div>
    </div>
  );
}
