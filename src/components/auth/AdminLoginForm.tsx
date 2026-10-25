'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, KeyRound, Mail, ArrowRight, AlertCircle, Sparkles, UserCheck } from 'lucide-react';

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('dhina7250@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid admin credentials');
      }

      router.push(data.redirect || '/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (mail: string, pass: string) => {
    setEmail(mail);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle top accent */}
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Portal Access</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Admin Login Portal</h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto">
            Authorized organizers and proctors access to tournament control &amp; live telemetry.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>ADMIN EMAIL / IDENTIFIER</span>
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dhina7250@gmail.com"
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1.5 flex items-center justify-between">
              <span>MASTER PASSKEY / PASSWORD</span>
              <KeyRound className="w-3.5 h-3.5 text-zinc-500" />
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition"
              autoFocus
            />
          </div>

          {/* Quick Demo Autofill */}
          <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] font-mono space-y-1.5">
            <div className="text-zinc-500 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Organizer Credentials Preset:</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleFillDemo('dhina7250@gmail.com', 'Dhina4213@')}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
              >
                Lead Organizer (Dhina4213@)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-all shadow-lg shadow-amber-600/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>{loading ? 'Verifying Admin Access...' : 'Enter Admin Portal'}</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </button>
        </form>

        {/* Clear Switch to Participant Login Portal */}
        <div className="mt-6 pt-4 border-t border-zinc-900">
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>Contestant or Participant?</span>
              </div>
              <p className="text-[11px] text-zinc-400">Join the live quiz arena lobby with College ID</p>
            </div>
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30 transition text-xs whitespace-nowrap"
            >
              Participant Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
