'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlayCircle,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Eye,
  Activity
} from 'lucide-react';

export default function StudentReplayPage({
  params,
}: {
  params: { studentId: string };
}) {
  const { studentId } = params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReplay() {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/replay/${studentId}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
        }
      } catch {
        // Soft fail
      } finally {
        setLoading(false);
      }
    }
    loadReplay();
  }, [studentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="font-mono text-xs text-zinc-400">Loading student replay stream...</p>
      </div>
    );
  }

  if (!data?.student) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <p className="text-zinc-400 text-sm mb-4">Contestant records not found.</p>
        <Link href="/admin/students" className="text-orange-400 text-xs underline">
          Back to Students Status Board
        </Link>
      </div>
    );
  }

  const { student, summary, items, telemetryLogs } = data;

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/students"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <PlayCircle className="w-6 h-6 text-orange-400" />
                Contestant Session Replay: {student.name}
              </h1>
              <p className="text-xs text-zinc-400 font-mono">
                {student.email} &bull; Register No: {student.register_no || '—'}
              </p>
            </div>
          </div>

          <Link
            href={`/admin/flags/${student.id}`}
            className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            View Evidence Pack
          </Link>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-500 block uppercase">Accuracy</span>
            <span className="text-xl font-bold text-emerald-400">
              {summary.totalCorrect} / {summary.totalAnswered}
            </span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-500 block uppercase">Total Score</span>
            <span className="text-xl font-bold text-orange-400">{summary.totalScore} pts</span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-500 block uppercase">Total Time</span>
            <span className="text-xl font-bold text-zinc-200">
              {(summary.totalTimeMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
            <span className="text-[11px] text-zinc-500 block uppercase">Tab Switches</span>
            <span className={`text-xl font-bold ${summary.totalTabSwitches > 0 ? 'text-rose-400' : 'text-zinc-400'}`}>
              {summary.totalTabSwitches}
            </span>
          </div>
        </div>

        {/* Timeline of Questions Answered */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" /> Question-by-Question Submission Stream
          </h2>

          {items.length === 0 ? (
            <div className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-2xl text-center text-zinc-500 text-xs">
              No answers submitted yet by this contestant.
            </div>
          ) : (
            items.map((item: any, idx: number) => {
              const isCorrect = item.isCorrect;
              return (
                <div
                  key={idx}
                  className={`border rounded-2xl p-5 shadow-lg space-y-3 transition-colors ${
                    isCorrect
                      ? 'bg-zinc-900/70 border-emerald-900/50'
                      : 'bg-zinc-900/70 border-zinc-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-zinc-800 text-white">
                        Q#{item.position || idx + 1}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 uppercase">
                        [{item.topic}] &bull; {item.difficulty}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {(item.responseMs / 1000).toFixed(2)}s
                      </span>
                      <span className={isCorrect ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {isCorrect ? `+${item.points} pts` : '0 pts'}
                      </span>
                      {item.tabSwitches > 0 && (
                        <span className="text-rose-400 flex items-center gap-1 bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-800/60 text-[10px]">
                          <AlertTriangle className="w-3 h-3" /> {item.tabSwitches} tab switch(es)
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-zinc-200 font-medium">
                    {item.questionText}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {item.options.map((opt: any) => {
                      const wasSelected = item.selectedOption === opt.id || item.selectedOption === opt.text;
                      const isOptionCorrect = opt.isCorrect;

                      let style = 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400';
                      if (wasSelected && isOptionCorrect) {
                        style = 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-semibold';
                      } else if (wasSelected && !isOptionCorrect) {
                        style = 'bg-rose-950/40 border-rose-500/50 text-rose-200 font-semibold';
                      } else if (isOptionCorrect) {
                        style = 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${style}`}
                        >
                          <span>{opt.text}</span>
                          {wasSelected && (
                            <span className="text-[10px] font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded">
                              Selected
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {item.explanation && (
                    <p className="text-[11px] text-zinc-400 italic pt-1">
                      💡 <strong>Explanation:</strong> {item.explanation}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Telemetry Logs */}
        {telemetryLogs.length > 0 && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-orange-400" /> Anti-Cheat Telemetry Timeline ({telemetryLogs.length} events)
            </h3>
            <div className="divide-y divide-zinc-800/60 font-mono text-[11px]">
              {telemetryLogs.map((log: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between text-zinc-400">
                  <span className="text-zinc-200 font-semibold">{log.event_type}</span>
                  <span className="text-zinc-500">{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
