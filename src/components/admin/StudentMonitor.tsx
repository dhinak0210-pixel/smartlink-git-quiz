'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Ban,
  CheckCircle,
  Search,
  ShieldAlert,
  Radio,
  Clock,
  Eye,
  AlertTriangle,
  RefreshCw,
  Activity,
  CheckCircle2,
  XCircle,
  LogOut,
  LayoutGrid,
  List,
  Sparkles,
  Zap,
} from 'lucide-react';

export interface EnrichedStudent {
  id: string;
  name: string;
  college_id: string;
  email?: string;
  register_no?: string;
  is_banned: boolean;
  logged_in_at: string;
  status: string;
  condition?: string;
  condition_label?: string;
  is_online?: boolean;
  is_in_quiz?: boolean;
  is_tab_focused?: boolean;
  page?: string;
  current_question?: number;
  is_answered_current?: boolean;
  answered_count: number;
  total_score?: number;
  risk_level: 'low' | 'medium' | 'high';
  cheat_flags: string[];
  tab_switches: number;
  last_seen_seconds_ago?: number | null;
  last_seen_at?: string | null;
}

export interface LiveSummary {
  total: number;
  in_quiz: number;
  in_quiz_tab_hidden: number;
  in_lobby: number;
  offline: number;
  finished: number;
  banned: number;
  locked?: number;
  not_joined?: number;
}

export interface PresenceEventItem {
  id: string;
  studentId: string;
  studentName: string;
  type: string;
  message: string;
  timestamp: number;
}

interface StudentMonitorProps {
  students: EnrichedStudent[];
  totalStudents: number;
  activeQuestion: number;
  answeredCurrentCount: number;
  liveSummary?: LiveSummary;
  recentEvents?: PresenceEventItem[];
  quizStatus?: string;
  onRefresh: () => void;
}

type FilterCondition =
  | 'all'
  | 'in_quiz'
  | 'tab_hidden'
  | 'in_lobby'
  | 'offline'
  | 'finished'
  | 'banned';

