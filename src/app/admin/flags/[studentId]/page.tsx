'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Ban,
  UserX,
  UserCheck
} from 'lucide-react';

export default function EvidencePackViewerPage({
  params,
}: {
  params: { studentId: string };
}) {
  const { studentId } = params;
  const [evidenceMarkdown, setEvidenceMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [primaryReviewer, setPrimaryReviewer] = useState('');
  const [secondaryReviewer, setSecondaryReviewer] = useState('');
  const [decision, setDecision] = useState<'clear' | 'warning' | 'penalize' | 'disqualify'>('clear');
  const [penaltyPoints, setPenaltyPoints] = useState(100);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvidence() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/cheat-review/evidence/${studentId}`);
        if (res.ok) {
          const data = await res.json();
          setEvidenceMarkdown(data.evidence_markdown || '');
        }
      } catch {
        // Soft fail
      } finally {
        setLoading(false);
      }
    }
    loadEvidence();
  }, [studentId]);

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryReviewer || !reason) {
      alert('Primary reviewer name and rationale are required.');
      return;
    }

    if (['penalize', 'disqualify'].includes(decision)) {
      if (!secondaryReviewer || secondaryReviewer === primaryReviewer) {
        alert('Two distinct organizers must sign off for punitive decisions.');
        return;
      }
    }

    setSubmitting(true);
    setResultMessage(null);

    try {
      const res = await fetch('/api/admin/cheat-review/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          decision,
          primary_reviewer: primaryReviewer.trim(),
          secondary_reviewer: secondaryReviewer.trim() || undefined,
          reason: reason.trim(),
          penalty_points: decision === 'penalize' ? penaltyPoints : 0,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResultMessage(`Decision "${decision.toUpperCase()}" recorded successfully with dual sign-off!`);
      } else {
        alert(data.error || 'Failed to submit decision');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/flags"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-500" />
                Evidence Pack: Student {studentId}
              </h1>
              <p className="text-xs text-zinc-400">
                Official statistical evidence dossier &bull; Strict dual-organizer sign-off protocol
              </p>
            </div>
          </div>

          <Link
            href={`/admin/replay/${studentId}`}
            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            <PlayCircle className="w-4 h-4 text-orange-400" />
            Interactive Replay
          </Link>
        </div>

        {resultMessage && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{resultMessage}</span>
          </div>
        )}

        {/* Evidence Content Card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono">
            Detector Signals &amp; Evidence Dossier
          </h2>

          {loading ? (
            <p className="text-xs text-zinc-500 font-mono py-8 text-center">Loading evidence pack...</p>
          ) : (
            <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[450px]">
              {evidenceMarkdown}
            </div>
          )}
        </div>

        {/* Dual Organizer Adjudication Form */}
        <form
          onSubmit={handleSubmitDecision}
          className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 uppercase tracking-wider font-mono">
            <ShieldAlert className="w-4 h-4 text-rose-400" /> Official Review Decision &amp; Consensus
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Primary Reviewer Name / ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dhina (Lead Organizer)"
                value={primaryReviewer}
                onChange={(e) => setPrimaryReviewer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Secondary Reviewer Name / ID (Required for Penalty/DQ)
              </label>
              <input
                type="text"
                placeholder="e.g. Co-Organizer (Second Sign-off)"
                value={secondaryReviewer}
                onChange={(e) => setSecondaryReviewer(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Decision Action
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'clear', label: 'Clear (Benign)', color: 'border-emerald-600 text-emerald-400' },
                { id: 'warning', label: 'Formal Warning', color: 'border-amber-600 text-amber-400' },
                { id: 'penalize', label: 'Apply Point Penalty', color: 'border-orange-600 text-orange-400' },
                { id: 'disqualify', label: 'Disqualify Contestant', color: 'border-red-600 text-red-400' },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setDecision(opt.id as any)}
                  className={`p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    decision === opt.id
                      ? `bg-zinc-800 ${opt.color} ring-1 ring-white/20 shadow-lg`
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {decision === 'penalize' && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Point Penalty Deduction
              </label>
              <input
                type="number"
                min={10}
                max={500}
                value={penaltyPoints}
                onChange={(e) => setPenaltyPoints(Number(e.target.value))}
                className="w-48 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Adjudication Rationale &amp; Evidence Notes
            </label>
            <textarea
              required
              rows={3}
              placeholder="State the observed evidence, corroborating signals, or benign alternative hypotheses..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-800/60">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-rose-950/40"
            >
              <UserCheck className="w-4 h-4" />
              Record Dual Sign-Off Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
