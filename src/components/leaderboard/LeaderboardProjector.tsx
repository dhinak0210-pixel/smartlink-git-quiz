import React from 'react';
import { Trophy, Award, Medal, Zap, Terminal } from 'lucide-react';
import { LeaderboardEntry } from '@/lib/utils/types';

interface LeaderboardProjectorProps {
  entries: LeaderboardEntry[];
  isFinished?: boolean;
}

export function LeaderboardProjector({ entries, isFinished }: LeaderboardProjectorProps) {
  const top10 = entries.slice(0, 10);
  const first = entries[0];
  const second = entries[1];
  const third = entries[2];

  return (
    <div className="w-full space-y-8">
      {/* If Quiz is Finished: Show Podium for Top 3 */}
      {isFinished && first && (
        <div className="mb-10">
          <h2 className="text-center font-mono text-xl sm:text-2xl text-git-orange font-bold uppercase tracking-widest mb-6 flex items-center justify-center gap-2">
            <Trophy className="w-7 h-7 text-yellow-400 animate-bounce" />
            <span>Grand Champions Podium</span>
            <Trophy className="w-7 h-7 text-yellow-400 animate-bounce" />
          </h2>

          <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-3xl mx-auto px-4">
            {/* 2nd Place */}
            {second && (
              <div className="flex-1 flex flex-col items-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-300/20 border-2 border-slate-300 flex items-center justify-center text-slate-200 mb-2 shadow-lg">
                  <Medal className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="w-full bg-surface-border/80 border border-slate-400/30 rounded-t-2xl p-4 text-center h-40 sm:h-48 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-xs text-slate-300 font-bold uppercase">2nd Place</span>
                    <p className="font-bold text-sm sm:text-lg text-text truncate mt-1">{second.name}</p>
                    <p className="font-mono text-xs text-text-muted">{second.college_id}</p>
                  </div>
                  <div className="font-mono font-extrabold text-git-orange text-lg sm:text-2xl">
                    {second.total_score} pts
                  </div>
                </div>
              </div>
            )}

            {/* 1st Place */}
            <div className="flex-1 flex flex-col items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center text-yellow-400 mb-2 shadow-2xl shadow-yellow-500/40 animate-pulse">
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
              <div className="w-full bg-yellow-500/10 border-2 border-yellow-400/60 rounded-t-2xl p-4 text-center h-52 sm:h-64 flex flex-col justify-between">
                <div>
                  <span className="font-mono text-xs text-yellow-400 font-bold uppercase tracking-wider">
                    🏆 1st Champion
                  </span>
                  <p className="font-bold text-base sm:text-2xl text-text truncate mt-1">{first.name}</p>
                  <p className="font-mono text-xs sm:text-sm text-text-muted">{first.college_id}</p>
                </div>
                <div className="font-mono font-black text-git-orange text-2xl sm:text-4xl">
                  {first.total_score} pts
                </div>
              </div>
            </div>

            {/* 3rd Place */}
            {third && (
              <div className="flex-1 flex flex-col items-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-700/20 border-2 border-amber-600 flex items-center justify-center text-amber-500 mb-2 shadow-lg">
                  <Medal className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div className="w-full bg-surface-border/60 border border-amber-700/30 rounded-t-2xl p-4 text-center h-32 sm:h-40 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-xs text-amber-500 font-bold uppercase">3rd Place</span>
                    <p className="font-bold text-sm sm:text-lg text-text truncate mt-1">{third.name}</p>
                    <p className="font-mono text-xs text-text-muted">{third.college_id}</p>
                  </div>
                  <div className="font-mono font-extrabold text-git-orange text-lg sm:text-xl">
                    {third.total_score} pts
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top 10 Leaderboard Table */}
      <div className="max-w-4xl mx-auto rounded-3xl border-2 border-surface-border bg-surface/90 overflow-hidden shadow-2xl backdrop-blur-xl">
        <div className="px-6 py-4 bg-background/80 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono text-lg font-bold text-text">
            <Trophy className="w-5 h-5 text-git-orange" />
            <span>TOP 10 LEADERBOARD</span>
          </div>
          <span className="font-mono text-xs text-text-muted">Live Projector Stream</span>
        </div>

        <div className="p-4 sm:p-6 space-y-2.5">
          {top10.length === 0 ? (
            <div className="py-12 text-center text-text-muted font-mono">
              Waiting for answers to stream in...
            </div>
          ) : (
            top10.map((item, idx) => {
              const isTop3 = idx < 3;
              const rankColor =
                idx === 0
                  ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/40'
                  : idx === 1
                  ? 'text-slate-200 bg-slate-300/10 border-slate-300/40'
                  : idx === 2
                  ? 'text-amber-500 bg-amber-600/10 border-amber-600/40'
                  : 'text-text-muted bg-background border-surface-border';

              return (
                <div
                  key={item.student_id}
                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isTop3
                      ? 'border-git-orange/40 bg-surface-hover/80 shadow-md'
                      : 'border-surface-border/60 bg-background/40'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center font-mono font-black text-sm sm:text-lg shrink-0 ${rankColor}`}
                    >
                      {idx + 1}
                    </span>

                    <div className="min-w-0">
                      <p className="font-bold text-sm sm:text-lg text-text truncate font-sans">
                        {item.name}
                      </p>
                      <p className="font-mono text-xs text-text-muted">{item.college_id}</p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="hidden sm:block text-right font-mono text-xs text-text-muted">
                      <span className="text-correct font-semibold">{item.correct_count} correct</span>
                      <p>{(item.avg_time_ms / 1000).toFixed(1)}s avg</p>
                    </div>

                    <div className="font-mono font-black text-git-orange text-lg sm:text-2xl">
                      {item.total_score}
                      <span className="text-xs font-normal text-text-muted ml-1">pts</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
