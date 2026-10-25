'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  PlayCircle,
  Trophy,
  Tv,
  Shield,
  ArrowRight,
  Zap,
  Users,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface EventStatus {
  status: string;
  event_name?: string;
  students_joined?: number;
  total_questions?: number;
}

export default function HomePage() {
  const [eventData, setEventData] = useState<EventStatus>({
    status: 'waiting',
    event_name: 'SmartLink Git Quiz',
    students_joined: 0,
    total_questions: 15,
  });

  useEffect(() => {
    fetch('/api/event/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.status) {
          setEventData({
            status: data.status,
            event_name: data.event_name || 'SmartLink Git Quiz',
            students_joined: data.students_joined ?? 0,
            total_questions: data.total_questions || 15,
          });
        }
      })
      .catch(() => {});
  }, []);

  const isLive = eventData.status === 'active' || eventData.status === 'running';
  const isCompleted = eventData.status === 'completed' || eventData.status === 'ended';

  return (
    <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16 max-w-4xl mx-auto w-full">
      {/* Hero Section */}
      <div className="text-center space-y-5">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isLive ? 'bg-red-400' : 'bg-emerald-400'
              } opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isLive ? 'bg-red-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className={isLive ? 'text-red-400 font-semibold' : 'text-zinc-300'}>
            {isLive
              ? 'Quiz Live Now'
              : isCompleted
              ? 'Event Completed'
              : 'Arena Ready • Waiting for Start'}
          </span>
          {(eventData.students_joined ?? 0) > 0 && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 flex items-center gap-1">
                <Users className="w-3 h-3 text-orange-400" />
                {eventData.students_joined} Joined
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          SmartLink{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
            Git Quiz
          </span>
        </h1>

        {/* Concise Description */}
        <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Interactive real-time Git technical competition. Sign in with your student ID, answer
          fast-paced scenario questions, and compete on the live stage leaderboard.
        </p>

        {/* Essential Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link
            href={isLive ? '/quiz' : '/login'}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-sm transition-all shadow-lg hover:shadow-orange-950/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            <PlayCircle className="w-4 h-4 fill-white/20" />
            <span>{isLive ? 'Join Live Quiz' : 'Enter Quiz Arena'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/final"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 font-medium text-sm transition-all hover:-translate-y-0.5"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Leaderboard</span>
          </Link>

          <Link
            href="/projector"
            target="_blank"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 font-medium text-sm transition-all hover:-translate-y-0.5"
          >
            <Tv className="w-4 h-4 text-cyan-400" />
            <span>Projector View</span>
          </Link>
        </div>
      </div>

      {/* 3 Essential Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center space-y-1.5">
          <div className="w-8 h-8 mx-auto rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
            <GitBranch className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-white text-sm">{eventData.total_questions || 15} Git Scenarios</h3>
          <p className="text-xs text-zinc-400 leading-normal">
            Branches, rebasing, merge conflicts, and commit workflows.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center space-y-1.5">
          <div className="w-8 h-8 mx-auto rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-white text-sm">20s Speed Bonus</h3>
          <p className="text-xs text-zinc-400 leading-normal">
            Fast, accurate answers earn higher multiplier bonus points.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-center space-y-1.5">
          <div className="w-8 h-8 mx-auto rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Trophy className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-white text-sm">Live Scoreboard</h3>
          <p className="text-xs text-zinc-400 leading-normal">
            Synchronized stage rankings and instant post-quiz standings.
          </p>
        </div>
      </div>

      {/* How to Participate - 3 Simple Steps */}
      <div className="mt-12 p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-4">
        <h2 className="text-base font-semibold text-white text-center">
          How to Participate
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
            <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div>
              <div className="font-semibold text-zinc-200">Sign In</div>
              <div className="text-zinc-400 mt-0.5">
                Enter your student ID to join the waiting lobby.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
            <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div>
              <div className="font-semibold text-zinc-200">Answer Questions</div>
              <div className="text-zinc-400 mt-0.5">
                Questions appear on screen with a 20s countdown.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/60">
            <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <div>
              <div className="font-semibold text-zinc-200">View Rankings</div>
              <div className="text-zinc-400 mt-0.5">
                Check final rankings and download your certificate.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-8">
        <Link
          href="/lobby"
          className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-orange-500/40 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-mono text-zinc-400">Contestants</div>
            <div className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">
              Participant Lobby
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          href="/projector"
          target="_blank"
          className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-cyan-500/40 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-mono text-zinc-400">Auditorium</div>
            <div className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
              Stage Projector
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </Link>

        <Link
          href="/download"
          className="group p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/40 transition-colors flex items-center justify-between"
        >
          <div>
            <div className="text-xs font-mono text-zinc-400">Certificates</div>
            <div className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors">
              Claim Certificate
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </div>
  );
}
