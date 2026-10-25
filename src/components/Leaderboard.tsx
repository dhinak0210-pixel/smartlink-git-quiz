'use client';

import React from 'react';
import { Trophy } from 'lucide-react';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  college_id: string;
  total_points: number;
}

interface LeaderboardProps {
  top10: LeaderboardEntry[];
  myRank?: number | null;
  highlightName?: string;
}

export default function Leaderboard({ top10, myRank, highlightName }: LeaderboardProps) {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="text-xl">🥇</span>;
      case 2:
        return <span className="text-xl">🥈</span>;
      case 3:
        return <span className="text-xl">🥉</span>;
      default:
        return <span className="font-mono text-sm font-bold text-zinc-400 w-6 text-center">{rank}.</span>;
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-400" />
          Official Top 10 Leaderboard
        </h3>
        {myRank && (
          <span className="text-xs font-mono text-orange-400 font-semibold">
            Your Rank: #{myRank}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {top10.length === 0 ? (
          <div className="text-center py-6 text-sm text-zinc-500 font-mono">
            No scores registered yet.
          </div>
        ) : (
          top10.map((entry) => {
            const isHighlight =
              entry.rank === myRank ||
              (highlightName && entry.name.toLowerCase() === highlightName.toLowerCase());

            let rowStyles = 'bg-zinc-950/60 border-zinc-800/80 text-zinc-200';
            if (entry.rank === 1) {
              rowStyles = 'bg-gradient-to-r from-amber-500/15 to-zinc-900 border-amber-500/50 text-amber-100 shadow-md shadow-amber-500/10';
            } else if (entry.rank === 2) {
              rowStyles = 'bg-gradient-to-r from-slate-400/15 to-zinc-900 border-slate-400/50 text-slate-100';
            } else if (entry.rank === 3) {
              rowStyles = 'bg-gradient-to-r from-amber-700/15 to-zinc-900 border-amber-700/50 text-amber-200';
            } else if (isHighlight) {
              rowStyles = 'bg-orange-950/60 border-orange-500/80 text-orange-100 ring-1 ring-orange-500/40';
            }

            return (
              <div
                key={entry.rank}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${rowStyles}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-7 shrink-0">
                    {getRankBadge(entry.rank)}
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-sm font-bold text-white truncate">
                      {entry.name}
                    </p>
                    <p className="text-[11px] font-mono text-zinc-400 truncate">
                      {entry.college_id}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className="font-mono text-sm sm:text-base font-extrabold text-orange-400">
                    {entry.total_points.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 block">
                    pts
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
