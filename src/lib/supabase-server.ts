// lib/supabase-server.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export function getSupabaseAdmin(): SupabaseClient {
  return getAdminClient();
}

// ---------------------------------------------------------------------------
// Type Definitions matching Supabase Database Schema Build Specification
// ---------------------------------------------------------------------------

export interface Student {
  id: string;
  college_id: string;
  name: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  email?: string;
  register_no?: string;
  join_code_hash?: string;
  join_attempts?: number;
  locked_until?: string | null;
  auth_user_id?: string | null;
  active_session_id?: string | null;
  consent_at?: string | null;
  status?: string;
  display_name_preference?: 'full' | 'first_initial';
  certificate_name_confirmed?: boolean;
}

export interface Question {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  explanation: string;
  points_base: number;
  is_active: boolean;
  created_at: string;
}

export interface Option {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  label: 'A' | 'B' | 'C' | 'D';
}

export interface StudentQuestionAssignment {
  id: string;
  student_id: string;
  question_id: string;
  position: number;
}

export interface QuizState {
  id: number;
  status: 'waiting' | 'running' | 'paused' | 'finished';
  started_at: string | null;
  question_seconds: number;
  gap_seconds: number;
  total_questions: number;
  results_published?: boolean;
  results_published_at?: string | null;
}

export interface Answer {
  id: string;
  student_id: string;
  question_id: string;
  option_id: string;
  position: number;
  response_ms: number;
  is_correct: boolean;
  points: number;
  created_at: string;
}

export interface EventLog {
  id: string;
  student_id: string | null;
  type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Flag {
  id: string;
  student_id: string;
  flag_type: string;
  severity: 'info' | 'warning' | 'critical';
  evidence: Record<string, unknown>;
  score_penalty: number;
  is_resolved: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  student_id: string;
  flag_id: string | null;
  admin_name: string;
  decision: 'clear' | 'penalize' | 'disqualify';
  penalty: number;
  reason: string;
  created_at: string;
}

export interface StudentStatus {
  student_id: string;
  trust_score: number;
  status: 'clear' | 'review' | 'held' | 'disqualified';
  total_penalty: number;
  flags_count: number;
  reviewed_at: string | null;
  updated_at: string;
}

export interface ReserveQuestion {
  id: string;
  text: string;
  difficulty: 'medium' | 'hard';
  topic: string;
  explanation: string;
  is_used: boolean;
  created_at: string;
}

export interface ReserveOption {
  id: string;
  question_id: string;
  text: string;
  is_correct: boolean;
  label: 'A' | 'B' | 'C' | 'D';
}

export interface SuddenDeathAnswer {
  id: string;
  round: number;
  question_id: string;
  student_id: string;
  option_id: string;
  is_correct: boolean;
  response_ms: number;
  created_at: string;
}

export interface WinnerVerificationRecord {
  id: string;
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overridden';
  admin_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CertificateRecord {
  id: string;
  student_id: string;
  college_id: string;
  tier: 'winner' | 'runner_up' | 'second_runner_up' | 'top10' | 'participant';
  cert_id: string;
  file_token: string;
  storage_path: string;
  created_at: string;
}

export interface ResultsApprovalRecord {
  id: string;
  approved_by: string;
  approved_at: string;
  approval_type: 'first' | 'second';
  notes: string;
}

const DEFAULT_RESERVE_QUESTIONS: Array<{
  id: string;
  text: string;
  difficulty: 'medium' | 'hard';
  topic: string;
  explanation: string;
  options: Array<{ id: string; text: string; is_correct: boolean; label: 'A' | 'B' | 'C' | 'D' }>;
}> = [
  {
    id: 'res-q-001',
    text: 'During a git rebase --interactive, what command is used to reword a commit message while keeping the commit contents unchanged?',
    difficulty: 'hard',
    topic: 'rebasing',
    explanation: 'The "reword" command in interactive rebase stops to allow editing of the commit message without modifying any diffs.',
    options: [
      { id: 'res-opt-001-a', text: 'reword (or r)', is_correct: true, label: 'A' },
      { id: 'res-opt-001-b', text: 'edit (or e)', is_correct: false, label: 'B' },
      { id: 'res-opt-001-c', text: 'fixup (or f)', is_correct: false, label: 'C' },
      { id: 'res-opt-001-d', text: 'squash (or s)', is_correct: false, label: 'D' },
    ],
  },
  {
    id: 'res-q-002',
    text: 'What Git plumbing command computes the SHA-1 object ID of a file without storing it in the Git object database unless -w is passed?',
    difficulty: 'hard',
    topic: 'plumbing',
    explanation: 'git hash-object calculates the object ID of the provided content; the -w flag actually writes the object into the object database.',
    options: [
      { id: 'res-opt-002-a', text: 'git cat-file -p', is_correct: false, label: 'A' },
      { id: 'res-opt-002-b', text: 'git hash-object', is_correct: true, label: 'B' },
      { id: 'res-opt-002-c', text: 'git write-tree', is_correct: false, label: 'C' },
      { id: 'res-opt-002-d', text: 'git update-index', is_correct: false, label: 'D' },
    ],
  },
  {
    id: 'res-q-003',
    text: 'When recovering an accidentally deleted commit that is no longer reachable by any branch or tag, which tool is used to find its SHA?',
    difficulty: 'hard',
    topic: 'recovery',
    explanation: 'git reflog records the history of where references (like HEAD) have pointed, enabling discovery of unreachable commits.',
    options: [
      { id: 'res-opt-003-a', text: 'git reflog', is_correct: true, label: 'A' },
      { id: 'res-opt-003-b', text: 'git bisect view', is_correct: false, label: 'B' },
      { id: 'res-opt-003-c', text: 'git fsck --no-full', is_correct: false, label: 'C' },
      { id: 'res-opt-003-d', text: 'git clean -fdx', is_correct: false, label: 'D' },
    ],
  },
  {
    id: 'res-q-004',
    text: 'Which merge strategy option can resolve conflicts during a recursive merge by favoring the version from the current branch?',
    difficulty: 'hard',
    topic: 'merging',
    explanation: 'The "-X ours" option to the recursive merge strategy resolves conflicting hunks cleanly by favoring the current branch.',
    options: [
      { id: 'res-opt-004-a', text: 'git merge -s ours', is_correct: false, label: 'A' },
      { id: 'res-opt-004-b', text: 'git merge -X ours', is_correct: true, label: 'B' },
      { id: 'res-opt-004-c', text: 'git merge --theirs', is_correct: false, label: 'C' },
      { id: 'res-opt-004-d', text: 'git merge --fast-forward-only', is_correct: false, label: 'D' },
    ],
  },
  {
    id: 'res-q-005',
    text: 'In Git internal storage, which object type links filenames and modes to file content blobs?',
    difficulty: 'hard',
    topic: 'internals',
    explanation: 'Tree objects represent directories, linking human-readable filenames and file permission modes to the respective blob object SHAs.',
    options: [
      { id: 'res-opt-005-a', text: 'Commit object', is_correct: false, label: 'A' },
      { id: 'res-opt-005-b', text: 'Tag object', is_correct: false, label: 'B' },
      { id: 'res-opt-005-c', text: 'Tree object', is_correct: true, label: 'C' },
      { id: 'res-opt-005-d', text: 'Packfile index', is_correct: false, label: 'D' },
    ],
  },
];

// ---------------------------------------------------------------------------
// In-Memory Data Store (90 Questions, 360 Options, 200 Students, 3000 Assignments, Layer 2 Tables)
// ---------------------------------------------------------------------------

class MemoryStore {
  students: Student[] = [];
  questions: Question[] = [];
  options: Option[] = [];
  assignments: StudentQuestionAssignment[] = [];
  quizState: QuizState = {
    id: 1,
    status: 'waiting',
    started_at: null,
    question_seconds: 20,
    gap_seconds: 5,
    total_questions: 15,
  };
  answers: Answer[] = [];
  events: EventLog[] = [];
  flags: Flag[] = [];
  reviews: Review[] = [];
  studentStatus: StudentStatus[] = [];
  reserveQuestions: ReserveQuestion[] = [];
  reserveOptions: ReserveOption[] = [];
  suddenDeath: SuddenDeathAnswer[] = [];
  winnerVerification: WinnerVerificationRecord[] = [];
  certificates: CertificateRecord[] = [];
  resultsApproval: ResultsApprovalRecord[] = [];
  practiceRatings: any[] = [];
  practiceSessions: any[] = [];
  practiceAnswers: any[] = [];
  loginEvents: any[] = [];
  adminUsers: any[] = [];
  auditLog: any[] = [];
  approvals: any[] = [];
  eventSettings: any[] = [];
  pauses: any[] = [];
  questionVoids: any[] = [];
  announcements: any[] = [];
  helpdeskActions: any[] = [];
  studentNotes: any[] = [];
  flagDecisions: any[] = [];
  authUsers: Map<string, any> = new Map();

