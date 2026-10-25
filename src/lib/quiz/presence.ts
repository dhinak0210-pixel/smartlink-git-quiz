// src/lib/quiz/presence.ts
/**
 * Participant Real-Time Presence & Condition Store
 * Keeps high-concurrency, low-latency in-memory tracking of all participants:
 * - Are they in the quiz right now?
 * - Are they in the waiting lobby?
 * - Have they switched away or minimized the quiz tab?
 * - Did they lose connection / go offline?
 * - What question are they currently viewing/answering?
 */

export type ParticipantPage = 'quiz' | 'lobby' | 'practice' | 'final' | 'left' | 'unknown';

export type ParticipantCondition =
  | 'in_quiz'            // Active on /quiz and tab is focused
  | 'in_quiz_tab_hidden' // On /quiz, but tab is blurred/hidden (alert)
  | 'in_lobby'           // In waiting lobby, ready
  | 'in_practice'        // Practicing in sandbox
  | 'finished'           // Completed all questions / reached final screen
  | 'offline'            // Logged in before, but no heartbeat > 35s
  | 'banned'             // Banned / deactivated by organizer
  | 'locked'             // Temporarily locked due to failed attempts
  | 'not_joined';        // Registered, but hasn't logged in

export interface ParticipantPresence {
  studentId: string;
  studentName?: string;
  collegeId?: string;
  email?: string;
  page: ParticipantPage;
  questionNumber: number;
  isTabFocused: boolean;
  tabSwitches: number;
  lastPing: number; // Date.now()
  ip?: string;
  userAgent?: string;
}

export interface PresenceEvent {
  id: string;
  studentId: string;
  studentName: string;
  type: 'joined_quiz' | 'left_quiz_tab' | 'returned_to_tab' | 'joined_lobby' | 'finished_quiz' | 'disconnected';
  message: string;
  timestamp: number;
}

interface GlobalPresenceStore {
  presenceMap: Map<string, ParticipantPresence>;
  events: PresenceEvent[];
}

const globalForPresence = globalThis as unknown as { __smartlink_presence?: GlobalPresenceStore };

if (!globalForPresence.__smartlink_presence) {
  globalForPresence.__smartlink_presence = {
    presenceMap: new Map(),
    events: [],
  };
}

const store = globalForPresence.__smartlink_presence;

export function recordPresence(
  studentId: string,
  data: Partial<ParticipantPresence> & { studentName?: string; collegeId?: string }
): ParticipantPresence {
  const existing = store.presenceMap.get(studentId);
  const now = Date.now();

  const prevFocused = existing ? existing.isTabFocused : true;
  const prevPage = existing ? existing.page : 'unknown';

  const updated: ParticipantPresence = {
    studentId,
    studentName: data.studentName || existing?.studentName,
    collegeId: data.collegeId || existing?.collegeId,
    email: data.email || existing?.email,
    page: data.page || existing?.page || 'unknown',
    questionNumber: data.questionNumber !== undefined ? data.questionNumber : (existing?.questionNumber || 0),
    isTabFocused: data.isTabFocused !== undefined ? data.isTabFocused : (existing?.isTabFocused ?? true),
    tabSwitches: data.tabSwitches !== undefined ? data.tabSwitches : (existing?.tabSwitches || 0),
    lastPing: now,
    ip: data.ip || existing?.ip,
    userAgent: data.userAgent || existing?.userAgent,
  };

  store.presenceMap.set(studentId, updated);

  // Auto-generate activity events for proctors
  const name = updated.studentName || updated.collegeId || 'Participant';
  if (updated.page === 'quiz' && prevPage !== 'quiz') {
    addPresenceEvent({
      id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      studentName: name,
      type: 'joined_quiz',
      message: `${name} entered the live quiz arena`,
      timestamp: now,
    });
  } else if (updated.page === 'quiz' && prevFocused && !updated.isTabFocused) {
    addPresenceEvent({
      id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      studentName: name,
      type: 'left_quiz_tab',
      message: `${name} switched tab / blurred window (Tab Switch #${updated.tabSwitches})`,
      timestamp: now,
    });
  } else if (updated.page === 'quiz' && !prevFocused && updated.isTabFocused) {
    addPresenceEvent({
      id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      studentName: name,
      type: 'returned_to_tab',
      message: `${name} returned focus to quiz tab`,
      timestamp: now,
    });
  } else if (updated.page === 'lobby' && prevPage !== 'lobby') {
    addPresenceEvent({
      id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      studentName: name,
      type: 'joined_lobby',
      message: `${name} joined the waiting lobby`,
      timestamp: now,
    });
  } else if (updated.page === 'final' && prevPage !== 'final') {
    addPresenceEvent({
      id: `evt-${now}-${Math.random().toString(36).slice(2, 6)}`,
      studentId,
      studentName: name,
      type: 'finished_quiz',
      message: `${name} completed the quiz competition`,
      timestamp: now,
    });
  }

  return updated;
}

