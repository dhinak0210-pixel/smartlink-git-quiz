'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PlayCircle,
  Trophy,
  Tv,
  ArrowRight,
  CheckCircle2,
  Users,
  CreditCard,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

function UnifiedLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get('message');

  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          secret: secret.trim(),
          college_id: identifier.trim(),
          join_code: secret.trim(),
          email: identifier.trim(),
          password: secret.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials. Please verify your details.');
        return;
      }

      const nextParam = searchParams.get('next') || searchParams.get('redirect');
      if (nextParam) {
        router.push(nextParam);
      } else if (data.redirect) {
        router.push(data.redirect);
      } else if (data.role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/lobby');
      }
    } catch {
      setError('Network connection error. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (id: string, code: string) => {
    setIdentifier(id);
    setSecret(code);
    setError('');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-black selection:bg-orange-500/30">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
        {/* Subtle orange accent glow at top */}
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-mono mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Tournament Arena Sign-In</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SmartLink Quiz Login</h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Enter your credentials to access the live championship arena.
          </p>
        </div>

        {/* Alerts */}
        {message && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>COLLEGE ID OR EMAIL</span>
              <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-zinc-600 outline-none transition"
              placeholder="e.g. CS2024001 or email"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>JOIN CODE OR PASSWORD</span>
              <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono placeholder:text-zinc-600 outline-none transition pr-10"
                placeholder="e.g. baf4jc or password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Participant Preset Autofill for easy testing */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] font-mono space-y-1.5">
            <div className="text-zinc-500 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-orange-400" />
              <span>Contestant Demo Account:</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleFillDemo('CS2024001', 'baf4jc')}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              >
                CS2024001 (baf4jc)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-orange-600/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Arena'}</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </button>
        </form>

        {/* Public Utility Links */}
        <div className="pt-4 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-400">
          <Link href="/final" className="hover:text-orange-400 transition flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Live Standings</span>
          </Link>
          <Link href="/projector" target="_blank" className="hover:text-blue-400 transition flex items-center gap-1">
            <Tv className="w-3.5 h-3.5" />
            <span>Auditorium Projector</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-zinc-400">Loading Login...</div>}>
      <UnifiedLoginForm />
    </Suspense>
  );
}
