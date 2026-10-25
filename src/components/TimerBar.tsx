'use client';

import React from 'react';

interface TimerBarProps {
  timeRemainingMs: number;
  totalDurationMs?: number;
}

export default function TimerBar({
  timeRemainingMs,
  totalDurationMs = 20_000,
}: TimerBarProps) {
  const percentage = Math.max(0, Math.min(100, (timeRemainingMs / totalDurationMs) * 100));

  // Color transition: Green (> 50%) -> Yellow (20% - 50%) -> Red (< 20%)
  let colorClass = 'bg-emerald-500 shadow-emerald-500/50';
  if (percentage <= 25) {
    colorClass = 'bg-red-500 shadow-red-500/50';
  } else if (percentage <= 55) {
    colorClass = 'bg-amber-500 shadow-amber-500/50';
  }

  return (
    <div className="w-full bg-zinc-800/80 rounded-full h-3 overflow-hidden p-0.5 border border-zinc-700/60">
      <div
        className={`h-full rounded-full transition-all duration-100 ease-linear shadow-sm ${colorClass}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
