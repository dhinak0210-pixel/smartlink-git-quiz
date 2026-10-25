import React from 'react';
import { Trophy, Medal } from 'lucide-react';

interface RankBadgeProps {
  rank: number;
}

export function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 flex items-center justify-center font-bold text-xs shadow-md shadow-yellow-500/20">
        <Trophy className="w-4 h-4" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-300/20 border border-slate-300/50 text-slate-200 flex items-center justify-center font-bold text-xs shadow-md">
        <Medal className="w-4 h-4" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-700/20 border border-amber-600/50 text-amber-500 flex items-center justify-center font-bold text-xs shadow-md">
        <Medal className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-surface border border-surface-border text-text-muted flex items-center justify-center font-mono text-xs font-semibold">
      #{rank}
    </div>
  );
}
