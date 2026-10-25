'use client';

import React from 'react';
import { GitPullRequest, Users, ShieldAlert, Zap, Timer, Award } from 'lucide-react';
import { EventStatusResponse } from '@/lib/utils/types';

interface LobbyScreenProps {
  studentName?: string;
  collegeId?: string;
  eventState: EventStatusResponse | null;
}

export function LobbyScreen({ studentName, collegeId, eventState }: LobbyScreenProps) {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Top Waiting Banner */}
      <div className="rounded-2xl border border-surface-border bg-surface/90 p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-git-orange to-transparent" />

        {/* Pulsing Git Icon */}
        <div className="w-16 h-16 rounded-2xl bg-git-orange/10 border border-git-orange/30 flex items-center justify-center text-git-orange mx-auto mb-4 animate-bounce-subtle">
          <GitPullRequest className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-text font-sans">
          Arena Lobby: Waiting for Quiz Master
        </h1>
        <p className="text-sm text-text-muted mt-2 max-w-md mx-auto">
          The live quiz session will begin automatically as soon as the administrator initiates the first question.
        </p>

        {/* Student Credential Badge */}
        <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 px-4 py-2 rounded-xl bg-background border border-surface-border font-mono text-xs">
          <span className="text-text-muted">Participant:</span>
          <span className="text-git-orange font-bold">{studentName || 'Student'}</span>
          <span className="text-surface-border">•</span>
          <span className="text-text font-medium">{collegeId || 'ID'}</span>
        </div>

        {/* Live Counter */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs font-mono text-text-muted">
          <Users className="w-4 h-4 text-git-orange" />
          <span>
            <strong className="text-text font-bold">{eventState?.students_joined ?? 1}</strong> peers joined the lobby
          </span>
        </div>
      </div>

      {/* Rules & Guidelines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-border bg-surface/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-git-orange font-mono text-xs font-bold">
            <Timer className="w-4 h-4" />
            <span>EXAM SCORING & SPEED BONUS</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Correct answers earn 100% to 50% points based on speed. Active incorrect answers receive a <strong className="text-wrong">-25 point penalty</strong> to discourage guessing. Timeouts receive 0 points.
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-git-orange font-mono text-xs font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>ACTIVE ANTI-CHEAT</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Tab switches, window blurs, and copy shortcuts are monitored server-side. Options are randomly shuffled per student.
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-git-orange font-mono text-xs font-bold">
            <Zap className="w-4 h-4" />
            <span>ONE ATTEMPT PER QUESTION</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Once submitted, your answer is locked. In case of network drop, you can refresh or rejoin without losing previous points.
          </p>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-git-orange font-mono text-xs font-bold">
            <Award className="w-4 h-4" />
            <span>AI REPORT & CERTIFICATE</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Official verifiable PDF certificates and AI-driven Git performance reports will be generated immediately after the event.
          </p>
        </div>
      </div>
    </div>
  );
}