  constructor() {
    this.initFromAssets();
  }

  private initFromAssets() {
    try {
      const basePath = process.cwd();
      const studentsPath = path.join(basePath, 'scripts', 'data-students.json');
      const questionsPath = path.join(basePath, 'scripts', 'data-questions.json');
      const assignmentsPath = path.join(basePath, 'scripts', 'data-assignments.json');

      if (fs.existsSync(studentsPath) && fs.existsSync(questionsPath) && fs.existsSync(assignmentsPath)) {
        const rawStds = JSON.parse(fs.readFileSync(studentsPath, 'utf8'));
        this.students = rawStds.map((s: { id: string; college_id: string; name: string; join_code: string; email?: string; register_no?: string }) => {
          const email = s.email || `${s.college_id.toLowerCase()}@klu.ac.in`;
          const registerNo = s.register_no || s.college_id.toUpperCase();
          const joinCodeHash = bcrypt.hashSync(s.join_code, 8);
          return {
            id: s.id,
            college_id: s.college_id,
            name: s.name,
            join_code: s.join_code,
            email,
            register_no: registerNo,
            join_code_hash: joinCodeHash,
            join_attempts: 0,
            locked_until: null,
            auth_user_id: null,
            active_session_id: null,
            consent_at: null,
            status: 'registered',
            display_name_preference: 'full',
            certificate_name_confirmed: false,
            is_active: true,
            created_at: new Date().toISOString(),
          };
        });

        // Seed Dhina (Admin & Participant) account
        this.authUsers.set('admin-dhina', {
          id: 'admin-dhina',
          email: 'dhina7250@gmail.com',
          password: 'Dhina4213@',
          app_metadata: { role: 'admin' },
          user_metadata: { name: 'Dhina', role: 'admin' },
          created_at: new Date().toISOString(),
        });

        // Seed Dhina as participant/student
        const dhinaStudent: Student = {
          id: 'std-dhina-001',
          college_id: 'DHINA7250',
          name: 'Dhina',
          join_code: 'Dhina4213@',
          email: 'dhina7250@gmail.com',
          register_no: 'DHINA7250',
          join_code_hash: bcrypt.hashSync('Dhina4213@', 8),
          join_attempts: 0,
          locked_until: null,
          auth_user_id: 'admin-dhina',
          active_session_id: null,
          consent_at: new Date().toISOString(),
          status: 'registered',
          display_name_preference: 'full',
          certificate_name_confirmed: true,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        this.students.unshift(dhinaStudent);

        // Seed 2 admin accounts
        const adminPw = 'Admin@SmartLink2026!';
        this.authUsers.set('admin-1', {
          id: 'admin-1',
          email: 'organizer1@klu.ac.in',
          password: adminPw,
          app_metadata: { role: 'admin' },
          user_metadata: { name: 'Lead Organizer 1', role: 'admin' },
          created_at: new Date().toISOString(),
        });
        this.authUsers.set('admin-2', {
          id: 'admin-2',
          email: 'organizer2@klu.ac.in',
          password: adminPw,
          app_metadata: { role: 'admin' },
          user_metadata: { name: 'Lead Organizer 2', role: 'admin' },
          created_at: new Date().toISOString(),
        });

        // Seed Admin Users table
        this.adminUsers = [
          {
            id: 'admin-user-dhina',
            auth_user_id: 'admin-dhina',
            role: 'owner',
            display_name: 'Dhina (Owner)',
            active: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'admin-user-1',
            auth_user_id: 'admin-1',
            role: 'owner',
            display_name: 'Lead Organizer 1 (Owner)',
            active: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'admin-user-2',
            auth_user_id: 'admin-2',
            role: 'co_organizer',
            display_name: 'Lead Organizer 2 (Co-Organizer)',
            active: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'admin-user-hd',
            auth_user_id: 'helpdesk-1',
            role: 'help_desk',
            display_name: 'Help Desk Support',
            active: true,
            created_at: new Date().toISOString(),
          },
          {
            id: 'admin-user-proj',
            auth_user_id: 'projector-1',
            role: 'projector',
            display_name: 'Main Projector Display',
            active: true,
            created_at: new Date().toISOString(),
          },
        ];

        // Seed Event Settings
        const defaultEvId = process.env.DEFAULT_EVENT_ID || '00000000-0000-0000-0000-000000000000';
        this.eventSettings = [
          {
            id: 'settings-default',
            event_id: defaultEvId,
            values: {
              seconds_per_question: 20,
              gap_seconds: 5,
              total_questions: 15,
              scoring: {
                base_correct: 1000,
                time_bonus_max: 500,
                time_window_ms: 20000,
              },
              penalties: {
                tab_switch_2nd: -200,
              },
              lockout_attempts: 5,
              lockout_minutes: 10,
              sudden_death_seconds: 30,
              appeals_window_minutes: 10,
            },
            version: 1,
            frozen_at: new Date().toISOString(),
            bank_hash: 'seed_bank_hash_2026',
            updated_at: new Date().toISOString(),
          },
        ];

        const rawQs = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
        this.questions = [];
        this.options = [];

        for (const q of rawQs) {
          this.questions.push({
            id: q.id,
            text: q.text,
            difficulty: q.difficulty,
            topic: q.topic,
            explanation: q.explanation,
            points_base: q.points_base || 1000,
            is_active: true,
            created_at: new Date().toISOString(),
          });

          for (const opt of q.options) {
            this.options.push({
              id: opt.id,
              question_id: opt.question_id,
              text: opt.text,
              is_correct: opt.is_correct,
              label: opt.label,
            });
          }
        }

        const rawAssigns = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
        this.assignments = rawAssigns.map((a: { student_id: string; question_id: string; position: number }, i: number) => ({
          id: `asg-${String(i + 1).padStart(6, '0')}`,
          student_id: a.student_id,
          question_id: a.question_id,
          position: a.position,
        }));

        // Assign questions to Dhina participant account
        if (this.questions.length > 0) {
          for (let pos = 1; pos <= Math.min(15, this.questions.length); pos++) {
            this.assignments.push({
              id: `asg-dhina-${pos}`,
              student_id: 'std-dhina-001',
              question_id: this.questions[pos - 1].id,
              position: pos,
            });
          }
        }

        if (this.answers.length === 0 && this.assignments.length > 0) {
          const sampleStudents = this.students.slice(0, 30);
          for (const [stIdx, s] of sampleStudents.entries()) {
            const stAssigns = this.assignments.filter((a) => a.student_id === s.id);
            for (const asg of stAssigns) {
              const qOpts = this.options.filter((o) => o.question_id === asg.question_id);
              const correctOpt = qOpts.find((o) => o.is_correct) || qOpts[0];
              const wrongOpt = qOpts.find((o) => !o.is_correct) || qOpts[0];
              const isCorrect = stIdx === 0 ? asg.position !== 15 : (asg.position + stIdx) % 3 !== 0;
              const chosenOpt = isCorrect ? correctOpt : wrongOpt;
              const responseMs = 4000 + (stIdx * 250) + (asg.position * 100);
              const points = isCorrect ? Math.round(1000 + Math.max(0, 500 * (1 - responseMs / 20000))) : 0;
              this.answers.push({
                id: `ans-seed-${s.id}-${asg.position}`,
                student_id: s.id,
                question_id: asg.question_id,
                option_id: chosenOpt ? chosenOpt.id : 'opt-default',
                position: asg.position,
                response_ms: responseMs,
                is_correct: isCorrect,
                points,
                created_at: new Date().toISOString(),
              });
            }
          }
        }
      }

      // Initialize Reserve Questions and Options for Sudden Death
      this.reserveQuestions = [];
      this.reserveOptions = [];
      for (const rq of DEFAULT_RESERVE_QUESTIONS) {
        this.reserveQuestions.push({
          id: rq.id,
          text: rq.text,
          difficulty: rq.difficulty,
          topic: rq.topic,
          explanation: rq.explanation,
          is_used: false,
          created_at: new Date().toISOString(),
        });
        for (const ro of rq.options) {
          this.reserveOptions.push({
            id: ro.id,
            question_id: rq.id,
            text: ro.text,
            is_correct: ro.is_correct,
            label: ro.label,
          });
        }
      }

      if (this.students.length > 0) {
        this.certificates = this.students.slice(0, 10).map((s, idx) => ({
          id: `cert-${s.id}`,
          student_id: s.id,
          college_id: s.college_id,
          tier: (idx === 0 ? 'winner' : idx === 1 ? 'runner_up' : idx === 2 ? 'second_runner_up' : 'top10') as any,
          cert_id: `SLQ-DEMO${String(idx + 1).padStart(4, '0')}`,
          file_token: `token-${s.id.slice(0, 8)}`,
          storage_path: `token-${s.id.slice(0, 8)}/certificate.png`,
          created_at: new Date().toISOString(),
        }));
      }
    } catch (e) {
      console.warn('[DB] MemoryStore asset load note:', e);
    }
  }

  computeTrustScore(studentId: string): number {
    let score = 100;
    const tabSwitches = this.events.filter((e) => e.student_id === studentId && e.type === 'tab_switch').length;
    if (tabSwitches > 1) {
      score -= (tabSwitches - 1) * 10;
    }
    const unresolvedFlags = this.flags.filter((f) => f.student_id === studentId && !f.is_resolved);
    for (const f of unresolvedFlags) {
      switch (f.flag_type) {
        case 'superhuman_speed':
          score -= 20;
          break;
        case 'identical_wrong_answers':
          score -= 30;
          break;
        case 'synchronized_timing':
          score -= 30;
          break;
        case 'hard_right_easy_wrong':
          score -= 20;
          break;
        case 'heavy_tab_switching':
          score -= 15;
          break;
        case 'suspicious_login':
        case 'second_login':
          score -= 10;
          break;
        default:
          score -= 5;
      }
    }
    return Math.max(0, Math.min(100, score));
  }

  computeAllTrustScores(): Array<{ student_id: string; trust_score: number; status: 'clear' | 'review' | 'held' }> {
    return this.students
      .filter((s) => s.is_active)
      .map((s) => {
        const score = this.computeTrustScore(s.id);
        const status = score >= 70 ? 'clear' : score >= 40 ? 'review' : 'held';
        return {
          student_id: s.id,
          trust_score: score,
          status: status as 'clear' | 'review' | 'held',
        };
      });
  }

  applyReviewDecision(
    studentId: string,
    adminName: string,
    decision: 'clear' | 'penalize' | 'disqualify',
    penalty: number,
    reason: string,
    flagId?: string | null
  ): void {
    this.reviews.push({
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      student_id: studentId,
      flag_id: flagId || null,
      admin_name: adminName,
      decision,
      penalty,
      reason,
      created_at: new Date().toISOString(),
    });

    if (flagId) {
      const flg = this.flags.find((f) => f.id === flagId);
      if (flg) flg.is_resolved = true;
    }

    let newStatus: 'clear' | 'review' | 'held' | 'disqualified' = 'clear';
    let newPenalty = 0;
    if (decision === 'disqualify') {
      newStatus = 'disqualified';
      newPenalty = 0;
    } else if (decision === 'penalize') {
      newStatus = 'clear';
      newPenalty = penalty;
    } else {
      newStatus = 'clear';
      newPenalty = 0;
    }

    const idx = this.studentStatus.findIndex((st) => st.student_id === studentId);
    const curPenalty = idx >= 0 ? this.studentStatus[idx].total_penalty : 0;
    const totalPen = curPenalty + newPenalty;
    const trustScore = this.computeTrustScore(studentId);

    const statusRec: StudentStatus = {
      student_id: studentId,
      trust_score: trustScore,
      status: newStatus,
      total_penalty: totalPen,
      flags_count: this.flags.filter((f) => f.student_id === studentId).length,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (idx >= 0) {
      this.studentStatus[idx] = statusRec;
    } else {
      this.studentStatus.push(statusRec);
    }
  }

  resetAnswersAndQuiz() {
    this.answers = [];
    this.quizState.status = 'waiting';
    this.quizState.started_at = null;
    this.flags = [];
    this.reviews = [];
    this.studentStatus = [];
    this.suddenDeath = [];
    this.winnerVerification = [];
    this.reserveQuestions.forEach((rq) => (rq.is_used = false));
  }
}

const store = (globalThis as unknown as { __smartlink_store_v2?: MemoryStore }).__smartlink_store_v2 || new MemoryStore();
if (!store.practiceRatings) store.practiceRatings = [];
if (!store.practiceSessions) store.practiceSessions = [];
if (!store.practiceAnswers) store.practiceAnswers = [];

if (process.env.NODE_ENV !== 'production') {
  (globalThis as unknown as { __smartlink_store_v2?: MemoryStore }).__smartlink_store_v2 = store;
}

function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('placeholder-project') &&
    !key.includes('placeholder')
  );
}

function createMockSupabaseClient(memStore: MemoryStore) {
  return {
    auth: {
      admin: {
        async createUser(params: {
          email: string;
          password?: string;
          email_confirm?: boolean;
          user_metadata?: any;
          app_metadata?: any;
        }) {
          const cleanEmail = params.email.toLowerCase().trim();
          const existing = Array.from(memStore.authUsers.values()).find((u: any) => u.email === cleanEmail);
          if (existing) {
            return { data: { user: null }, error: { message: "User already registered" } };
          }
          const userId = `usr-${crypto.randomUUID()}`;
          const user = {
            id: userId,
            email: cleanEmail,
            password: params.password,
            email_confirmed_at: params.email_confirm ? new Date().toISOString() : null,
            user_metadata: params.user_metadata || {},
            app_metadata: params.app_metadata || { role: 'student' },
            created_at: new Date().toISOString(),
          };
          memStore.authUsers.set(userId, user);
          return { data: { user }, error: null };
        },
        async updateUserById(userId: string, params: { password?: string; user_metadata?: any; app_metadata?: any }) {
          const user = memStore.authUsers.get(userId);
          if (!user) {
            return { data: { user: null }, error: { message: "User not found" } };
          }
          if (params.password) user.password = params.password;
          if (params.user_metadata) user.user_metadata = { ...user.user_metadata, ...params.user_metadata };
          if (params.app_metadata) user.app_metadata = { ...user.app_metadata, ...params.app_metadata };
          memStore.authUsers.set(userId, user);
          return { data: { user }, error: null };
        },
        async listUsers() {
          return { data: { users: Array.from(memStore.authUsers.values()) }, error: null };
        },
        async deleteUser(userId: string) {
          memStore.authUsers.delete(userId);
          return { data: { user: null }, error: null };
        },
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const cleanEmail = email.toLowerCase().trim();
        const user = Array.from(memStore.authUsers.values()).find((u: any) => u.email === cleanEmail);
        if (!user || user.password !== password) {
          return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
        }
        const tokenPayload = {
          sub: user.id,
          email: user.email,
          role: user.app_metadata?.role || 'student',
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
          exp: Math.floor(Date.now() / 1000) + 86400,
        };
        const tokenStr =
          Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64') +
          '.' +
          Buffer.from(JSON.stringify(tokenPayload)).toString('base64') +
          '.mockSig';
        const session = {
          access_token: tokenStr,
          refresh_token: `rf-${crypto.randomUUID()}`,
          expires_in: 86400,
          user,
        };
        return { data: { user, session }, error: null };
      },
      async getUser(token?: string) {
        if (!token) return { data: { user: null }, error: { message: "No token" } };
        try {
          const parts = token.split('.');
          if (parts.length >= 2) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const user = memStore.authUsers.get(payload.sub) || {
              id: payload.sub,
              email: payload.email,
              app_metadata: payload.app_metadata || { role: payload.role },
              user_metadata: payload.user_metadata || {},
            };
            return { data: { user }, error: null };
          }
        } catch {}
        return { data: { user: null }, error: { message: "Invalid token" } };
      },
      async signOut(_token?: string) {
        return { error: null };
      },
    },
    rpc(fnName: string, args?: Record<string, any>) {
      const executeRpc = () => {
        if (fnName === 'compute_trust_score') {
          const studentId = args?.p_student_id;
          return { data: memStore.computeTrustScore(studentId), error: null };
        }
        if (fnName === 'compute_all_trust_scores') {
          return { data: memStore.computeAllTrustScores(), error: null };
        }
        if (fnName === 'apply_review_decision') {
          memStore.applyReviewDecision(
            args?.p_student_id,
            args?.p_admin_name,
            args?.p_decision,
            args?.p_penalty || 0,
            args?.p_reason,
            args?.p_flag_id
          );
          return { data: null, error: null };
        }
        return { data: null, error: { message: `Unknown RPC function: ${fnName}` } };
      };

      return {
        async execute() {
          return executeRpc();
        },
        then(resolve: (val: any) => void, reject?: (err: any) => void) {
          try {
            resolve(executeRpc());
          } catch (e) {
            if (reject) reject(e);
            else resolve({ data: null, error: e });
          }
        },
      };
    },

    from(table: string) {
      let selectedCols = '*';
      let countOption: string | undefined = undefined;
      let isHead = false;
      const filters: Array<(row: any) => boolean> = [];
      let orderByCol: string | null = null;
      let orderAsc = true;
      let limitCount: number | null = null;
      let isSingle = false;
      let isMaybeSingle = false;
      let action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
      let payloadToInsert: any = null;
      let payloadToUpdate: any = null;

      const builder: any = {
        select(cols = '*', options?: { count?: string; head?: boolean }) {
          selectedCols = cols;
          countOption = options?.count;
          isHead = Boolean(options?.head);
          return builder;
        },
        insert(data: any) {
          action = 'insert';
          payloadToInsert = data;
          return builder;
        },
        upsert(data: any) {
          action = 'upsert';
          payloadToInsert = data;
          return builder;
        },
        update(data: any) {
          action = 'update';
          payloadToUpdate = data;
          return builder;
        },
        delete() {
          action = 'delete';
          return builder;
        },
        eq(col: string, val: any) {
          filters.push((row: any) => {
            const rowVal = row[col];
            if (rowVal === undefined) return false;
            if (typeof rowVal === 'string' && typeof val === 'string') {
              return rowVal.toLowerCase() === val.toLowerCase();
            }
            return String(rowVal) === String(val);
          });
          return builder;
        },
        neq(col: string, val: any) {
          filters.push((row: any) => String(row[col]) !== String(val));
          return builder;
        },
        is(col: string, val: any) {
          filters.push((row: any) => {
            if (val === null) return row[col] === null || row[col] === undefined;
            return row[col] === val;
          });
          return builder;
        },
        not(col: string, operator: string, val: any) {
          filters.push((row: any) => {
            if (operator === 'is') {
              if (val === null) return row[col] !== null && row[col] !== undefined;
              return row[col] !== val;
            }
            return String(row[col]) !== String(val);
          });
          return builder;
        },
        ilike(col: string, val: any) {
          filters.push((row: any) => {
            const v = String(row[col] || '').toLowerCase();
            return v.includes(String(val).toLowerCase());
          });
          return builder;
        },
        in(col: string, vals: any[]) {
          const valSet = new Set(vals.map(String));
          filters.push((row: any) => valSet.has(String(row[col])));
          return builder;
        },
        gt(col: string, val: any) {
          filters.push((row: any) => Number(row[col]) > Number(val));
          return builder;
        },
        gte(col: string, val: any) {
          filters.push((row: any) => Number(row[col]) >= Number(val));
          return builder;
        },
        lt(col: string, val: any) {
          filters.push((row: any) => Number(row[col]) < Number(val));
          return builder;
        },
        lte(col: string, val: any) {
          filters.push((row: any) => Number(row[col]) <= Number(val));
          return builder;
        },
        order(col: string, options?: { ascending?: boolean }) {
          orderByCol = col;
          orderAsc = options?.ascending !== false;
          return builder;
        },
        limit(n: number) {
          limitCount = n;
          return builder;
        },
        single() {
          isSingle = true;
          return builder;
        },
        maybeSingle() {
          isMaybeSingle = true;
          return builder;
        },
        async execute() {
          return executeQuery();
        },
        then(resolve: (val: any) => void, reject?: (err: any) => void) {
          try {
            const res = executeQuery();
            resolve(res);
          } catch (e) {
            if (reject) reject(e);
            else resolve({ data: null, error: e });
          }
        },
      };

      function executeQuery(): { data: any; error: any; count?: number | null } {
        if (action === 'insert') {
          if (table === 'answers') {
            const ans = payloadToInsert;
            const exists = memStore.answers.some(
              (a) => a.student_id === ans.student_id && a.question_id === ans.question_id
            );
            if (exists) {
              return {
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
              };
            }
            const record = {
              id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              student_id: ans.student_id,
              question_id: ans.question_id,
              option_id: ans.option_id,
              position: ans.position,
              response_ms: ans.response_ms,
              is_correct: ans.is_correct,
              points: ans.points,
              created_at: new Date().toISOString(),
            };
            memStore.answers.push(record);
            return { data: record, error: null };
          }

          if (table === 'events') {
            const items = Array.isArray(payloadToInsert) ? payloadToInsert : [payloadToInsert];
            const inserted = [];
            for (const ev of items) {
              const record = {
                id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                student_id: ev.student_id || null,
                type: ev.type,
                metadata: ev.metadata || {},
                created_at: new Date().toISOString(),
              };
              memStore.events.push(record);
              inserted.push(record);
            }
            return { data: Array.isArray(payloadToInsert) ? inserted : inserted[0], error: null };
          }

          if (table === 'flags') {
            const items = Array.isArray(payloadToInsert) ? payloadToInsert : [payloadToInsert];
            const inserted = [];
            for (const f of items) {
              const record = {
                id: f.id || `flg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                student_id: f.student_id,
                flag_type: f.flag_type,
                severity: f.severity || 'warning',
                evidence: f.evidence || {},
                score_penalty: f.score_penalty || 0,
                is_resolved: f.is_resolved || false,
                created_at: f.created_at || new Date().toISOString(),
              };
              memStore.flags.push(record);
              inserted.push(record);
            }
            return { data: Array.isArray(payloadToInsert) ? inserted : inserted[0], error: null };
          }

          if (table === 'reviews') {
            const r = payloadToInsert;
            const record = {
              id: r.id || `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              student_id: r.student_id,
              flag_id: r.flag_id || null,
              admin_name: r.admin_name,
              decision: r.decision,
              penalty: r.penalty || 0,
              reason: r.reason,
              created_at: new Date().toISOString(),
            };
            memStore.reviews.push(record);
            return { data: record, error: null };
          }

          if (table === 'sudden_death') {
            const sd = payloadToInsert;
            const record = {
              id: sd.id || `sd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              round: sd.round || 1,
              question_id: sd.question_id,
              student_id: sd.student_id,
              option_id: sd.option_id,
              is_correct: Boolean(sd.is_correct),
              response_ms: sd.response_ms || 0,
              created_at: new Date().toISOString(),
            };
            memStore.suddenDeath.push(record);
            return { data: record, error: null };
          }

          if (table === 'winner_verification') {
            const wv = payloadToInsert;
            const record = {
              id: wv.id || `wv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              event_id: wv.event_id,
              ranking: wv.ranking,
              winner_student_id: wv.winner_student_id,
              approved_by: wv.approved_by,
              revealed_places: wv.revealed_places || [],
              published: wv.published || false,
              step: wv.step,
              status: wv.status || 'pending',
              admin_name: wv.admin_name || null,
              details: wv.details || {},
              created_at: wv.created_at || new Date().toISOString(),
              completed_at: wv.completed_at || null,
              ...wv,
            };
            memStore.winnerVerification.push(record);
            return { data: record, error: null };
          }

          if (table === 'certificates') {
            const cert = payloadToInsert;
            const record = {
              id: cert.id || `cert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              student_id: cert.student_id,
              college_id: cert.college_id,
              tier: cert.tier || 'participant',
              cert_id: cert.cert_id,
              file_token: cert.file_token,
              storage_path: cert.storage_path,
              created_at: cert.created_at || new Date().toISOString(),
            };
            memStore.certificates.push(record as any);
            return { data: record, error: null };
          }

          if (table === 'results_approval') {
            const ap = payloadToInsert;
            const record = {
              id: ap.id || `appr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              approved_by: ap.approved_by,
              approval_type: ap.approval_type || 'first',
              notes: ap.notes || '',
              approved_at: ap.approved_at || new Date().toISOString(),
            };
            memStore.resultsApproval.push(record as any);
            return { data: record, error: null };
          }

          if (table === 'practice_sessions') {
            const sess = { ...payloadToInsert, id: payloadToInsert.id || `sess-${Date.now()}` };
            memStore.practiceSessions.push(sess);
            return { data: sess, error: null };
          }

          if (table === 'practice_answers') {
            const ans = { ...payloadToInsert, id: payloadToInsert.id || `pans-${Date.now()}` };
            memStore.practiceAnswers.push(ans);
            return { data: ans, error: null };
          }

          if (table === 'practice_ratings') {
            const r = { ...payloadToInsert };
            memStore.practiceRatings.push(r);
            return { data: r, error: null };
          }

          if (table === 'students') {
            const s = {
              id: payloadToInsert.id || crypto.randomUUID(),
              ...payloadToInsert,
              is_active: payloadToInsert.is_active !== false,
              created_at: payloadToInsert.created_at || new Date().toISOString(),
            };
            memStore.students.push(s);
            return { data: s, error: null };
          }

          if (table === 'login_events') {
            const ev = {
              id: payloadToInsert.id || crypto.randomUUID(),
              ...payloadToInsert,
              created_at: payloadToInsert.created_at || new Date().toISOString(),
            };
            memStore.loginEvents.push(ev);
            return { data: ev, error: null };
          }

          const adminTableMap: Record<string, any[]> = {
            admin_users: memStore.adminUsers,
            audit_log: memStore.auditLog,
            approvals: memStore.approvals,
            event_settings: memStore.eventSettings,
            pauses: memStore.pauses,
            question_voids: memStore.questionVoids,
            announcements: memStore.announcements,
            helpdesk_actions: memStore.helpdeskActions,
            student_notes: memStore.studentNotes,
            flag_decisions: memStore.flagDecisions,
            winner_verification: memStore.winnerVerification,
          };

          if (adminTableMap[table]) {
            const record = {
              id: payloadToInsert.id || crypto.randomUUID(),
              ...payloadToInsert,
              created_at: payloadToInsert.created_at || new Date().toISOString(),
            };
            adminTableMap[table].push(record);
            return { data: record, error: null };
          }

          return { data: payloadToInsert, error: null };
        }

        if (action === 'upsert') {
          if (table === 'practice_ratings') {
            const r = payloadToInsert;
            const idx = memStore.practiceRatings.findIndex((x) => x.student_id === r.student_id);
            if (idx >= 0) {
              memStore.practiceRatings[idx] = { ...memStore.practiceRatings[idx], ...r };
            } else {
              memStore.practiceRatings.push(r);
            }
            return { data: r, error: null };
          }
          if (table === 'student_status') {
            const items = Array.isArray(payloadToInsert) ? payloadToInsert : [payloadToInsert];
            for (const item of items) {
              const idx = memStore.studentStatus.findIndex((st) => st.student_id === item.student_id);
              const rec = {
                student_id: item.student_id,
                trust_score: item.trust_score ?? 100,
                status: item.status || 'clear',
                total_penalty: item.total_penalty ?? 0,
                flags_count: item.flags_count ?? 0,
                reviewed_at: item.reviewed_at || null,
                updated_at: new Date().toISOString(),
              };
              if (idx >= 0) {
                memStore.studentStatus[idx] = { ...memStore.studentStatus[idx], ...rec };
              } else {
                memStore.studentStatus.push(rec);
              }
            }
            return { data: payloadToInsert, error: null };
          }
          return { data: payloadToInsert, error: null };
        }

        if (action === 'update') {
          if (table === 'quiz_state') {
            Object.assign(memStore.quizState, payloadToUpdate);
            return { data: { ...memStore.quizState }, error: null };
          }
          if (table === 'flags') {
            let updated = 0;
            for (const f of memStore.flags) {
              if (filters.every((fn) => fn(f))) {
                Object.assign(f, payloadToUpdate);
                updated++;
              }
            }
            return { data: payloadToUpdate, count: updated, error: null };
          }
          if (table === 'reserve_questions') {
            for (const rq of memStore.reserveQuestions) {
              if (filters.every((fn) => fn(rq))) {
                Object.assign(rq, payloadToUpdate);
              }
            }
            return { data: payloadToUpdate, error: null };
          }
          if (table === 'student_status') {
            for (const ss of memStore.studentStatus) {
              if (filters.every((fn) => fn(ss))) {
                Object.assign(ss, payloadToUpdate);
              }
            }
            return { data: payloadToUpdate, error: null };
          }
          if (table === 'practice_sessions') {
            for (const s of memStore.practiceSessions) {
              if (filters.every((fn) => fn(s))) {
                Object.assign(s, payloadToUpdate);
              }
            }
            return { data: payloadToUpdate, error: null };
          }
          if (table === 'questions') {
            for (const q of memStore.questions) {
              if (filters.every((fn) => fn(q))) {
                Object.assign(q, payloadToUpdate);
              }
            }
            return { data: payloadToUpdate, error: null };
          }
          if (table === 'students') {
            let updated = 0;
            for (const s of memStore.students) {
              if (filters.every((fn) => fn(s))) {
                Object.assign(s, payloadToUpdate);
                updated++;
              }
            }
            return { data: payloadToUpdate, count: updated, error: null };
          }

          const updateTableMap: Record<string, any[]> = {
            admin_users: memStore.adminUsers,
            approvals: memStore.approvals,
            event_settings: memStore.eventSettings,
            pauses: memStore.pauses,
            question_voids: memStore.questionVoids,
            announcements: memStore.announcements,
            helpdesk_actions: memStore.helpdeskActions,
            student_notes: memStore.studentNotes,
            flag_decisions: memStore.flagDecisions,
            winner_verification: memStore.winnerVerification,
          };

          if (updateTableMap[table]) {
            let count = 0;
            for (const item of updateTableMap[table]) {
              if (filters.every((fn) => fn(item))) {
                Object.assign(item, payloadToUpdate);
                count++;
              }
            }
            return { data: payloadToUpdate, count, error: null };
          }

          return { data: payloadToUpdate, error: null };
        }

        if (action === 'delete') {
          if (table === 'answers') {
            memStore.answers = [];
            return { data: null, error: null };
          }
          if (table === 'flags') {
            memStore.flags = [];
            return { data: null, error: null };
          }
          return { data: null, error: null };
        }

        // Action: SELECT
        let rows: any[] = [];
        if (table === 'quiz_state') {
          rows = [{ ...memStore.quizState }];
        } else if (table === 'students') {
          rows = [...memStore.students];
        } else if (table === 'questions') {
          rows = [...memStore.questions];
        } else if (table === 'options') {
          rows = [...memStore.options];
        } else if (table === 'student_questions') {
          rows = [...memStore.assignments];
        } else if (table === 'practice_ratings') {
          rows = [...(memStore.practiceRatings || [])];
        } else if (table === 'practice_sessions') {
          rows = [...(memStore.practiceSessions || [])];
        } else if (table === 'practice_answers') {
          rows = (memStore.practiceAnswers || []).map((a) => {
            const q = memStore.questions.find((item) => item.id === a.question_id);
            return {
              ...a,
              questions: q ? { id: q.id, text: q.text, difficulty: q.difficulty, topic: q.topic } : null,
            };
          });
        } else if (table === 'flags') {
          rows = [...memStore.flags];
        } else if (table === 'reviews') {
          rows = [...memStore.reviews];
        } else if (table === 'student_status') {
          rows = [...memStore.studentStatus];
        } else if (table === 'reserve_questions') {
          rows = [...memStore.reserveQuestions];
        } else if (table === 'reserve_options') {
          rows = [...memStore.reserveOptions];
        } else if (table === 'sudden_death') {
          rows = [...memStore.suddenDeath];
        } else if (table === 'winner_verification') {
          rows = [...memStore.winnerVerification];
        } else if (table === 'certificates') {
          rows = [...memStore.certificates];
        } else if (table === 'results_approval') {
          rows = [...memStore.resultsApproval];
        } else if (table === 'answers') {
          rows = memStore.answers.map((a) => {
            const q = memStore.questions.find((item) => item.id === a.question_id);
            const opt = memStore.options.find((item) => item.id === a.option_id);
            return {
              ...a,
              questions: q ? { text: q.text, difficulty: q.difficulty, topic: q.topic, explanation: q.explanation } : null,
              options: opt ? { text: opt.text } : null,
            };
          });
        } else if (table === 'events') {
          rows = [...memStore.events];
        } else if (table === 'login_events') {
          rows = memStore.loginEvents.map((ev) => {
            const s = memStore.students.find((std) => std.id === ev.student_id);
            return {
              ...ev,
              students: s ? { name: s.name, email: s.email } : null,
            };
          });
        } else if (table === 'admin_users') {
          rows = [...memStore.adminUsers];
        } else if (table === 'audit_log') {
          rows = [...memStore.auditLog];
        } else if (table === 'approvals') {
          rows = memStore.approvals.map((ap) => {
            const reqUser = memStore.adminUsers.find((u) => u.id === ap.requested_by);
            return {
              ...ap,
              admin_users: reqUser ? { display_name: reqUser.display_name } : null,
            };
          });
        } else if (table === 'event_settings') {
          rows = [...memStore.eventSettings];
        } else if (table === 'pauses') {
          rows = [...memStore.pauses];
        } else if (table === 'question_voids') {
          rows = [...memStore.questionVoids];
        } else if (table === 'announcements') {
          rows = [...memStore.announcements];
        } else if (table === 'helpdesk_actions') {
          rows = [...memStore.helpdeskActions];
        } else if (table === 'student_notes') {
          rows = [...memStore.studentNotes];
        } else if (table === 'flag_decisions') {
          rows = [...memStore.flagDecisions];
        } else if (table === 'leaderboard') {
          const studentMap = new Map<string, { name: string; college_id: string }>();
          memStore.students.forEach((s) => studentMap.set(s.id, { name: s.name, college_id: s.college_id }));
          const statsMap = new Map<string, { total_points: number; correct_ms: number[]; correct_count: number; total_answers: number }>();

          for (const a of memStore.answers) {
            const prev = statsMap.get(a.student_id) || { total_points: 0, correct_ms: [], correct_count: 0, total_answers: 0 };
            prev.total_points += a.points;
            prev.total_answers += 1;
            if (a.is_correct) {
              prev.correct_ms.push(a.response_ms);
              prev.correct_count += 1;
            }
            statsMap.set(a.student_id, prev);
          }
          for (const [sId] of studentMap) {
            if (!statsMap.has(sId)) {
              statsMap.set(sId, { total_points: 0, correct_ms: [], correct_count: 0, total_answers: 0 });
            }
          }
          const ranked = Array.from(statsMap.entries()).map(([sId, stats]) => {
            const info = studentMap.get(sId) || { name: 'Unknown', college_id: 'N/A' };
            const avgCorrectMs = stats.correct_ms.length > 0
              ? stats.correct_ms.reduce((a, b) => a + b, 0) / stats.correct_ms.length
              : 999999;
            return {
              student_id: sId,
              name: info.name,
              college_id: info.college_id,
              total_points: stats.total_points,
              correct_count: stats.correct_count,
              answered_count: stats.total_answers,
              avg_response_ms: Math.round(avgCorrectMs),
            };
          });
          ranked.sort((a, b) => {
            if (b.total_points !== a.total_points) return b.total_points - a.total_points;
            return a.avg_response_ms - b.avg_response_ms;
          });
          rows = ranked.map((r, i) => ({ rank: i + 1, ...r }));
        } else if (table === 'flagged_students') {
          const studentMap = new Map<string, { name: string; college_id: string }>();
          memStore.students.forEach((s) => studentMap.set(s.id, { name: s.name, college_id: s.college_id }));
          const statsMap = new Map<string, { total_points: number }>();
          for (const a of memStore.answers) {
            const prev = statsMap.get(a.student_id) || { total_points: 0 };
            prev.total_points += a.points;
            statsMap.set(a.student_id, prev);
          }

          const rankedLb = Array.from(studentMap.entries())
            .map(([sId, info]) => ({
              student_id: sId,
              name: info.name,
              college_id: info.college_id,
              total_points: statsMap.get(sId)?.total_points || 0,
            }))
            .sort((a, b) => b.total_points - a.total_points)
            .map((r, i) => ({ rank: i + 1, ...r }));

          const flaggedList: any[] = [];
          for (const s of memStore.students) {
            if (!s.is_active) continue;
            const ss = memStore.studentStatus.find((st) => st.student_id === s.id);
            const studentFlags = memStore.flags.filter((f) => f.student_id === s.id && !f.is_resolved);
            const lb = rankedLb.find((r) => r.student_id === s.id) || { total_points: 0, rank: 999 };
            const status = ss?.status || 'clear';
            const trustScore = ss?.trust_score ?? 100;
            const totalPenalty = ss?.total_penalty ?? 0;

            if (studentFlags.length > 0 || ['review', 'held', 'disqualified'].includes(status)) {
              flaggedList.push({
                student_id: s.id,
                name: s.name,
                college_id: s.college_id,
                trust_score: trustScore,
                status,
                total_penalty: totalPenalty,
                unresolved_flags: studentFlags.length,
                flag_types: studentFlags.map((f) => f.flag_type),
                total_points: lb.total_points,
                original_rank: lb.rank,
                adjusted_score: lb.total_points - totalPenalty,
              });
            }
          }
          flaggedList.sort((a, b) => a.trust_score - b.trust_score);
          rows = flaggedList;
        } else if (table === 'verified_leaderboard') {
          const studentMap = new Map<string, { name: string; college_id: string }>();
          memStore.students.forEach((s) => studentMap.set(s.id, { name: s.name, college_id: s.college_id }));
          const statsMap = new Map<string, { total_points: number; correct_ms: number[]; correct_count: number }>();
          for (const a of memStore.answers) {
            const prev = statsMap.get(a.student_id) || { total_points: 0, correct_ms: [], correct_count: 0 };
            prev.total_points += a.points;
            if (a.is_correct) {
              prev.correct_ms.push(a.response_ms);
              prev.correct_count += 1;
            }
            statsMap.set(a.student_id, prev);
          }

          const verifiedList: any[] = [];
          for (const s of memStore.students) {
            if (!s.is_active) continue;
            const ss = memStore.studentStatus.find((st) => st.student_id === s.id);
            const status = ss?.status || 'clear';
            if (status === 'disqualified') continue;

            const stats = statsMap.get(s.id) || { total_points: 0, correct_ms: [], correct_count: 0 };
            const origScore = stats.total_points;
            const penalty = ss?.total_penalty || 0;
            const finalScore = origScore - penalty;
            const avgMs = stats.correct_ms.length > 0
              ? stats.correct_ms.reduce((a, b) => a + b, 0) / stats.correct_ms.length
              : 999999;

            verifiedList.push({
              student_id: s.id,
              name: s.name,
              college_id: s.college_id,
              original_score: origScore,
              penalty,
              final_score: finalScore,
              correct_count: stats.correct_count,
              avg_response_ms: Math.round(avgMs),
              status,
            });
          }

          verifiedList.sort((a, b) => {
            if (b.final_score !== a.final_score) return b.final_score - a.final_score;
            if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
            return a.avg_response_ms - b.avg_response_ms;
          });

          rows = verifiedList.map((r, i) => ({ final_rank: i + 1, ...r }));
        }

        // Apply filters
        for (const f of filters) {
          rows = rows.filter(f);
        }

        // If head count is requested
        if (isHead || countOption === 'exact') {
          const count = rows.length;
          return { data: isHead ? null : rows, count, error: null };
        }

        // Ordering
        if (orderByCol) {
          rows.sort((a, b) => {
            const valA = a[orderByCol!];
            const valB = b[orderByCol!];
            if (valA < valB) return orderAsc ? -1 : 1;
            if (valA > valB) return orderAsc ? 1 : -1;
            return 0;
          });
        }

        // Limit
        if (limitCount !== null) {
          rows = rows.slice(0, limitCount);
        }

        if (isSingle) {
          if (rows.length === 0) {
            return { data: null, error: { message: 'Row not found' } };
          }
          return { data: rows[0], error: null };
        }

        if (isMaybeSingle) {
          return { data: rows.length > 0 ? rows[0] : null, error: null };
        }

        return { data: rows, error: null };
      }

      return builder;
    },

    storage: {
      from(bucket: string) {
        return {
          async createSignedUrl(storagePath: string, expiresIn: number) {
            return {
              data: {
                signedUrl: `/api/certificates/view?token=${encodeURIComponent(storagePath)}`,
              },
              error: null,
            };
          },
          async upload(storagePath: string, fileData: any, options?: any) {
            return { data: { path: storagePath }, error: null };
          },
          async remove(paths: string[]) {
            return { data: paths, error: null };
          },
          async list(folder?: string) {
            return { data: [], error: null };
          },
        };
      },
      async create_bucket(name: string, options?: any) {
        return { data: { name }, error: null };
      },
      async createBucket(name: string, options?: any) {
        return { data: { name }, error: null };
      },
    },
  };
}

function getAdminClient(): SupabaseClient {
  if (isSupabaseConfigured()) {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return createMockSupabaseClient(store) as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Unified DB Access Layer
// ---------------------------------------------------------------------------

export const db = {
  /**
   * Find student by college ID and join code (case-insensitive)
   */
  async findStudent(collegeId: string, joinCode: string): Promise<Student | null> {
    const cId = collegeId.trim().toLowerCase();
    const code = joinCode.trim().toLowerCase();

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { data, error } = await client
          .from('students')
          .select('*')
          .eq('is_active', true)
          .ilike('college_id', cId)
          .ilike('join_code', code)
          .maybeSingle();

        if (error) throw error;
        if (data) return data as Student;
      } catch (err) {
        console.error('[DB] Supabase findStudent fallback to memory:', err);
      }
    }

    const match = store.students.find(
      (s) => s.is_active && s.college_id.toLowerCase() === cId && s.join_code.toLowerCase() === code
    );
    return match || null;
  },

  /**
   * Log audit event
   */
  async logEvent(studentId: string | null, type: string, metadata: Record<string, unknown> = {}): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        await client.from('events').insert({
          student_id: studentId,
          type,
          metadata,
        });
        return;
      } catch (err) {
        console.error('[DB] Supabase logEvent fallback to memory:', err);
      }
    }

