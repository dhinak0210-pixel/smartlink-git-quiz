import React from 'react';
import { LeaderboardEntry } from '@/lib/utils/types';
import { RankBadge } from './RankBadge';
import { Trophy, Timer, CheckCircle, Search } from 'lucide-react';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentStudentId?: string;
  myRank?: LeaderboardEntry | null;
}

export function LeaderboardTable({ entries, currentStudentId, myRank }: LeaderboardTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filtered = entries.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.college_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by student name or college ID..."
          className="w-full bg-surface border border-surface-border rounded-xl px-4 py-2.5 pl-10 text-xs sm:text-sm text-text placeholder-text-muted/60 focus:outline-none focus:border-git-orange"
        />
        <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-3" />
      </div>

      {/* Persistent My Rank Sticky Banner (if outside visible list) */}
      {myRank && !filtered.some((e) => e.student_id === myRank.student_id) && (
        <div className="p-3.5 rounded-xl bg-git-orange/15 border border-git-orange/40 flex items-center justify-between font-mono text-xs shadow-lg">
          <div className="flex items-center gap-3">
            <RankBadge rank={myRank.rank} />
            <div>
              <span className="font-bold text-text">Your Standing ({myRank.name})</span>
              <p className="text-[11px] text-text-muted">{myRank.college_id}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-bold text-git-orange text-sm">{myRank.total_score} pts</span>
            <p className="text-[11px] text-text-muted">{myRank.correct_count} correct</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-surface-border bg-surface/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-background/60 border-b border-surface-border text-text-muted font-mono uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4 w-16">Rank</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4 hidden sm:table-cell">College ID</th>
                <th className="py-3 px-4 text-right">Correct</th>
                <th className="py-3 px-4 text-right hidden md:table-cell">Avg Speed</th>
                <th className="py-3 px-4 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-muted font-mono text-xs">
                    No leaderboard records found.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => {
                  const isMe = entry.student_id === currentStudentId;

                  return (
                    <tr
                      key={entry.student_id}
                      className={`transition-colors hover:bg-surface-hover ${
                        isMe ? 'bg-git-orange/10 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="py-3 px-4 font-sans text-text">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[140px] sm:max-w-xs">{entry.name}</span>
                          {isMe && (
                            <span className="text-[10px] bg-git-orange text-white px-1.5 py-0.2 rounded font-mono uppercase">
                              YOU
                            </span>
                          )}
                        </div>
                        <span className="sm:hidden text-[11px] text-text-muted font-mono block">
                          {entry.college_id}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-text-muted hidden sm:table-cell">
                        {entry.college_id}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-text">
                        <span className="text-correct font-bold">{entry.correct_count}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-text-muted hidden md:table-cell">
                        {(entry.avg_time_ms / 1000).toFixed(1)}s
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold text-sm sm:text-base ${
                        entry.total_score < 0 ? 'text-wrong' : 'text-git-orange'
                      }`}>
                        {entry.total_score}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
