'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Radio, Home } from 'lucide-react';

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-zinc-900 border border-amber-500/40 rounded-2xl p-8 space-y-5 shadow-2xl">
        <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-mono text-xs">
            <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Quiz server is actively running</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Admin UI State Render Interrupted
          </h2>
          <p className="text-xs text-zinc-400">
            A temporary client rendering error occurred in this admin panel view.
            The backend timer and database are unaffected and students continue without interruption.
          </p>
        </div>

        {error?.message && (
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-[11px] font-mono text-zinc-400 text-left truncate">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-orange-950/40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry View
          </button>
          <Link
            href="/admin/dashboard"
            className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            Command Center
          </Link>
        </div>
      </div>
    </div>
  );
}
