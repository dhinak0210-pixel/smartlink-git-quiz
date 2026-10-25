'use client';

import React from 'react';
import { CheckCircle2, XCircle, Clock, Zap, ArrowRight, Award } from 'lucide-react';

interface ResultOverlayProps {
  isCorrect: boolean;
  points: number;
  responseMs: number;
  explanation: string;
  rank?: number | null;
  secondsRemaining: number;
  isLastQuestion: boolean;
}

export default function ResultOverlay({
  isCorrect,
  points,
  responseMs,
  explanation,
  rank,
  secondsRemaining,
  isLastQuestion,
}: ResultOverlayProps) {
  const formattedSeconds = (responseMs / 1000).toFixed(1);

  return (
    <div className="bg-zinc-900/95 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 text-center animate-fadeIn">
      {/* Result Status Badge */}
      <div className="space-y-2">
        <div
          className={`inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto border shadow-lg ${
            isCorrect
              ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-400 shadow-emerald-500/20'
              : 'bg-red-950/60 border-red-500/80 text-red-400 shadow-red-500/20'
          }`}
        >
          {isCorrect ? (
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          ) : (
            <XCircle className="w-10 h-10" />
          )}
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          {isCorrect ? '✅ Correct!' : points === 0 && responseMs >= 20000 ? '⏱ Time Expired!' : '❌ Incorrect'}
        </h2>
      </div>

      {/* Points & Response Time */}
      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Score</span>
          </div>
          <p className={`text-xl font-black font-mono ${isCorrect ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {isCorrect ? `+${points.toLocaleString()}` : '0'}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>Response</span>
          </div>
          <p className="text-xl font-black font-mono text-white">
            {formattedSeconds}s
          </p>
        </div>
      </div>

      {/* Explanation Box */}
      {explanation && (
        <div className="text-left bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-1.5">
          <h4 className="text-xs uppercase tracking-wider font-mono font-semibold text-zinc-400">
            Explanation
          </h4>
          <p className="text-sm text-zinc-200 leading-relaxed">
            {explanation}
          </p>
        </div>
      )}

      {/* Student Rank if known */}
      {rank && (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm font-semibold">
          <Award className="w-4 h-4 text-orange-400" />
          <span>Your current rank: <strong>#{rank}</strong></span>
        </div>
      )}

      {/* Next question or final countdown indicator */}
      <div className="pt-2 text-zinc-400 text-sm flex items-center justify-center gap-2 font-mono">
        {isLastQuestion ? (
          <span>Calculating final tournament scores...</span>
        ) : (
          <>
            <span>Next question in <strong>{secondsRemaining}s</strong></span>
            <ArrowRight className="w-4 h-4 animate-pulse text-orange-400" />
          </>
        )}
      </div>
    </div>
  );
}
