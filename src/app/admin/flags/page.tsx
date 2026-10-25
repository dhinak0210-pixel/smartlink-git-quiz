'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  TrendingDown
} from 'lucide-react';

export default function AdminFlagsQueuePage() {
  const [flagged, setFlagged] = useState<any[]>([]);
  const [detailedFlags, setDetailedFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  const fetchFlags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/flags');
      if (res.ok) {
        const data = await res.json();
        setFlagged(data.flagged_students || []);
        setDetailedFlags(data.detailed_flags || []);
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const filtered = flagged.filter((s) => {
    const q = search.toLowerCase();
    const match =
      (s.student_name && s.student_name.toLowerCase().includes(q)) ||
      (s.student_id && s.student_id.toLowerCase().includes(q));

    if (!match) return false;
    if (tierFilter === 'tier1') return (s.trust_score || 100) < 40;
    if (tierFilter === 'tier2') return (s.trust_score || 100) >= 40 && (s.trust_score || 100) < 70;
    return true;
  });

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
                <ShieldAlert className="w-6 h-6 text-rose-500" />
                Anti-Cheat Flag Review Queue
              </h1>
              <p className="text-xs text-zinc-400">
                Statistical anomalies, person-fit deviations, copy-paste patterns, and response time violations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchFlags}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </button>
            <Link
              href="/admin/dashboard"
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs font-semibold text-white transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search flagged contestants by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Flags' },
              { id: 'tier1', label: 'Tier 1 (High Risk)' },
              { id: 'tier2', label: 'Tier 2 (Review)' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTierFilter(tab.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                  tierFilter === tab.id
                    ? 'bg-zinc-800 text-rose-400 border border-zinc-700'
                    : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-zinc-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Flags Queue Table */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase font-mono">
                <tr>
                  <th className="py-3 px-4">Contestant</th>
                  <th className="py-3 px-4">Trust Score</th>
                  <th className="py-3 px-4">Signals Triggered</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4 text-right">Evidence & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500 font-sans">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                      No flagged contestants requiring review at this time.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const trust = s.trust_score ?? 85;
                    const isHighRisk = trust < 40;
                    return (
                      <tr key={s.student_id || s.id} className="hover:bg-zinc-800/20">
                        <td className="py-3.5 px-4 font-sans">
                          <div className="font-semibold text-white">{s.student_name || 'Contestant'}</div>
                          <div className="text-zinc-500 font-mono text-[11px]">{s.student_id}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isHighRisk
                                ? 'bg-red-950/80 text-red-300 border border-red-800/80'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                            }`}
                          >
                            {trust} / 100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans text-xs text-zinc-300">
                          <div className="flex flex-wrap gap-1">
                            {(s.flag_reasons || ['Anomaly detected']).map((r: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] border border-zinc-700"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[11px] uppercase tracking-wide text-zinc-400">
                            {s.review_status || 'Pending Review'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2 font-sans">
                          <Link
                            href={`/admin/flags/${s.student_id}`}
                            className="px-2.5 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Evidence Pack
                          </Link>
                          <Link
                            href={`/admin/replay/${s.student_id}`}
                            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Replay
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
