'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import Leaderboard, { LeaderboardEntry } from './Leaderboard';
import { Trophy, Share2, Check, Award, Zap, RefreshCw } from 'lucide-react';

interface FinalScoreProps {
  score: number;
  rank: number | null;
  top10: LeaderboardEntry[];
  studentName?: string;
  collegeId?: string;
  onRefresh?: () => void;
}

export default function FinalScore({
  score,
  rank,
  top10,
  studentName,
  collegeId,
  onRefresh,
}: FinalScoreProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      confetti({
        particleCount: rank && rank <= 10 ? 120 : 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F97316', '#F59E0B', '#10B981', '#3B82F6'],
      });
    } catch {
      // Confetti fallback if canvas not available
    }
  }, [rank]);

  const handleShare = async () => {
    const rankText = rank ? ` (Rank #${rank} / 200)` : '';
    const shareText = `🏆 I scored ${score.toLocaleString()} points${rankText} on SmartLink Git Quiz! 🚀`;

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const [downloading, setDownloading] = useState(false);

  const isWinner = rank !== null && rank > 0 && rank <= 3;
  const winnerBadge =
    rank === 1
      ? '🥇 1st Place Winner (Champion)'
      : rank === 2
      ? '🥈 2nd Place Winner (1st Runner-Up)'
      : rank === 3
      ? '🥉 3rd Place Winner (2nd Runner-Up)'
      : '';

  const certDownloadUrl = `/api/certificates/view${
    collegeId ? `?college_id=${encodeURIComponent(collegeId)}` : ''
  }`;
  const certViewUrl = `/download${
    collegeId ? `?college_id=${encodeURIComponent(collegeId)}` : ''
  }`;

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await fetch(certDownloadUrl);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${collegeId || 'certificate'}.pdf`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 200);
    } catch {
      window.location.href = certDownloadUrl;
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Quiz Complete Header Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl shadow-orange-500/20 border-2 border-amber-400 mx-auto">
          <Trophy className="w-10 h-10 text-white" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Quiz Complete!
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {studentName ? `Well played, ${studentName}!` : 'Thank you for competing!'}
          </p>
        </div>

        {/* Score & Rank Grid */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Your Score</span>
            </div>
            <p className="text-2xl font-black font-mono text-orange-400">
              {score.toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400 font-mono">
              <Award className="w-3.5 h-3.5 text-orange-400" />
              <span>Your Rank</span>
            </div>
            <p className="text-2xl font-black font-mono text-white">
              {rank ? `#${rank}` : '—'}{' '}
              <span className="text-xs text-zinc-500 font-normal">/ 200</span>
            </p>
          </div>
        </div>

        {/* Action Buttons: Share Result */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 min-h-[48px] py-3 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share Result</span>
              </>
            )}
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="min-h-[48px] py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-sm flex items-center justify-center gap-2 border border-zinc-700 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Official Certificate Card */}
      <div
        className={`rounded-3xl p-6 border shadow-xl backdrop-blur-md text-center space-y-4 ${
          isWinner
            ? 'bg-gradient-to-b from-amber-950/30 via-zinc-900/90 to-zinc-900 border-amber-500/40 shadow-amber-500/10'
            : 'bg-gradient-to-b from-cyan-950/20 via-zinc-900/90 to-zinc-900 border-cyan-500/30 shadow-cyan-500/10'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isWinner
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            {isWinner ? <Trophy className="w-5 h-5" /> : <Award className="w-5 h-5" />}
          </div>
          <div className="text-left">
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              {isWinner ? 'Top 3 Winner' : 'Participant Reward'}
            </div>
            <h2 className="text-base font-bold text-white">
              {isWinner ? 'Official Winner Certificate' : 'Certificate of Participation'}
            </h2>
          </div>
        </div>

        {/* Certificate Recipient Details */}
        <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-left space-y-1.5 font-mono text-xs">
          <div className="flex justify-between items-center text-zinc-400">
            <span>Recipient Name:</span>
            <span className="text-white font-bold">{studentName || 'Contestant'}</span>
          </div>
          <div className="flex justify-between items-center text-zinc-400">
            <span>Register No:</span>
            <span className={`font-bold ${isWinner ? 'text-amber-400' : 'text-cyan-400'}`}>
              {collegeId || 'Registered Participant'}
            </span>
          </div>
          <div className="flex justify-between items-center text-zinc-400">
            <span>Category:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                isWinner
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              {isWinner ? winnerBadge : 'Certificate of Participation'}
            </span>
          </div>
        </div>

        {/* Certificate Actions */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs font-mono flex items-center justify-center gap-2 transition shadow-md cursor-pointer ${
              isWinner
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            <Award className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Downloading...' : 'Download PDF'}</span>
          </button>
          <Link
            href={certViewUrl}
            className="py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold text-xs font-mono flex items-center justify-center gap-1.5 transition"
          >
            <span>View & Print</span>
          </Link>
        </div>
      </div>

      {/* Top 10 Leaderboard Section */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-xl backdrop-blur-md">
        <Leaderboard top10={top10} myRank={rank} highlightName={studentName} />
      </div>

      {/* Cross-Navigation Action Links */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-mono">
        <Link
          href="/download"
          className="px-4 py-2.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 flex items-center gap-1.5 transition font-semibold"
        >
          <Award className="w-4 h-4" />
          <span>Claim Certificate</span>
        </Link>
        <Link
          href="/lobby"
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center gap-1.5 transition"
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>Contestant Lobby</span>
        </Link>
        <Link
          href="/"
          className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition"
        >
          Tournament Portal
        </Link>
      </div>
    </div>
  );
}
