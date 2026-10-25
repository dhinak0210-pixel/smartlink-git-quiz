'use client';

import React from 'react';
import Link from 'next/link';
import { useQuizState } from '@/hooks/useQuizState';
import { EventControl } from '@/components/admin/EventControl';
import { ArrowLeft, Tv, Users, Eye } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AdminEventControlPage() {
  const { eventState, refetch, isLoading } = useQuizState(2000);

  if (isLoading || !eventState) {
    return <LoadingSpinner label="Connecting to Arena event telemetry..." />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 space-y-6">
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-text text-xs font-mono flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold text-text font-mono">Live Event Conductor</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/monitor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-surface-border text-xs font-mono text-text hover:bg-surface-hover transition"
          >
            <Eye className="w-3.5 h-3.5 text-git-orange" />
            <span>Monitor Grid</span>
          </Link>
          <Link
            href="/projector"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-git-orange/15 border border-git-orange/30 text-git-orange text-xs font-mono hover:bg-git-orange/20 transition"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Projector</span>
          </Link>
        </div>
      </div>

      <EventControl eventState={eventState} onRefresh={refetch} />
    </div>
  );
}
