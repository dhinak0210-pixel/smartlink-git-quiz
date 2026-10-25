'use client';

import React, { useState, useEffect } from 'react';
import { useQuizState } from '@/hooks/useQuizState';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useClockSync } from '@/hooks/useClockSync';
import { computeTimerState } from '@/lib/quiz/timer';
import { LeaderboardProjector } from '@/components/leaderboard/LeaderboardProjector';
import { GitBranch, Trophy, Radio, Timer as TimerIcon, Award } from 'lucide-react';
import { SafeQuestion } from '@/lib/utils/types';

export default function ProjectorPage() {
  const { eventState, refetch } = useQuizState(2500);
  const { data: leaderboardData } = useLeaderboard(3000, true);
  const { offsetMs } = useClockSync();

  const [currentQuestion, setCurrentQuestion] = useState<SafeQuestion | null>(null);
  const [timerState, setTimerState] = useState({
    remainingSeconds: 30,
    remainingFraction: 1,
    isExpired: false,
    timeTakenMs: 0,
  });

  // Calculate timer for projector view
  useEffect(() => {
    const interval = setInterval(() => {
      if (eventState && eventState.question_started_at) {
        const state = computeTimerState(
          eventState.question_started_at,
          eventState.time_per_question_seconds,
          offsetMs
        );
        setTimerState(state);
      }
    }, 150);
    return () => clearInterval(interval);
  }, [eventState, offsetMs]);

  // Fetch question details for projector display
  useEffect(() => {
    async function fetchQ() {
      if (!eventState || eventState.current_question_number <= 0) return;
      try {
        const res = await fetch('/api/question/current');
        if (res.ok) {
          const q = await res.json();
          setCurrentQuestion(q);
        }
      } catch {
        // Ignore
      }
    }
    fetchQ();
  }, [eventState?.current_question_number]);

  const isLive = eventState?.status === 'live';
  const isFinished = eventState?.status === 'finished';
  const showQuestionPrompt = isLive && eventState?.current_question_number > 0 && currentQuestion;

  return (
    <div className="min-h-screen bg-background text-text p-6 sm:p-10 flex flex-col justify-between selection:bg-git-orange/30">
      {/* Top Projector Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-git-orange/15 border border-git-orange/30 flex items-center justify-center text-git-orange">
            <GitBranch className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-text">
              SmartLink <span className="text-git-orange">Git Quiz</span>
            </h1>
            <p className="font-mono text-xs text-text-muted">Live Arena Spectator Broadcast</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {eventState && (
            <div className="flex items-center gap-2 bg-surface px-4 py-2 rounded-2xl border border-surface-border font-mono text-sm">
              <Radio
                className={`w-4 h-4 ${
                  isLive ? 'text-correct animate-pulse' : 'text-warning'
                }`}
              />
              <span className="font-bold text-text uppercase">
                {isLive
                  ? `Question ${eventState.current_question_number} / ${eventState.total_questions}`
                  : eventState.status.toUpperCase()}
              </span>
            </div>
          )}

          {isLive && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono text-sm font-extrabold ${
                timerState.remainingSeconds <= 5
                  ? 'border-wrong bg-wrong/20 text-wrong animate-pulse'
                  : 'border-git-orange bg-git-orange/15 text-git-orange'
              }`}
            >
              <TimerIcon className="w-4 h-4" />
              <span>{timerState.isExpired ? '0s' : `${timerState.remainingSeconds}s`}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <a
              href="/admin/dashboard"
              className="px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-text hover:border-git-orange text-xs font-mono transition"
              title="Return to Admin Dashboard"
            >
              Admin Center
            </a>
            <a
              href="/"
              className="px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-text text-xs font-mono transition"
              title="Return to Portal"
            >
              Portal ✕
            </a>
          </div>
        </div>
      </div>

      {/* Main Broadcast Center */}
      <div className="my-8 flex-1 flex flex-col justify-center">
        {showQuestionPrompt ? (
          <div className="max-w-4xl mx-auto w-full space-y-8 animate-in fade-in">
            {/* Big Question Card */}
            <div className="rounded-3xl border-2 border-surface-border bg-surface/90 p-8 sm:p-12 shadow-2xl text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background border border-surface-border font-mono text-xs text-git-orange">
                <span>#{currentQuestion.topic_tag}</span>
                <span>•</span>
                <span className="capitalize">{currentQuestion.difficulty}</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-text font-sans leading-tight">
                {currentQuestion.question_text}
              </h2>
            </div>

            {/* 4 Options Grid (No answers highlighted during question) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {currentQuestion.options.map((opt) => (
                <div
                  key={opt.label}
                  className="p-5 sm:p-6 rounded-2xl border-2 border-surface-border bg-surface/70 flex items-center gap-4 text-base sm:text-xl font-medium text-text"
                >
                  <span className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-surface-border bg-background text-git-orange flex items-center justify-center font-mono font-bold uppercase shrink-0">
                    {opt.label}
                  </span>
                  <span>{opt.text}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <LeaderboardProjector
            entries={leaderboardData?.leaderboard || []}
            isFinished={isFinished}
          />
        )}
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-surface-border pt-4 flex items-center justify-between font-mono text-xs text-text-muted">
        <span>smartlink-git-quiz.vercel.app</span>
        <span>{leaderboardData?.total_participants || 0} Connected Contestants</span>
      </div>
    </div>
  );
}
