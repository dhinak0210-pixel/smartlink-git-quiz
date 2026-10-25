import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Student, Event, Question, Answer, AntiCheatLog, LeaderboardEntry } from '@/lib/utils/types';
import { DEFAULT_EVENT_ID, SEED_GIT_QUESTIONS } from '@/lib/utils/constants';

/**
 * Supabase client for server-side use in API routes and Server Components.
 * Uses the anon key + cookie-based session.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — ignore
          }
        },
      },
    }
  );
}

import { createSupabaseAdmin, isRealSupabaseConfigured } from './admin';

export const supabaseServer: SupabaseClient | null = isRealSupabaseConfigured()
  ? (createSupabaseAdmin() as unknown as SupabaseClient)
  : null;

// =========================================================================
// High-Reliability In-Memory / Local Store
// Ensures the application runs with full feature parity locally/offline
// and provides instant fallback if Supabase is initializing.
// =========================================================================

interface MockDatabase {
  events: Map<string, Event>;
  questions: Map<string, Question>;
  students: Map<string, Student>;
  answers: Map<string, Answer>;
  antiCheatLogs: AntiCheatLog[];
  leaderboardCache: Map<string, { cached_at: string; data: LeaderboardEntry[] }>;
}

const globalForDb = globalThis as unknown as { mockDb: MockDatabase };

if (!globalForDb.mockDb) {
  const initialEvent: Event = {
    id: DEFAULT_EVENT_ID,
    name: 'SmartLink Git Championship',
    status: 'draft',
    total_questions: 15,
    time_per_question_seconds: 30,
    started_at: null,
    current_question_number: 0,
    question_started_at: null,
    server_time_anchor: new Date().toISOString(),
    allow_late_join: true,
    shuffle_options: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const initialQuestions = new Map<string, Question>();
  SEED_GIT_QUESTIONS.forEach((q, index) => {
    const qId = `question-${index + 1}`;
    initialQuestions.set(qId, {
      ...q,
      id: qId,
      event_id: DEFAULT_EVENT_ID,
      created_at: new Date().toISOString(),
    });
  });

  globalForDb.mockDb = {
    events: new Map([[DEFAULT_EVENT_ID, initialEvent]]),
    questions: initialQuestions,
    students: new Map(),
    answers: new Map(),
    antiCheatLogs: [],
    leaderboardCache: new Map(),
  };
}

const db = globalForDb.mockDb;

// =========================================================================
// Data Access Methods (Hybrid: Supabase PostgreSQL with Mock Fallback)
// =========================================================================

export async function getCurrentEvent(): Promise<Event> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!error && data) return data as Event;
    } catch {
      // Fall through to memory store
    }
  }

  // Get active or first event
  const events = Array.from(db.events.values());
  return events[0];
}

export async function updateEvent(eventId: string, updates: Partial<Event>): Promise<Event> {
  const now = new Date().toISOString();
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('events')
        .update({ ...updates, updated_at: now })
        .eq('id', eventId)
        .select()
        .single();
      if (!error && data) return data as Event;
    } catch {
      // Fall through
    }
  }

  const existing = db.events.get(eventId) || (await getCurrentEvent());
  const updated: Event = { ...existing, ...updates, updated_at: now };
  db.events.set(eventId, updated);
  return updated;
}

export async function getStudentBySession(token: string): Promise<Student | null> {
  if (!token) return null;
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('students')
        .select('*')
        .eq('session_token', token)
        .single();
      if (!error && data) return data as Student;
    } catch {
      // Fall through
    }
  }

  for (const s of Array.from(db.students.values())) {
    if (s.session_token === token) return s;
  }
  return null;
}

export async function getStudentByCollegeId(collegeId: string): Promise<Student | null> {
  const normId = collegeId.trim().toUpperCase();
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('students')
        .select('*')
        .eq('college_id', normId)
        .single();
      if (!error && data) return data as Student;
    } catch {
      // Fall through
    }
  }

  return db.students.get(normId) || null;
}

export async function upsertStudent(studentData: Omit<Student, 'id' | 'created_at'> & { id?: string }): Promise<Student> {
  const normCollegeId = studentData.college_id.trim().toUpperCase();
  const now = new Date().toISOString();

  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('students')
        .upsert(
          {
            college_id: normCollegeId,
            name: studentData.name,
            email: studentData.email,
            session_token: studentData.session_token,
            logged_in_at: studentData.logged_in_at || now,
            clock_offset_ms: studentData.clock_offset_ms || 0,
            is_banned: studentData.is_banned || false,
          },
          { onConflict: 'college_id' }
        )
        .select()
        .single();
      if (!error && data) return data as Student;
    } catch {
      // Fall through
    }
  }

  const existing = db.students.get(normCollegeId);
  const student: Student = {
    id: existing ? existing.id : (studentData.id || `student-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
    college_id: normCollegeId,
    name: studentData.name,
    email: studentData.email || null,
    session_token: studentData.session_token,
    logged_in_at: studentData.logged_in_at || now,
    clock_offset_ms: studentData.clock_offset_ms || 0,
    is_banned: studentData.is_banned || false,
    created_at: existing ? existing.created_at : now,
  };
  db.students.set(normCollegeId, student);
  return student;
}

export async function getAllStudents(): Promise<Student[]> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer.from('students').select('*');
      if (!error && data) return data as Student[];
    } catch {
      // Fall through
    }
  }
  return Array.from(db.students.values());
}

export async function getStudentCount(): Promise<number> {
  const students = await getAllStudents();
  return students.length;
}

export async function banStudent(studentId: string, isBanned: boolean): Promise<boolean> {
  if (supabaseServer) {
    try {
      await supabaseServer.from('students').update({ is_banned: isBanned }).eq('id', studentId);
    } catch {
      // Fall through
    }
  }

  for (const [key, student] of Array.from(db.students.entries())) {
    if (student.id === studentId) {
      student.is_banned = isBanned;
      db.students.set(key, student);
      return true;
    }
  }
  return false;
}

export async function getQuestionByNumber(eventId: string, questionNumber: number): Promise<Question | null> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('questions')
        .select('*')
        .eq('event_id', eventId)
        .eq('question_number', questionNumber)
        .single();
      if (!error && data) return data as Question;
    } catch {
      // Fall through
    }
  }

  for (const q of Array.from(db.questions.values())) {
    if (q.question_number === questionNumber && (q.event_id === eventId || eventId === DEFAULT_EVENT_ID)) {
      return q;
    }
  }
  return null;
}

export async function getAllQuestions(eventId: string): Promise<Question[]> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('questions')
        .select('*')
        .eq('event_id', eventId)
        .order('question_number', { ascending: true });

      if (!error && data && data.length > 0) {
        // Fetch all options for these questions from options table
        const questionIds = data.map((q) => q.id);
        const { data: allOptions } = await supabaseServer
          .from('options')
          .select('*')
          .in('question_id', questionIds)
          .order('label', { ascending: true });

        const optionsByQ = new Map<string, any[]>();
        if (allOptions) {
          for (const opt of allOptions) {
            const list = optionsByQ.get(opt.question_id) || [];
            list.push(opt);
            optionsByQ.set(opt.question_id, list);
          }
        }

        const enriched: Question[] = data.map((q: any) => {
          const qOpts = optionsByQ.get(q.id) || [];
          let optA = q.option_a;
          let optB = q.option_b;
          let optC = q.option_c;
          let optD = q.option_d;
          let correct = q.correct_answer;

          if (qOpts.length > 0) {
            const aItem = qOpts.find((o) => o.label?.toUpperCase() === 'A') || qOpts[0];
            const bItem = qOpts.find((o) => o.label?.toUpperCase() === 'B') || qOpts[1];
            const cItem = qOpts.find((o) => o.label?.toUpperCase() === 'C') || qOpts[2];
            const dItem = qOpts.find((o) => o.label?.toUpperCase() === 'D') || qOpts[3];

            if (!optA && aItem) optA = aItem.text;
            if (!optB && bItem) optB = bItem.text;
            if (!optC && cItem) optC = cItem.text;
            if (!optD && dItem) optD = dItem.text;

            if (!correct) {
              const correctOpt = qOpts.find((o) => o.is_correct);
              if (correctOpt?.label) {
                correct = correctOpt.label.toLowerCase();
              }
            }
          }

          if (!correct && typeof q.correct_answer_index === 'number') {
            const letters = ['a', 'b', 'c', 'd'];
            correct = letters[q.correct_answer_index] || 'a';
          }

          return {
            ...q,
            question_text: q.question_text || q.text || '',
            option_a: optA || '',
            option_b: optB || '',
            option_c: optC || '',
            option_d: optD || '',
            correct_answer: correct || 'a',
            topic_tag: q.topic_tag || q.topic || 'git-basics',
            points: q.points || q.points_base || 100,
            time_limit_seconds: q.time_limit_seconds || 20,
          } as Question;
        });

        return enriched;
      }
    } catch {
      // Fall through
    }
  }

  const list = Array.from(db.questions.values()).filter(
    (q) => q.event_id === eventId || eventId === DEFAULT_EVENT_ID
  );
  return list.sort((a, b) => a.question_number - b.question_number);
}

export async function saveQuestion(questionData: Omit<Question, 'id'> & { id?: string }): Promise<Question> {
  const qId = questionData.id || `question-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const fullQuestion: Question = {
    ...questionData,
    id: qId,
    created_at: new Date().toISOString(),
  };

  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('questions')
        .upsert(fullQuestion, { onConflict: 'event_id,question_number' })
        .select()
        .single();
      if (!error && data) return data as Question;
    } catch {
      // Fall through
    }
  }

  db.questions.set(qId, fullQuestion);
  return fullQuestion;
}

export async function deleteQuestion(id: string): Promise<void> {
  if (supabaseServer) {
    try {
      await supabaseServer.from('questions').delete().eq('id', id);
    } catch {
      // Fall through
    }
  }
  db.questions.delete(id);
}

export async function checkExistingAnswer(eventId: string, studentId: string, questionNumber: number): Promise<Answer | null> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('answers')
        .select('*')
        .eq('event_id', eventId)
        .eq('student_id', studentId)
        .eq('question_number', questionNumber)
        .single();
      if (!error && data) return data as Answer;
    } catch {
      // Fall through
    }
  }

  const key = `${eventId}-${studentId}-${questionNumber}`;
  return db.answers.get(key) || null;
}

export async function storeAnswer(answerData: Omit<Answer, 'id' | 'submitted_at'>): Promise<Answer> {
  const ansId = `ans-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const fullAnswer: Answer = {
    ...answerData,
    id: ansId,
    submitted_at: now,
  };

  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('answers')
        .insert(fullAnswer)
        .select()
        .single();
      if (!error && data) return data as Answer;
    } catch {
      // Fall through
    }
  }

  const key = `${answerData.event_id}-${answerData.student_id}-${answerData.question_number}`;
  db.answers.set(key, fullAnswer);
  return fullAnswer;
}

export async function getAnswersForEvent(eventId: string): Promise<Answer[]> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('answers')
        .select('*')
        .eq('event_id', eventId);
      if (!error && data) return data as Answer[];
    } catch {
      // Fall through
    }
  }

  return Array.from(db.answers.values()).filter((a) => a.event_id === eventId);
}

export async function getAnswersForStudent(eventId: string, studentId: string): Promise<Answer[]> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('answers')
        .select('*')
        .eq('event_id', eventId)
        .eq('student_id', studentId)
        .order('question_number', { ascending: true });
      if (!error && data) return data as Answer[];
    } catch {
      // Fall through
    }
  }

  return Array.from(db.answers.values())
    .filter((a) => a.event_id === eventId && a.student_id === studentId)
    .sort((a, b) => a.question_number - b.question_number);
}

export async function logAntiCheat(logData: AntiCheatLog): Promise<void> {
  const entry: AntiCheatLog = {
    ...logData,
    id: `cheat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    occurred_at: new Date().toISOString(),
  };

  if (supabaseServer) {
    try {
      await supabaseServer.from('anti_cheat_logs').insert(entry);
      return;
    } catch {
      // Fall through
    }
  }

  db.antiCheatLogs.push(entry);
}

export async function getAntiCheatLogs(eventId: string): Promise<AntiCheatLog[]> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('anti_cheat_logs')
        .select('*')
        .eq('event_id', eventId)
        .order('occurred_at', { ascending: false });
      if (!error && data) return data as AntiCheatLog[];
    } catch {
      // Fall through
    }
  }

  return db.antiCheatLogs
    .filter((l) => l.event_id === eventId)
    .sort((a, b) => new Date(b.occurred_at || 0).getTime() - new Date(a.occurred_at || 0).getTime());
}

export async function getLeaderboardCache(eventId: string): Promise<{ cached_at: string; data: LeaderboardEntry[] } | null> {
  if (supabaseServer) {
    try {
      const { data, error } = await supabaseServer
        .from('leaderboard_cache')
        .select('*')
        .eq('event_id', eventId)
        .single();
      if (!error && data) {
        return { cached_at: data.cached_at, data: data.data };
      }
    } catch {
      // Fall through
    }
  }

  return db.leaderboardCache.get(eventId) || null;
}

export async function updateLeaderboardCache(eventId: string, data: LeaderboardEntry[]): Promise<void> {
  const now = new Date().toISOString();
  if (supabaseServer) {
    try {
      await supabaseServer
        .from('leaderboard_cache')
        .upsert({ event_id: eventId, cached_at: now, data });
    } catch {
      // Fall through
    }
  }

  db.leaderboardCache.set(eventId, { cached_at: now, data });
}
