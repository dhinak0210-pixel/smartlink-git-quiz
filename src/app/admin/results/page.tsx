'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Award,
  ArrowLeft,
  RefreshCw,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Download,
  Eye,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function AdminResultsPage() {
  const [ranking, setRanking] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [winnerStatus, setWinnerStatus] = useState<any>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resRank, resWinner] = await Promise.all([
        fetch('/api/admin/results-page/data'),
        fetch('/api/admin/results/winner'),
      ]);

      if (resRank.ok) {
        const d = await resRank.json();
        setRanking(d.ranking || []);
        setStats(d.stats || null);
      }
      if (resWinner.ok) {
        const w = await resWinner.json();
        setWinnerStatus(w.verification || null);
      }
    } catch {
      // Soft fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFreeze = async () => {
    if (!confirm('Freeze the leaderboard? This locks final standings.')) return;
    setFreezing(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/admin/results/freeze', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Leaderboard successfully frozen and snapshot stored.');
        await fetchData();
      } else {
        alert(data.error || 'Failed to freeze');
      }
    } finally {
      setFreezing(false);
    }
  };

  const handleRecompute = async (publish: boolean = false) => {
    setRecomputing(true);
    setActionMsg(null);
    try {
      const res = await fetch('/api/admin/results/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish }),
      });
      const data = await res.json();
      if (res.ok) {
        setRanking(data.ranking || []);
        setActionMsg(publish ? 'Results recomputed and published to contestants!' : 'Rankings recomputed with penalties & voids.');
        await fetchData();
      } else {
        alert(data.error || 'Failed to recompute');
      }
    } finally {
      setRecomputing(false);
    }
  };

  const handleApproveWinner = async () => {
    if (!ranking[0]) return;
    try {
      const res = await fetch('/api/admin/results/winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg('Winner approval recorded.');
        await fetchData();
      } else {
        alert(data.error || 'Approval failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRevealWinner = async () => {
    try {
      const res = await fetch('/api/admin/results/winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reveal' }),
      });
      if (res.ok) {
        setActionMsg('Winner revealed for projector and public leaderboard!');
        await fetchData();
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

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
                <Award className="w-6 h-6 text-yellow-400" />
                Results & Winner Finalization
              </h1>
              <p className="text-xs text-zinc-400">
                Official audit-verified standings with two-person authorization workflow
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/final"
              target="_blank"
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-yellow-400" />
              Public Leaderboard
            </Link>
            <button
              onClick={() => handleRecompute(false)}
              disabled={recomputing}
              className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-300 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? 'animate-spin' : ''}`} />
              Recompute Scores
            </button>
            <button
              onClick={handleFreeze}
              disabled={freezing}
              className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              Freeze Standings
            </button>
            <button
              onClick={() => handleRecompute(true)}
              disabled={recomputing}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
            >
              <Eye className="w-3.5 h-3.5" />
              Publish Results
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMsg}</span>
          </div>
        )}

        {/* Winner Verification Status Banner */}
        <div className="bg-gradient-to-r from-yellow-950/40 via-amber-950/20 to-zinc-900 border border-yellow-500/30 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase font-mono text-yellow-400 font-semibold tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Two-Person Champion Verification
              </span>
              <h2 className="text-xl font-bold text-white">
                {ranking[0]?.name ? `Current #1: ${ranking[0].name}` : 'Awaiting Quiz Completion'}
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Score: {ranking[0]?.finalScore || ranking[0]?.score || 0} pts &bull; Register No: {ranking[0]?.college_id || ranking[0]?.register_no || '—'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/verify"
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 border border-zinc-700"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Full Verification Workflow
              </Link>
              <button
                onClick={handleApproveWinner}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Sign Off / Approve Winner
              </button>
              <button
                onClick={handleRevealWinner}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-yellow-950/50"
              >
                <Zap className="w-4 h-4" /> Reveal to Projector
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Results Table */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-300 font-mono uppercase tracking-wider">
              Contestant Rankings ({ranking.length} Ranked)
            </h3>
            <a
              href="/api/admin/backup?format=json"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Export Official Backup
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase font-mono">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Contestant</th>
                  <th className="py-3 px-4">Raw Score</th>
                  <th className="py-3 px-4">Penalty</th>
                  <th className="py-3 px-4">Final Score</th>
                  <th className="py-3 px-4">Correct</th>
                  <th className="py-3 px-4">Total Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono">
                {ranking.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500 font-sans">
                      No results to display. Click &quot;Recompute Scores&quot; to calculate.
                    </td>
                  </tr>
                ) : (
                  ranking.map((row, idx) => (
                    <tr key={row.studentId || row.id || idx} className="hover:bg-zinc-800/20">
                      <td className="py-3 px-4 font-bold text-orange-400">#{idx + 1}</td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-white">{row.name || 'Contestant'}</div>
                        <div className="text-zinc-500 font-mono text-[11px]">{row.college_id || row.register_no || row.collegeId}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">{row.rawScore ?? row.score ?? 0}</td>
                      <td className="py-3 px-4 text-red-400">{row.penalty ? `-${row.penalty}` : '0'}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">{row.finalScore ?? row.score ?? 0}</td>
                      <td className="py-3 px-4 text-zinc-300">{row.correctCount ?? row.correct_count ?? 0}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {row.totalTimeMs ? `${(row.totalTimeMs / 1000).toFixed(1)}s` : '—'}
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
