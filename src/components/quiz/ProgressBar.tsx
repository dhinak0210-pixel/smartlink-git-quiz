import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (current / (total || 1)) * 100));

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-text-muted">
          Question <strong className="text-git-orange font-bold">{current}</strong> of {total}
        </span>
        <span className="text-text-muted">{Math.round(percentage)}% Completed</span>
      </div>
      <div className="w-full h-2 rounded-full bg-surface border border-surface-border overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-git-orange via-git-light to-git-orange transition-all duration-500 ease-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
