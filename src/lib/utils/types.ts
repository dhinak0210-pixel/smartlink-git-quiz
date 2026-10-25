export type EventStatus = 'draft' | 'lobby' | 'live' | 'paused' | 'finished';

export interface Student {
  id: string;
  college_id: string;
  name: string;
  email?: string | null;
  session_token: string;
  logged_in_at: string;
  clock_offset_ms: number;
  is_banned: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  status: EventStatus;
  total_questions: number;
  time_per_question_seconds: number;
  started_at?: string | null;
  current_question_number: number;
  question_started_at?: string | null;
  server_time_anchor?: string | null;
  allow_late_join: boolean;
  shuffle_options: boolean;
  created_at: string;
  updated_at: string;
}

export type QuestionType = 'mcq' | 'true_false' | 'fill_blank';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  event_id: string;
  question_number: number;
  question_text: string;
  question_type: QuestionType;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'a' | 'b' | 'c' | 'd';
  explanation: string;
  difficulty: Difficulty;
  topic_tag: string;
  time_limit_seconds: number;
  points: number;
  shuffle_seed?: number;
  ai_generated?: boolean;
  validated?: boolean;
  created_at?: string;
}

export interface SafeQuestion {
  id: string;
  event_id: string;
  question_number: number;
  question_text: string;
  question_type: QuestionType;
  options: {
    label: 'a' | 'b' | 'c' | 'd';
    text: string;
    originalLabel?: 'a' | 'b' | 'c' | 'd';
  }[];
  difficulty: Difficulty;
  topic_tag: string;
  time_limit_seconds: number;
  points: number;
  already_answered: boolean;
  your_answer?: string | null;
}

export interface Answer {
  id: string;
  event_id: string;
  student_id: string;
  question_id: string;
  question_number: number;
  selected_answer: string | null;
  is_correct: boolean | null;
  time_taken_ms: number;
  score_awarded: number;
  submitted_at: string;
  server_received_at: string;
}

export interface AntiCheatLog {
  id?: string;
  event_id: string;
  student_id: string;
  event_type: 'tab_switch' | 'window_blur' | 'copy_attempt' | 'right_click' | 'keyboard_shortcut' | 'devtools_attempt' | 'rapid_answer' | 'suspicious_pattern';
  question_number?: number;
  metadata?: Record<string, any>;
  occurred_at?: string;
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  name: string;
  college_id: string;
  total_score: number;
  correct_count: number;
  avg_time_ms: number;
}

export interface LeaderboardCache {
  event_id: string;
  cached_at: string;
  data: LeaderboardEntry[];
}

export interface EventStatusResponse {
  status: EventStatus;
  event_id: string;
  event_name: string;
  current_question_number: number;
  total_questions: number;
  question_started_at: string | null;
  time_per_question_seconds: number;
  students_joined: number;
  server_time: number;
}

export interface SubmitAnswerResult {
  is_correct: boolean;
  correct_answer: string;
  explanation: string;
  score_awarded: number;
  time_taken_ms: number;
}
