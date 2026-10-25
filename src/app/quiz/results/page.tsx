'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Award, CheckCircle2, XCircle, Clock, Download, Share2, Tag, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function StudentResultsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch('/api/results/student');
        if (!res.ok) throw new Error('Failed to load personal scorecard');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, []);

  const handleDownloadPdf = async () => {
    if (!data?.college_id) return;
    setDownloading(true);
    try {
      const targetUrl = `/api/certificates/view?college_id=${encodeURIComponent(data.college_id)}`;
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.college_id}_certificate.pdf`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 200);
    } catch {
      window.location.href = `/api/certificates/view?college_id=${encodeURIComponent(data.college_id)}`;
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = () => {
    if (!data) return;
    const text = `🎯 I scored ${data.total_score} points and ranked #${data.rank}/${data.total_participants} in the SmartLink Git Championship! 🚀`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Compiling your verified scorecard..." />;
  }

  if (error || !data) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-lg font-mono font-bold text-wrong mb-2">Scorecard Unavailable</h2>
        <p className="text-xs text-text-muted mb-4">{error || 'Please ensure you have completed the quiz.'}</p>
        <Link href="/" className="px-4 py-2 rounded-xl bg-surface border border-surface-border text-xs font-mono">
          Return Home
        </Link>
      </div>
    );
  }

  const accuracy = Math.round((data.correct_count / (data.total_questions || 1)) * 100);

  return (
    <div className="max-w-4xl mx-auto w-full py-10 px-4 sm:px-6 space-y-8">
      {/* Top Banner / Scorecard */}
      <div className="rounded-3xl border border-surface-border bg-surface/90 p-6 sm:p-10 shadow-2xl relative overflow-hidden text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center mx-auto mb-4">
          <Trophy className="w-8 h-8" />
        </div>

        <span className="font-mono text-xs text-git-orange font-bold uppercase tracking-wider">
          Quiz Completed
        </span>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-text font-sans mt-1">
          {data.name}
        </h1>
        <p className="font-mono text-xs text-text-muted mt-1">{data.college_id}</p>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
          <div className="p-4 rounded-2xl bg-background border border-surface-border">
            <span className="text-[11px] font-mono text-text-muted uppercase">Rank</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-yellow-400 font-mono mt-1">
              #{data.rank}
              <span className="text-xs font-normal text-text-muted ml-1">/{data.total_participants}</span>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-surface-border">
            <span className="text-[11px] font-mono text-text-muted uppercase">Score</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-git-orange font-mono mt-1">
              {data.total_score}
              <span className="text-xs font-normal text-text-muted ml-1">pts</span>
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-surface-border">
            <span className="text-[11px] font-mono text-text-muted uppercase">Accuracy</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-correct font-mono mt-1">
              {accuracy}%
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-background border border-surface-border">
            <span className="text-[11px] font-mono text-text-muted uppercase">Avg Speed</span>
            <p className="text-2xl sm:text-3xl font-extrabold text-text font-mono mt-1">
              {(data.avg_time_ms / 1000).toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-surface-border text-xs font-mono text-text hover:bg-surface-hover transition shadow-sm"
          >
            <Share2 className="w-4 h-4 text-git-orange" />
            <span>{copied ? 'Copied to Clipboard!' : 'Share Scorecard'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-mono text-xs font-bold transition shadow-lg cursor-pointer ${
              data.rank <= 3
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/30'
                : 'bg-git-orange hover:bg-git-dark shadow-git-orange/20'
            }`}
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>
              {downloading
                ? 'Downloading...'
                : data.rank <= 3
                ? 'Download Winner Certificate (PDF)'
                : 'Download Participation Certificate (PDF)'}
            </span>
          </button>

          <Link
            href={`/download?college_id=${encodeURIComponent(data.college_id)}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-surface-border text-xs font-mono text-text hover:bg-surface-hover transition"
          >
            <Award className="w-4 h-4 text-orange-400" />
            <span>View & Print</span>
          </Link>
        </div>
      </div>

      {/* Per-Question Breakdown */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold font-mono text-text">Question Breakdown</h2>
        <div className="space-y-3">
          {data.breakdown.map((item: any) => (
            <div
              key={item.question_number}
              className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                item.is_correct
                  ? 'border-correct/30 bg-surface'
                  : 'border-wrong/30 bg-surface'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="font-bold text-git-orange">Q#{item.question_number}</span>
                    <span className="px-2 py-0.5 rounded bg-background border border-surface-border text-text-muted">
                      #{item.topic_tag}
                    </span>
                    <span className="text-text-muted">{item.time_taken_ms > 0 ? `${(item.time_taken_ms / 1000).toFixed(1)}s` : 'Timed out'}</span>
                  </div>

                  <p className="font-sans text-sm text-text font-medium">{item.question_text}</p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono pt-1">
                    <span>
                      Your Choice:{' '}
                      <strong className={`uppercase ${item.is_correct ? 'text-correct' : 'text-wrong'}`}>
                        {item.selected_answer || 'None (Timeout)'}
                      </strong>
                    </span>
                    <span>
                      Correct Key:{' '}
                      <strong className="text-correct uppercase">{item.correct_answer}</strong>
                    </span>
                  </div>

                  {item.explanation && (
                    <p className="text-xs text-text-muted font-sans pt-1 border-t border-surface-border/60 mt-2">
                      💡 {item.explanation}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 font-mono font-bold text-sm">
                    {item.is_correct ? (
                      <span className="text-correct flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        +{item.score_awarded}
                      </span>
                    ) : (
                      <span className="text-wrong flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        {item.score_awarded}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
