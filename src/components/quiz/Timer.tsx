'use client';

import React from 'react';
import { Timer as TimerIcon } from 'lucide-react';
import { TimerState } from '@/lib/quiz/timer';

interface TimerProps {
  timer: TimerState;
  size?: 'normal' | 'large';
}

export function Timer({ timer, size = 'normal' }: TimerProps) {
  const { remainingSeconds, remainingFraction, isExpired } = timer;

  // Color dynamics: green -> yellow (<=10s) -> red (<=5s)
  let colorClass = 'text-correct border-correct/40 bg-correct/10';
  let strokeColor = '#3FB950';

  if (remainingSeconds <= 5) {
    colorClass = 'text-wrong border-wrong/50 bg-wrong/15 animate-pulse';
    strokeColor = '#F85149';
  } else if (remainingSeconds <= 10) {
    colorClass = 'text-warning border-warning/40 bg-warning/10';
    strokeColor = '#D29922';
  }

  if (size === 'large') {
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - remainingFraction * circumference;

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg className="w-32 h-32 -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="#21262D"
            strokeWidth="8"
            fill="transparent"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke={strokeColor}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-200"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
          <span className={`text-3xl font-extrabold ${remainingSeconds <= 5 ? 'text-wrong scale-110' : 'text-text'} transition-transform`}>
            {isExpired ? '0' : remainingSeconds}
          </span>
          <span className="text-[10px] text-text-muted uppercase tracking-wider">Seconds</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border font-mono text-sm font-bold transition-all ${colorClass}`}
    >
      <TimerIcon className="w-4 h-4 shrink-0" />
      <span>{isExpired ? 'TIME UP' : `${remainingSeconds}s`}</span>
    </div>
  );
}