    store.events.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      student_id: studentId,
      type,
      metadata,
      created_at: new Date().toISOString(),
    });
  },

  /**
   * Count students joined from login events
   */
  async getJoinedCount(): Promise<number> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { count, error } = await client
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'login');

        if (error) throw error;
        if (count !== null) return count;
      } catch (err) {
        console.error('[DB] Supabase getJoinedCount fallback to memory:', err);
      }
    }

    const loginStudentIds = new Set(
      store.events.filter((e) => e.type === 'login' && e.student_id).map((e) => e.student_id)
    );
    return loginStudentIds.size;
  },

  /**
   * Check if student had previous login
   */
  async hasPreviousLogin(studentId: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { data } = await client
          .from('events')
          .select('id')
          .eq('student_id', studentId)
          .eq('type', 'login')
          .limit(1);
        return (data && data.length > 0) || false;
      } catch {
        // Fallback
      }
    }
    return store.events.some((e) => e.student_id === studentId && e.type === 'login');
  },

  /**
   * Get Quiz State
   */
  async getQuizState(): Promise<QuizState> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { data, error } = await client
          .from('quiz_state')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) return data as QuizState;
      } catch (err) {
        console.error('[DB] Supabase getQuizState fallback to memory:', err);
      }
    }

    return { ...store.quizState };
  },

  /**
   * Start Quiz (Admin)
   */
  async startQuiz(): Promise<{ ok: boolean; started_at: string }> {
    const startedAt = new Date().toISOString();

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { data: qRow } = await client.from('quiz_state').select('id').limit(1).maybeSingle();
        const qId = qRow?.id || '2d04128a-17b8-4ccf-9f0b-a070a0e24271';
        const { error } = await client
          .from('quiz_state')
          .update({
            status: 'running',
            started_at: startedAt,
          })
          .eq('id', qId);

        if (error) throw error;
      } catch (err) {
        console.error('[DB] Supabase startQuiz fallback to memory:', err);
      }
    }

    store.quizState.status = 'running';
    store.quizState.started_at = startedAt;
    return { ok: true, started_at: startedAt };
  },

  /**
   * Reset Quiz (Admin)
   */
  async resetQuiz(): Promise<{ ok: boolean }> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { error: ansErr } = await client
          .from('answers')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (ansErr) throw ansErr;

        const { data: qRow } = await client.from('quiz_state').select('id').limit(1).maybeSingle();
        const qId = qRow?.id || '2d04128a-17b8-4ccf-9f0b-a070a0e24271';
        const { error: stErr } = await client
          .from('quiz_state')
          .update({
            status: 'waiting',
            started_at: null,
          })
          .eq('id', qId);
        if (stErr) throw stErr;
      } catch (err) {
        console.error('[DB] Supabase resetQuiz fallback to memory:', err);
      }
    }

    store.resetAnswersAndQuiz();
    return { ok: true };
  },

  /**
   * Get personalized question for a student at position n (1 to 15)
   * Enforces 90-question bank drawing from student_questions
   */
  async getQuestionForStudent(
    studentId: string,
    position: number
  ): Promise<{
    id: string;
    position: number;
    text: string;
    difficulty: string;
    topic: string;
    explanation: string;
    points_base: number;
    options: { id: string; text: string; is_correct: boolean; label: string }[];
  } | null> {
    if (position < 1 || position > 15) return null;

    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { data: assignment, error: asgErr } = await client
          .from('student_questions')
          .select('question_id')
          .eq('student_id', studentId)
          .eq('position', position)
          .single();

        if (asgErr || !assignment) throw asgErr;

        const { data: q, error: qErr } = await client
          .from('questions')
          .select('*')
          .eq('id', assignment.question_id)
          .single();

        if (qErr || !q) throw qErr;

        const { data: opts, error: optErr } = await client
          .from('options')
          .select('*')
          .eq('question_id', q.id)
          .order('label');

        if (optErr || !opts) throw optErr;

        return {
          id: q.id,
          position,
          text: q.text,
          difficulty: q.difficulty,
          topic: q.topic,
          explanation: q.explanation,
          points_base: q.points_base || 1000,
          options: opts.map((o) => ({
            id: o.id,
            text: o.text,
            is_correct: o.is_correct,
            label: o.label,
          })),
        };
      } catch (err) {
        console.error(`[DB] Supabase getQuestionForStudent(${studentId}, ${position}) fallback to memory:`, err);
      }
    }

    // In-memory assignment lookup
    const asg = store.assignments.find(
      (a) => a.student_id === studentId && a.position === position
    );

    // Fallback: if student wasn't in pre-seeded assignments (e.g. dynamic student), assign deterministically
    let targetQuestionId = asg?.question_id;
    if (!targetQuestionId) {
      const pool =
        position <= 5
          ? store.questions.filter((q) => q.difficulty === 'easy')
          : position <= 10
          ? store.questions.filter((q) => q.difficulty === 'medium')
          : store.questions.filter((q) => q.difficulty === 'hard');

      targetQuestionId = pool[(position - 1) % pool.length]?.id;
    }

    const q = store.questions.find((item) => item.id === targetQuestionId);
    if (!q) return null;

    const opts = store.options.filter((o) => o.question_id === q.id);

    return {
      id: q.id,
      position,
      text: q.text,
      difficulty: q.difficulty,
      topic: q.topic,
      explanation: q.explanation,
      points_base: q.points_base || 1000,
      options: opts.map((o) => ({
        id: o.id,
        text: o.text,
        is_correct: o.is_correct,
        label: o.label,
      })),
    };
  },

  /**
   * Check if student already answered this question or position
   */
  async hasAnswered(studentId: string, questionId: string, position?: number): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const query = client
          .from('answers')
          .select('id')
          .eq('student_id', studentId);

        if (position !== undefined) {
          query.or(`question_id.eq.${questionId},position.eq.${position}`);
        } else {
          query.eq('question_id', questionId);
        }

        const { data } = await query.maybeSingle();
        return Boolean(data);
      } catch (err) {
        console.error('[DB] Supabase hasAnswered fallback to memory:', err);
      }
    }

    return store.answers.some(
      (a) => a.student_id === studentId && (a.question_id === questionId || (position !== undefined && a.position === position))
    );
  },

  /**
   * Submit answer with position into answers table
   */
  async submitAnswer(params: {
    student_id: string;
    question_id: string;
    option_id: string;
    position: number;
    response_ms: number;
    is_correct: boolean;
    points: number;
  }): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { error } = await client.from('answers').insert(params);
        if (error) throw error;
        return;
      } catch (err) {
        console.error('[DB] Supabase submitAnswer fallback to memory:', err);
      }
    }

    store.answers.push({
      id: `ans-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      student_id: params.student_id,
      question_id: params.question_id,
      option_id: params.option_id,
      position: params.position,
      response_ms: params.response_ms,
      is_correct: params.is_correct,
      points: params.points,
      created_at: new Date().toISOString(),
    });
  },

  /**
   * Aggregate Leaderboard matching the view definition:
   * Rank by total_points DESC, then by AVG(response_ms) on correct answers ASC.
   */
  async getLeaderboard(currentStudentId?: string): Promise<{
    top_10: { rank: number; name: string; college_id: string; total_points: number }[];
    my_rank: number | null;
    my_points: number;
  }> {
    if (isSupabaseConfigured()) {
      try {
        const client = getSupabaseAdmin();
        const { data, error } = await client
          .from('leaderboard')
          .select('*')
          .order('rank', { ascending: true })
          .limit(10);

        if (!error && data) {
          const top_10 = data.map((d) => ({
            rank: d.rank,
            name: d.name,
            college_id: d.college_id,
            total_points: d.total_points,
          }));

          let my_rank: number | null = null;
          let my_points = 0;

          if (currentStudentId) {
            const { data: myData } = await client
              .from('leaderboard')
              .select('rank, total_points')
              .eq('student_id', currentStudentId)
              .maybeSingle();

            if (myData) {
              my_rank = myData.rank;
              my_points = myData.total_points;
            }
          }

          return { top_10, my_rank, my_points };
        }
      } catch (err) {
        console.error('[DB] Supabase getLeaderboard fallback to memory:', err);
      }
    }

    // In-Memory Leaderboard computation matching the PostgreSQL View
    const studentMap = new Map<string, { name: string; college_id: string }>();
    store.students.forEach((s) => studentMap.set(s.id, { name: s.name, college_id: s.college_id }));

    const statsMap = new Map<string, { total_points: number; correct_ms: number[]; total_answers: number }>();

    for (const a of store.answers) {
      const prev = statsMap.get(a.student_id) || { total_points: 0, correct_ms: [], total_answers: 0 };
      prev.total_points += a.points;
      prev.total_answers += 1;
      if (a.is_correct) {
        prev.correct_ms.push(a.response_ms);
      }
      statsMap.set(a.student_id, prev);
    }

    // Include all active students
    for (const [sId] of studentMap) {
      if (!statsMap.has(sId)) {
        statsMap.set(sId, { total_points: 0, correct_ms: [], total_answers: 0 });
      }
    }

    const ranked = Array.from(statsMap.entries()).map(([sId, stats]) => {
      const info = studentMap.get(sId) || { name: 'Unknown', college_id: 'N/A' };
      const avgCorrectMs = stats.correct_ms.length > 0
        ? stats.correct_ms.reduce((a, b) => a + b, 0) / stats.correct_ms.length
        : 999999;

      return {
        student_id: sId,
        name: info.name,
        college_id: info.college_id,
        total_points: stats.total_points,
        avg_correct_ms: avgCorrectMs,
      };
    });

    // Rank: total_points DESC, then avg_correct_ms ASC
    ranked.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return a.avg_correct_ms - b.avg_correct_ms;
    });

    const top_10 = ranked.slice(0, 10).map((r, i) => ({
      rank: i + 1,
      name: r.name,
      college_id: r.college_id,
      total_points: r.total_points,
    }));

    let my_rank: number | null = null;
    let my_points = 0;

    if (currentStudentId) {
      const idx = ranked.findIndex((r) => r.student_id === currentStudentId);
      if (idx !== -1) {
        my_rank = idx + 1;
        my_points = ranked[idx].total_points;
      }
    }

    return { top_10, my_rank, my_points };
  },

  /**
   * Admin statistics
   */
  async getAdminStats(): Promise<{
    status: string;
    students_joined: number;
    answers_per_question: { position: number; count: number; avg_response_ms: number }[];
    top_10: { rank: number; name: string; college_id: string; total_points: number }[];
  }> {
    const state = await this.getQuizState();
    const joined = await this.getJoinedCount();
    const { top_10 } = await this.getLeaderboard();

    const answersPerPosition: { position: number; count: number; avg_response_ms: number }[] = [];

    for (let p = 1; p <= 15; p++) {
      let posAnswers: { response_ms: number }[] = [];

      if (isSupabaseConfigured()) {
        try {
          const client = getSupabaseAdmin();
          const { data } = await client
            .from('answers')
            .select('response_ms')
            .eq('position', p);
          if (data) posAnswers = data;
        } catch {
          posAnswers = store.answers.filter((a) => a.position === p);
        }
      } else {
        posAnswers = store.answers.filter((a) => a.position === p);
      }

      const count = posAnswers.length;
      const avg_response_ms =
        count > 0 ? Math.round(posAnswers.reduce((sum, a) => sum + a.response_ms, 0) / count) : 0;

      answersPerPosition.push({ position: p, count, avg_response_ms });
    }

    return {
      status: state.status,
      students_joined: joined,
      answers_per_question: answersPerPosition,
      top_10,
    };
  },
};
