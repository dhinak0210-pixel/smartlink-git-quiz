'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { StudentMonitor } from '@/components/admin/StudentMonitor';
import { CheatAlerts } from '@/components/admin/CheatAlerts';
import { ArrowLeft, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export default function AdminMonitorPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'grid' | 'alerts'>('grid');

  const fetchTelemetry = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/students');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000); // 3s telemetry poll
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  const handleBan = async (studentId: string) => {
    try {
      await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, is_banned: true }),
      });
      fetchTelemetry();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 space-y-6">
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-surface border border-surface-border text-text-muted hover:text-text text-xs font-mono flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <h1 className="text-xl font-bold text-text font-mono">Live Arena Monitor</h1>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-surface-border">
          <button
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
              activeTab === 'grid'
                ? 'bg-git-orange text-white font-bold shadow'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Participant Grid</span>
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition ${
              activeTab === 'alerts'
                ? 'bg-wrong text-white font-bold shadow'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Cheat Alerts</span>
          </button>
        </div>
      </div>

      {loading && !data ? (
        <LoadingSpinner label="Polling live arena telemetry..." />
      ) : activeTab === 'grid' ? (
        <StudentMonitor
          students={data?.students || []}
          totalStudents={data?.total_students || 0}
          activeQuestion={data?.active_question || 0}
          answeredCurrentCount={data?.answered_current_count || 0}
          liveSummary={data?.live_summary}
          recentEvents={data?.recent_events || []}
          quizStatus={data?.quiz_status || 'waiting'}
          onRefresh={fetchTelemetry}
        />
      ) : (
        <CheatAlerts
          reports={data?.cheat_reports || []}
          onBanStudent={handleBan}
        />
      )}
    </div>
  );
}