export function getPresence(studentId: string): ParticipantPresence | undefined {
  return store.presenceMap.get(studentId);
}

export function getAllPresence(): ParticipantPresence[] {
  return Array.from(store.presenceMap.values());
}

export function addPresenceEvent(event: PresenceEvent): void {
  store.events.unshift(event);
  if (store.events.length > 50) {
    store.events.length = 50; // Keep 50 recent events
  }
}

export function getRecentPresenceEvents(limit = 15): PresenceEvent[] {
  return store.events.slice(0, limit);
}

/**
 * Derives the exact condition of a student based on real-time presence and account status.
 */
export function determineCondition(
  student: {
    status?: string;
    is_active?: boolean;
    is_banned?: boolean;
    locked_until?: string | null;
  },
  presence?: ParticipantPresence,
  offlineThresholdMs = 35_000
): {
  condition: ParticipantCondition;
  label: string;
  isOnline: boolean;
  secondsAgo: number | null;
} {
  const now = Date.now();
  const isBanned = student.is_banned || student.status === 'deactivated' || student.is_active === false;

  if (isBanned) {
    return {
      condition: 'banned',
      label: 'Banned / Disqualified',
      isOnline: false,
      secondsAgo: presence ? Math.round((now - presence.lastPing) / 1000) : null,
    };
  }

  if (student.locked_until && new Date(student.locked_until) > new Date()) {
    return {
      condition: 'locked',
      label: 'Account Locked',
      isOnline: false,
      secondsAgo: presence ? Math.round((now - presence.lastPing) / 1000) : null,
    };
  }

  if (!presence) {
    if (student.status === 'registered') {
      return { condition: 'not_joined', label: 'Not Logged In', isOnline: false, secondsAgo: null };
    }
    return { condition: 'offline', label: 'Offline / Disconnected', isOnline: false, secondsAgo: null };
  }

  const secondsAgo = Math.round((now - presence.lastPing) / 1000);
  const isOnline = now - presence.lastPing <= offlineThresholdMs;

  if (!isOnline || presence.page === 'left') {
    return {
      condition: 'offline',
      label: `Offline (Seen ${secondsAgo}s ago)`,
      isOnline: false,
      secondsAgo,
    };
  }

  if (presence.page === 'quiz') {
    if (!presence.isTabFocused) {
      return {
        condition: 'in_quiz_tab_hidden',
        label: 'In Quiz (Tab Hidden / Away)',
        isOnline: true,
        secondsAgo,
      };
    }
    return {
      condition: 'in_quiz',
      label: `In Quiz (Q#${presence.questionNumber || 1})`,
      isOnline: true,
      secondsAgo,
    };
  }

  if (presence.page === 'lobby') {
    return {
      condition: 'in_lobby',
      label: 'In Waiting Lobby',
      isOnline: true,
      secondsAgo,
    };
  }

  if (presence.page === 'final') {
    return {
      condition: 'finished',
      label: 'Completed Quiz',
      isOnline: true,
      secondsAgo,
    };
  }

  if (presence.page === 'practice') {
    return {
      condition: 'in_practice',
      label: 'In Practice Arena',
      isOnline: true,
      secondsAgo,
    };
  }

  return {
    condition: 'in_quiz',
    label: 'Online',
    isOnline: true,
    secondsAgo,
  };
}