export function StudentMonitor({
  students,
  totalStudents,
  activeQuestion,
  answeredCurrentCount,
  liveSummary,
  recentEvents = [],
  quizStatus = 'waiting',
  onRefresh,
}: StudentMonitorProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCondition>('all');
  const [sortBy, setSortBy] = useState<'condition' | 'tab_switches' | 'answered' | 'score' | 'name'>('condition');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [banningId, setBanningId] = useState<string | null>(null);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [showEventFeed, setShowEventFeed] = useState(true);

  // Fallback calculation for summary if not supplied directly
  const summary: LiveSummary = useMemo(() => {
    if (liveSummary) return liveSummary;
    const s: LiveSummary = {
      total: students.length,
      in_quiz: 0,
      in_quiz_tab_hidden: 0,
      in_lobby: 0,
      offline: 0,
      finished: 0,
      banned: 0,
    };
    for (const student of students) {
      if (student.is_banned) s.banned++;
      else if (student.condition === 'in_quiz_tab_hidden') s.in_quiz_tab_hidden++;
      else if (student.condition === 'in_quiz' || student.is_in_quiz) s.in_quiz++;
      else if (student.condition === 'in_lobby') s.in_lobby++;
      else if (student.condition === 'finished') s.finished++;
      else s.offline++;
    }
    return s;
  }, [liveSummary, students]);

  const handleToggleBan = async (studentId: string, currentBanned: boolean) => {
    if (
      !confirm(
        currentBanned
          ? 'Re-admit contestant to tournament?'
          : 'Disqualify and ban this contestant immediately?'
      )
    )
      return;

    setBanningId(studentId);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, is_banned: !currentBanned }),
      });
      if (!res.ok) throw new Error('Ban status change failed');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBanningId(null);
    }
  };

  const handleKickSession = async (studentId: string) => {
    if (!confirm('Kick and reset this participant session? They will need to reconnect.')) return;
    setKickingId(studentId);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kick', studentId }),
      });
      if (!res.ok) throw new Error('Kick failed');
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setKickingId(null);
    }
  };

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        // Search filter
        const matchSearch =
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.college_id && s.college_id.toLowerCase().includes(search.toLowerCase())) ||
          (s.register_no && s.register_no.toLowerCase().includes(search.toLowerCase())) ||
          (s.email && s.email.toLowerCase().includes(search.toLowerCase()));

        if (!matchSearch) return false;

        // Condition filter
        if (filter === 'all') return true;
        if (filter === 'in_quiz') return s.condition === 'in_quiz' || (s.is_in_quiz && s.is_tab_focused);
        if (filter === 'tab_hidden') return s.condition === 'in_quiz_tab_hidden' || (s.is_in_quiz && !s.is_tab_focused);
        if (filter === 'in_lobby') return s.condition === 'in_lobby';
        if (filter === 'finished') return s.condition === 'finished';
        if (filter === 'offline') return s.condition === 'offline' || (!s.is_online && !s.is_banned);
        if (filter === 'banned') return s.is_banned;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'condition') {
          // Priority: tab_hidden (alerts) -> in_quiz -> in_lobby -> finished -> offline -> banned
          const getPriority = (item: EnrichedStudent) => {
            if (item.is_banned) return 6;
            if (item.condition === 'in_quiz_tab_hidden' || (!item.is_tab_focused && item.is_in_quiz)) return 1;
            if (item.condition === 'in_quiz' || item.is_in_quiz) return 2;
            if (item.condition === 'in_lobby') return 3;
            if (item.condition === 'finished') return 4;
            return 5;
          };
          const pA = getPriority(a);
          const pB = getPriority(b);
          if (pA !== pB) return pA - pB;
          return a.name.localeCompare(b.name);
        }
        if (sortBy === 'tab_switches') {
          return b.tab_switches - a.tab_switches;
        }
        if (sortBy === 'answered') {
          return b.answered_count - a.answered_count;
        }
        if (sortBy === 'score') {
          return (b.total_score || 0) - (a.total_score || 0);
        }
        return a.name.localeCompare(b.name);
      });
  }, [students, search, filter, sortBy]);

  const responseRate = totalStudents > 0 ? Math.round((answeredCurrentCount / totalStudents) * 100) : 0;
  const inQuizTotal = summary.in_quiz + summary.in_quiz_tab_hidden;

  return (
    <div className="space-y-6">
      {/* Live Indicator Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping absolute opacity-75" />
            <span className="w-3 h-3 rounded-full bg-emerald-500 relative" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold font-mono text-zinc-100">
                Participant Condition Telemetry
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono uppercase tracking-wider font-semibold">
                Live Pulse Active
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Watching live engagement, tab switches, and quiz status for {totalStudents} contestants.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono border border-zinc-700/60 flex items-center gap-1.5 transition active:scale-95"
            title="Poll fresh condition data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Poll Now</span>
          </button>
          <button
            onClick={() => setShowEventFeed(!showEventFeed)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition flex items-center gap-1.5 ${
              showEventFeed
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                : 'bg-zinc-800 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activity Feed</span>
          </button>
        </div>
      </div>

      {/* Primary Condition Counters (Interactive Filter Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total In Quiz */}
        <button
          onClick={() => setFilter(filter === 'in_quiz' ? 'all' : 'in_quiz')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            filter === 'in_quiz'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg'
              : 'bg-zinc-900/90 border-zinc-800/80 hover:border-emerald-500/50 hover:bg-zinc-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">In Quiz Now</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{inQuizTotal}</p>
          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
            {summary.in_quiz} active in tab
          </span>
        </button>

        {/* Tab Hidden / Warning */}
        <button
          onClick={() => setFilter(filter === 'tab_hidden' ? 'all' : 'tab_hidden')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            filter === 'tab_hidden'
              ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30 shadow-lg'
              : 'bg-zinc-900/90 border-zinc-800/80 hover:border-amber-500/50 hover:bg-zinc-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Tab Away</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${summary.in_quiz_tab_hidden > 0 ? 'text-amber-400 animate-bounce' : 'text-zinc-500'}`} />
          </div>
          <p className={`text-2xl font-bold font-mono mt-1 ${summary.in_quiz_tab_hidden > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
            {summary.in_quiz_tab_hidden}
          </p>
          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">Left quiz window</span>
        </button>

        {/* In Lobby */}
        <button
          onClick={() => setFilter(filter === 'in_lobby' ? 'all' : 'in_lobby')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            filter === 'in_lobby'
              ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 shadow-lg'
              : 'bg-zinc-900/90 border-zinc-800/80 hover:border-blue-500/50 hover:bg-zinc-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">In Lobby</span>
            <Clock className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-blue-400 mt-1">{summary.in_lobby}</p>
          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">Waiting for start</span>
        </button>

        {/* Finished */}
        <button
          onClick={() => setFilter(filter === 'finished' ? 'all' : 'finished')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            filter === 'finished'
              ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30 shadow-lg'
              : 'bg-zinc-900/90 border-zinc-800/80 hover:border-purple-500/50 hover:bg-zinc-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Finished</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-purple-400 mt-1">{summary.finished}</p>
          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">Completed quiz</span>
        </button>

        {/* Offline */}
        <button
          onClick={() => setFilter(filter === 'offline' ? 'all' : 'offline')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
            filter === 'offline'
              ? 'bg-zinc-800/80 border-zinc-500 ring-2 ring-zinc-500/30 shadow-lg'
              : 'bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-600 hover:bg-zinc-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Offline</span>
            <XCircle className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-zinc-300 mt-1">{summary.offline}</p>
          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">No signal &gt;35s</span>
        </button>

        {/* Q# Active Response Rate */}
        <div className="p-3.5 rounded-2xl border border-zinc-800/80 bg-zinc-900/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Q#{activeQuestion || 1} Rate</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{responseRate}%</p>
          <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
            {answeredCurrentCount} answered
          </span>
        </div>
      </div>

      {/* Live Activity Stream (Collapsible) */}
      {showEventFeed && recentEvents.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-inner">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-mono font-bold text-zinc-300 uppercase">Live Proctor Activity Stream</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Last {recentEvents.length} events</span>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
            {recentEvents.slice(0, 6).map((evt) => (
              <div
                key={evt.id}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-zinc-950/80 border border-zinc-800/90 text-xs font-mono flex items-center gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    evt.type === 'left_quiz_tab'
                      ? 'bg-amber-400 animate-ping'
                      : evt.type === 'joined_quiz'
                      ? 'bg-emerald-400'
                      : evt.type === 'finished_quiz'
                      ? 'bg-purple-400'
                      : 'bg-blue-400'
                  }`}
                />
                <span className="text-zinc-200 font-medium truncate max-w-[200px]">{evt.message}</span>
                <span className="text-[10px] text-zinc-400">
                  {Math.round((Date.now() - evt.timestamp) / 1000)}s ago
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contestant by name, roll number, or email..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 pl-10 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-git-orange focus:ring-1 focus:ring-git-orange"
          />
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
        </div>

        {/* View Mode & Sorters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filter Pills */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === 'all' ? 'bg-git-orange text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({students.length})
            </button>
            <button
              onClick={() => setFilter('in_quiz')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                filter === 'in_quiz' ? 'bg-emerald-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Quiz ({inQuizTotal})
            </button>
            <button
              onClick={() => setFilter('tab_hidden')}
              className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                filter === 'tab_hidden' ? 'bg-amber-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Away ({summary.in_quiz_tab_hidden})
            </button>
            <button
              onClick={() => setFilter('in_lobby')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === 'in_lobby' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Lobby ({summary.in_lobby})
            </button>
            <button
              onClick={() => setFilter('offline')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filter === 'offline' ? 'bg-zinc-700 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Offline ({summary.offline})
            </button>
          </div>

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-git-orange"
          >
            <option value="condition">Sort: In-Quiz Priority</option>
            <option value="tab_switches">Sort: Most Tab Switches</option>
            <option value="answered">Sort: Most Answered</option>
            <option value="score">Sort: Highest Score</option>
            <option value="name">Sort: Name (A-Z)</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Participant List (Filtered) */}
      {filteredStudents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-zinc-800 bg-zinc-900/40 space-y-3">
          <Users className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold font-mono text-zinc-300">No participants match the current filter</h3>
          <p className="text-xs text-zinc-500 font-mono">
            Try clearing the search query or switching to &quot;All&quot; condition tab.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setFilter('all');
            }}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-mono hover:bg-zinc-700 transition"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredStudents.map((student) => {
            const isTabHidden = student.condition === 'in_quiz_tab_hidden' || (student.is_in_quiz && !student.is_tab_focused);
            const isInQuiz = (student.condition === 'in_quiz' || student.is_in_quiz) && !isTabHidden;
            const isInLobby = student.condition === 'in_lobby';
            const isFinished = student.condition === 'finished';
            const isOffline = student.condition === 'offline' || (!student.is_online && !student.is_banned);

            return (
              <div
                key={student.id}
                className={`p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                  student.is_banned
                    ? 'border-red-900/40 bg-red-950/10 opacity-60'
                    : isTabHidden
                    ? 'border-amber-500/50 bg-amber-950/20 shadow-md ring-1 ring-amber-500/30'
                    : isInQuiz
                    ? 'border-emerald-500/40 bg-emerald-950/15 shadow-sm'
                    : isInLobby
                    ? 'border-blue-500/30 bg-blue-950/15'
                    : isFinished
                    ? 'border-purple-500/30 bg-purple-950/15'
                    : 'border-zinc-800/80 bg-zinc-900/60'
                }`}
              >
                {/* Header: Name, Reg No & Condition Tag */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-zinc-100 truncate font-sans">
                          {student.name}
                        </span>
                        {student.is_banned ? (
                          <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider">
                            Banned
                          </span>
                        ) : isTabHidden ? (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 animate-pulse font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Tab Hidden
                          </span>
                        ) : isInQuiz ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-mono flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            In Quiz (Q#{student.current_question || activeQuestion || 1})
                          </span>
                        ) : isInLobby ? (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full font-mono">
                            In Lobby
                          </span>
                        ) : isFinished ? (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-mono">
                            Finished Quiz
                          </span>
                        ) : (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                            Offline
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-zinc-400 block mt-0.5">
                        {student.college_id || student.register_no}
                      </span>
                    </div>

                    {/* Quick Ban Toggle */}
                    <button
                      type="button"
                      disabled={banningId === student.id}
                      onClick={() => handleToggleBan(student.id, student.is_banned)}
                      className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition ${
                        student.is_banned
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                      }`}
                    >
                      {student.is_banned ? 'Unban' : 'Ban'}
                    </button>
                  </div>

                  {/* Real-time telemetry indicators */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/60">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Quiz Progress</span>
                      <span className="text-zinc-200 font-bold">
                        {student.answered_count} / 15 answered
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Current Status</span>
                      <span
                        className={`font-semibold ${
                          student.is_answered_current
                            ? 'text-emerald-400'
                            : isInQuiz
                            ? 'text-amber-300'
                            : 'text-zinc-400'
                        }`}
                      >
                        {student.is_answered_current
                          ? `Answered Q#${student.current_question || activeQuestion}`
                          : isInQuiz
                          ? `Answering Q#${student.current_question || activeQuestion}...`
                          : isInLobby
                          ? 'In Waiting Lobby'
                          : isFinished
                          ? 'All Submitted'
                          : 'Not in Arena'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Tab switches, risk flag, kick session */}
                <div className="mt-3 pt-2.5 border-t border-zinc-800/70 flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2">
                    {student.tab_switches > 0 ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        {student.tab_switches} switch{student.tab_switches > 1 ? 'es' : ''}
                      </span>
                    ) : (
                      <span className="text-zinc-500">0 tab switches</span>
                    )}

                    {student.total_score !== undefined && student.total_score > 0 && (
                      <span className="text-zinc-300 font-bold">{student.total_score} pts</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {student.last_seen_seconds_ago !== undefined && student.last_seen_seconds_ago !== null && (
                      <span className="text-[10px] text-zinc-500">
                        {student.last_seen_seconds_ago < 60
                          ? `${student.last_seen_seconds_ago}s ago`
                          : `${Math.round(student.last_seen_seconds_ago / 60)}m ago`}
                      </span>
                    )}

                    {!student.is_banned && (
                      <button
                        onClick={() => handleKickSession(student.id)}
                        disabled={kickingId === student.id}
                        className="text-[10px] text-zinc-400 hover:text-zinc-200 p-1 hover:bg-zinc-800 rounded transition"
                        title="Force disconnect / re-sync session"
                      >
                        <LogOut className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Dense monitor mode for proctors) */
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/60 shadow-xl">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/70 text-zinc-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Contestant</th>
                <th className="py-3 px-3">Live Condition</th>
                <th className="py-3 px-3">Tab Focus</th>
                <th className="py-3 px-3">Active Question</th>
                <th className="py-3 px-3">Progress</th>
                <th className="py-3 px-3">Score</th>
                <th className="py-3 px-3">Tab Switches</th>
                <th className="py-3 px-3">Last Ping</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
              {filteredStudents.map((s) => {
                const isTabHidden = s.condition === 'in_quiz_tab_hidden' || (s.is_in_quiz && !s.is_tab_focused);
                const isInQuiz = (s.condition === 'in_quiz' || s.is_in_quiz) && !isTabHidden;
                const isInLobby = s.condition === 'in_lobby';
                const isFinished = s.condition === 'finished';

                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-zinc-800/40 transition ${
                      s.is_banned
                        ? 'bg-red-950/10 opacity-60'
                        : isTabHidden
                        ? 'bg-amber-950/20'
                        : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-sans font-bold text-zinc-100">{s.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{s.college_id || s.register_no}</div>
                    </td>

                    <td className="py-3 px-3">
                      {s.is_banned ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] uppercase font-bold">
                          Banned
                        </span>
                      ) : isTabHidden ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Tab Hidden / Away
                        </span>
                      ) : isInQuiz ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 w-max">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          In Quiz (Active)
                        </span>
                      ) : isInLobby ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold">
                          In Lobby
                        </span>
                      ) : isFinished ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                          Finished
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px]">
                          Offline
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {isTabHidden ? (
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Background
                        </span>
                      ) : isInQuiz ? (
                        <span className="text-emerald-400 font-medium">Focused</span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {s.is_answered_current ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Answered Q#{s.current_question || activeQuestion}
                        </span>
                      ) : isInQuiz ? (
                        <span className="text-amber-300 font-semibold animate-pulse">
                          Answering Q#{s.current_question || activeQuestion}...
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-zinc-200 font-bold">{s.answered_count} / 15</span>
                    </td>

                    <td className="py-3 px-3 font-bold text-zinc-200">
                      {s.total_score || 0}
                    </td>

                    <td className="py-3 px-3">
                      {s.tab_switches > 0 ? (
                        <span className="text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                          {s.tab_switches}
                        </span>
                      ) : (
                        <span className="text-zinc-500">0</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-[11px] text-zinc-400">
                      {s.last_seen_seconds_ago !== undefined && s.last_seen_seconds_ago !== null
                        ? `${s.last_seen_seconds_ago}s ago`
                        : 'N/A'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleBan(s.id, s.is_banned)}
                          disabled={banningId === s.id}
                          className={`text-[10px] px-2 py-1 rounded border transition ${
                            s.is_banned
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              : 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                          }`}
                        >
                          {s.is_banned ? 'Unban' : 'Ban'}
                        </button>
                        {!s.is_banned && (
                          <button
                            onClick={() => handleKickSession(s.id)}
                            disabled={kickingId === s.id}
                            className="text-[10px] px-2 py-1 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                            title="Kick session"
                          >
                            Kick
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
