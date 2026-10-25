import React from 'react';
import Link from 'next/link';
import AdminPanel from '@/components/AdminPanel';
import { ShieldCheck, ArrowRight, Activity, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex flex-col justify-center py-6 space-y-6">
      <div className="max-w-4xl mx-auto w-full px-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/monitor"
          className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/40 hover:border-emerald-500 text-text flex items-center justify-between transition group shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold font-mono text-sm group-hover:text-emerald-400 transition">
                Live Participant Condition Watcher
              </h2>
              <p className="text-xs text-text-muted font-mono">
                Watch who is in quiz, lobby, away/tab-blurred, or offline in real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition">
            <span>Watch Live</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/admin/dashboard"
          className="p-4 rounded-2xl bg-gradient-to-r from-git-orange/20 via-git-orange/10 to-transparent border border-git-orange/40 hover:border-git-orange text-text flex items-center justify-between transition group shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-git-orange flex items-center justify-center text-white shadow">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold font-mono text-sm group-hover:text-git-orange transition">
                Advanced Admin Control Center
              </h2>
              <p className="text-xs text-text-muted font-mono">
                Two-person approvals • Safe pause/void • Help Desk &amp; Audit Logs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs font-bold text-git-orange group-hover:translate-x-1 transition">
            <span>Open Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      <AdminPanel />
    </div>
  );
}
