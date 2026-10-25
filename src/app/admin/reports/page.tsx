'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  Sparkles,
  ArrowLeft,
  Users,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AdminReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const [feedbackResults, setFeedbackResults] = useState<any[]>([]);

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch('/api/results/export?format=json');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadReports();
  }, []);

  const handleGenerateAiFeedback = async () => {
    setGeneratingFeedback(true);
    try {
      const res = await fetch('/api/ai/feedback', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Feedback generation failed');
      setFeedbackResults(json.feedback_reports || []);
    } catch (err: any) {
      alert('AI Feedback error: ' + err.message);
    } finally {
      setGeneratingFeedback(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Aggregating post-event metrics and scores..." />;
  }

  const results: any[] = data?.results || [];
  const totalScoreSum = results.reduce((sum, r) => sum + (r.total_score || 0), 0);
  const avgScore = results.length > 0 ? Math.round(totalScoreSum / results.length) : 0;
  const top10 = results.slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-text text-xs font-mono flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold text-text font-mono">Post-Event Reports & AI Feedback</h1>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <a
            href="/api/results/export?format=csv"
            download
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-correct hover:bg-correct/90 text-white font-mono text-xs font-bold transition shadow"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>

          <a
            href="/api/results/export?format=json"
            target="_blank"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-surface-border text-text hover:bg-surface-hover font-mono text-xs transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-git-orange" />
            <span>Export JSON</span>
          </a>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-surface-border bg-surface">
          <span className="text-xs font-mono text-text-muted uppercase">Total Participants</span>
          <p className="text-3xl font-extrabold text-text font-mono mt-1">{results.length}</p>
        </div>

        <div className="p-5 rounded-2xl border border-surface-border bg-surface">
          <span className="text-xs font-mono text-text-muted uppercase">Average Score</span>
          <p className="text-3xl font-extrabold text-git-orange font-mono mt-1">{avgScore} pts</p>
        </div>

        <div className="p-5 rounded-2xl border border-surface-border bg-surface">
          <span className="text-xs font-mono text-text-muted uppercase">Highest Score</span>
          <p className="text-3xl font-extrabold text-yellow-400 font-mono mt-1">
            {results[0]?.total_score || 0} pts
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-surface-border bg-surface">
          <span className="text-xs font-mono text-text-muted uppercase">Disqualified</span>
          <p className="text-3xl font-extrabold text-wrong font-mono mt-1">
            {results.filter((r) => r.is_banned).length}
          </p>
        </div>
      </div>

      {/* AI Post-Event Feedback Generator */}
      <div className="rounded-2xl border border-surface-border bg-surface p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-git-orange/15 border border-git-orange/30 flex items-center justify-center text-git-orange">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text font-mono">
                Gemini Batched Student Feedback
              </h2>
              <p className="text-xs text-text-muted">
                Synthesize 3-4 sentence encouraging reviews and custom practice topics (5/min rate-controlled)
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={generatingFeedback}
            onClick={handleGenerateAiFeedback}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-git-orange hover:bg-git-dark text-white font-mono text-xs font-bold transition disabled:opacity-50 shadow-lg shadow-git-orange/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>{generatingFeedback ? 'Batch Synthesizing...' : 'Generate AI Feedback Reports'}</span>
          </button>
        </div>

        {feedbackResults.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-surface-border">
            {feedbackResults.map((fb, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-surface-border bg-background space-y-1.5 font-sans"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-text">{fb.name} ({fb.college_id})</span>
                  <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-git-orange uppercase font-bold text-[10px]">
                    {fb.performance_level}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{fb.feedback}</p>
                <p className="text-[11px] text-correct font-mono">
                  Recommended Practice: {fb.recommended_practice}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 10 Participants Table */}
      <div className="rounded-2xl border border-surface-border bg-surface p-6 space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-text font-mono">Top 10 Contestants</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-background text-text-muted font-mono uppercase text-[11px] border-b border-surface-border">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">College ID</th>
                <th className="py-2.5 px-3 text-right">Correct</th>
                <th className="py-2.5 px-3 text-right">Avg Speed</th>
                <th className="py-2.5 px-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {top10.map((r, idx) => (
                <tr key={idx} className="hover:bg-surface-hover">
                  <td className="py-2.5 px-3 font-mono font-bold text-git-orange">#{idx + 1}</td>
                  <td className="py-2.5 px-3 font-sans font-medium text-text">{r.name}</td>
                  <td className="py-2.5 px-3 font-mono text-text-muted">{r.college_id}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-correct font-bold">
                    {r.correct_count}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-text-muted">
                    {r.avg_time_seconds}s
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-git-orange text-sm">
                    {r.total_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
