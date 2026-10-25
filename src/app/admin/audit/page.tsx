'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  Search,
  Shield,
  Download,
  Filter,
  Clock
} from 'lucide-react';

interface AuditEntry {
  id: string | number;
  actor_name: string;
  action: string;
  target_type?: string;
  target_id?: string;
  before_values?: any;
  after_values?: any;
  created_at: string;
}

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const url = actionFilter
        ? `/api/admin/audit?action=${encodeURIComponent(actionFilter)}`
        : '/api/admin/audit';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.audit || data || []);
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    return (
      (e.action && e.action.toLowerCase().includes(q)) ||
      (e.actor_name && e.actor_name.toLowerCase().includes(q)) ||
      (e.target_type && e.target_type.toLowerCase().includes(q))
    );
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
                <FileText className="w-6 h-6 text-orange-400" />
                Immutable Audit Log
              </h1>
              <p className="text-xs text-zinc-400">
                Cryptographically tracked, append-only log of every administrative and scoring action
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAudit}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href="/api/admin/backup?format=json"
              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Full Audit Trail
            </a>
          </div>
        </div>

        {/* Filter and Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search audit trail by actor, action type, or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">All Action Types</option>
              <option value="start_quiz">start_quiz</option>
              <option value="pause_quiz">pause_quiz</option>
              <option value="resume_quiz">resume_quiz</option>
              <option value="end_quiz">end_quiz</option>
              <option value="freeze_leaderboard">freeze_leaderboard</option>
              <option value="recompute_results">recompute_results</option>
              <option value="winner_approval">winner_approval</option>
              <option value="broadcast_announcement">broadcast_announcement</option>
              <option value="kill_switch">kill_switch</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase font-mono">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target</th>
                  <th className="py-3 px-4">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500 font-sans">
                      No audit events recorded matching criteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/20">
                      <td className="py-3 px-4 text-zinc-400 text-[11px] whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold text-white">
                        {item.actor_name || 'System'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800 text-orange-300 border border-zinc-700">
                          {item.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {item.target_type ? `${item.target_type}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-zinc-400 font-mono max-w-xs truncate">
                        {item.after_values ? JSON.stringify(item.after_values) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
