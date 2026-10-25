'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ArrowRight, GitCommit } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const collegeIdInputRef = useRef<HTMLInputElement>(null);

  const [collegeId, setCollegeId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    // Auto-focus College ID input on load
    collegeIdInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedId = collegeId.trim();
    const trimmedCode = joinCode.trim();

    if (!trimmedId || !trimmedCode) {
      setError('Please enter both College ID and Join Code.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          college_id: trimmedId,
          join_code: trimmedCode,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'Invalid ID or code. Please verify credentials.');
        triggerShake();
        setLoading(false);
        return;
      }

      // Success -> navigate to lobby
      router.push('/lobby');
    } catch {
      setError('Network connection failed. Please try again.');
      triggerShake();
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/20 mb-4 border border-orange-400/30">
          <GitCommit className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          SmartLink Git Quiz
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Server-Timed Championship • 15 Questions
        </p>
      </div>

      {/* Login Card */}
      <div
        className={`bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md transition-transform duration-200 ${
          shake ? 'animate-shake border-red-500/50' : ''
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Inline Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-200 text-sm animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* College ID Field */}
          <div>
            <label
              htmlFor="college_id"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2"
            >
              College ID
            </label>
            <input
              id="college_id"
              ref={collegeIdInputRef}
              type="text"
              autoComplete="off"
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value)}
              disabled={loading}
              placeholder="e.g. CS2024001"
              className="w-full h-12 px-4 rounded-xl bg-zinc-950/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-base font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all disabled:opacity-50"
            />
          </div>

          {/* Join Code Field */}
          <div>
            <label
              htmlFor="join_code"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2"
            >
              Join Code
            </label>
            <input
              id="join_code"
              type="text"
              autoComplete="off"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              disabled={loading}
              placeholder="e.g. code001"
              className="w-full h-12 px-4 rounded-xl bg-zinc-950/80 border border-zinc-700/80 text-white placeholder-zinc-500 text-base font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all disabled:opacity-50"
            />
          </div>

          {/* Submit Button (min 48px tap target) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] h-12 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.99] text-white font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>JOIN QUIZ</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Info / Fallback Hint */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 text-center">
          <p className="text-xs text-zinc-400">
            ⚠️ <span className="text-zinc-300 font-medium">Wrong ID or code?</span> Check your registration email or contact the event coordinators.
          </p>
        </div>
      </div>
    </div>
  );
}
