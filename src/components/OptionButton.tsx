'use client';

import React from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export type OptionStatus = 'idle' | 'loading' | 'correct' | 'incorrect' | 'dimmed';

interface OptionButtonProps {
  id: string;
  label: string;
  text: string;
  status: OptionStatus;
  disabled: boolean;
  onClick: (id: string) => void;
}

export default function OptionButton({
  id,
  label,
  text,
  status,
  disabled,
  onClick,
}: OptionButtonProps) {
  let containerStyles = 'bg-zinc-900/90 border-zinc-700/80 text-zinc-100 hover:border-orange-500/70 hover:bg-zinc-800/90 active:scale-[0.99]';
  let badgeStyles = 'bg-zinc-800 text-zinc-300 border-zinc-700';

  if (status === 'loading') {
    containerStyles = 'bg-orange-950/40 border-orange-500/80 text-orange-200 ring-2 ring-orange-500/30';
    badgeStyles = 'bg-orange-500 text-white border-orange-400';
  } else if (status === 'correct') {
    containerStyles = 'bg-emerald-950/70 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/40';
    badgeStyles = 'bg-emerald-500 text-white border-emerald-400';
  } else if (status === 'incorrect') {
    containerStyles = 'bg-red-950/70 border-red-500 text-red-100 ring-2 ring-red-500/40';
    badgeStyles = 'bg-red-500 text-white border-red-400';
  } else if (status === 'dimmed') {
    containerStyles = 'bg-zinc-950/40 border-zinc-800/60 text-zinc-500 opacity-60';
    badgeStyles = 'bg-zinc-900 text-zinc-600 border-zinc-800';
  }

  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      disabled={disabled}
      className={`w-full min-h-[56px] py-3.5 px-4 rounded-2xl border text-left flex items-center justify-between gap-3 shadow-md transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${containerStyles}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          className={`flex items-center justify-center w-8 h-8 rounded-xl font-mono text-sm font-bold border shrink-0 transition-colors ${badgeStyles}`}
        >
          {label}
        </span>
        <span className="text-sm sm:text-base font-medium leading-snug break-words">
          {text}
        </span>
      </div>

      <div className="shrink-0 ml-2">
        {status === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-orange-400" />}
        {status === 'correct' && <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-fadeIn" />}
        {status === 'incorrect' && <XCircle className="w-5 h-5 text-red-400 animate-fadeIn" />}
      </div>
    </button>
  );
}
