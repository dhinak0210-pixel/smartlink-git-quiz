'use client';

import React, { useState } from 'react';
import { Play, SkipForward, Pause, Square, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { EventStatusResponse } from '@/lib/utils/types';

interface EventControlProps {
  eventState: EventStatusResponse;
  onRefresh: () => void;
}

export function EventControl({ eventState, onRefresh }: EventControlProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const executeAction = async (endpoint: string, actionName: string) => {
    setLoadingAction(actionName);
    setMessage(null);
    try {
      const res = await fetch(`/api/event/${endpoint}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setMessage(data.message || `Action ${actionName} successful`);
      onRefresh();
    } catch (err: any) {
      alert(`Error executing ${actionName}: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const isLive = eventState.status === 'live';
  const isPaused = eventState.status === 'paused';
  const isFinished = eventState.status === 'finished';
  const isDraftOrLobby = eventState.status === 'draft' || eventState.status === 'lobby';

  return (
    <div className="rounded-2xl border border-surface-border bg-surface p-6 space-y-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text font-mono">Live Event Operations</h2>
          <p className="text-xs text-text-muted mt-0.5">Control state transitions and question pacing</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">Status:</span>
          <span
            className={`px-3 py-1 rounded-full font-mono text-xs font-bold uppercase tracking-wider ${
              isLive
                ? 'bg-correct/15 text-correct border border-correct/30'
                : isPaused
                ? 'bg-warning/15 text-warning border border-warning/30'
                : isFinished
                ? 'bg-text-muted/15 text-text-muted border border-text-muted/30'
                : 'bg-git-orange/15 text-git-orange border border-git-orange/30'
            }`}
          >
            {eventState.status}
          </span>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-correct/10 border border-correct/30 text-correct text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* START QUIZ */}
        <button
          type="button"
          disabled={loadingAction !== null || isLive || isFinished}
          onClick={() => executeAction('start', 'Start')}
          className="p-4 rounded-xl bg-correct hover:bg-correct/90 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 shadow-lg shadow-correct/20"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{loadingAction === 'Start' ? 'Starting...' : 'Start Quiz'}</span>
        </button>

        {/* NEXT QUESTION */}
        <button
          type="button"
          disabled={loadingAction !== null || !isLive || isFinished}
          onClick={() => executeAction('next', 'Next Question')}
          className="p-4 rounded-xl bg-git-orange hover:bg-git-dark text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 shadow-lg shadow-git-orange/20"
        >
          <SkipForward className="w-4 h-4" />
          <span>{loadingAction === 'Next Question' ? 'Advancing...' : 'Next Question'}</span>
        </button>

        {/* PAUSE / RESUME */}
        <button
          type="button"
          disabled={loadingAction !== null || (!isLive && !isPaused)}
          onClick={() => executeAction('pause', 'Pause Toggle')}
          className="p-4 rounded-xl bg-warning hover:bg-warning/90 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 shadow-lg shadow-warning/20"
        >
          <Pause className="w-4 h-4 fill-current" />
          <span>{isPaused ? 'Resume Quiz' : 'Emergency Pause'}</span>
        </button>

        {/* END QUIZ */}
        <button
          type="button"
          disabled={loadingAction !== null || isFinished}
          onClick={() => {
            if (confirm('Are you sure you want to conclude the quiz event?')) {
              executeAction('end', 'End Event');
            }
          }}
          className="p-4 rounded-xl bg-wrong hover:bg-wrong/90 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 shadow-lg shadow-wrong/20"
        >
          <Square className="w-4 h-4 fill-current" />
          <span>{loadingAction === 'End Event' ? 'Ending...' : 'End Quiz'}</span>
        </button>
      </div>

      {/* Emergency Fallback Banner */}
      <div className="p-4 rounded-xl bg-background border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-warning">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>Emergency Catastrophe Recovery:</span>
        </div>
        <a
          href="https://forms.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-git-orange hover:underline font-bold"
        >
          Launch Prepared Google Forms Quiz Mode (Deploy in &lt;2 min) →
        </a>
      </div>
    </div>
  );
}
