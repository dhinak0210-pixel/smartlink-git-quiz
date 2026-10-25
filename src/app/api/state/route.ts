// src/app/api/state/route.ts
// Public endpoint. No auth required.
// Polled by 200 students every 2 seconds during lobby and quiz.
// Must be fast: <50ms response time.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { cache } from '@/lib/cache';
import { getQuizPhase } from '@/lib/quiz/timing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check cache first (1-second TTL)
    const cached = cache.get<Record<string, unknown>>('quiz_state');
    if (cached) {
      return NextResponse.json({
        ...cached,
        server_time: Date.now(), // Always fresh server time
      });
    }

    // Fetch from database
    const supabase = getSupabaseAdmin();

    const [stateResult, countResult] = await Promise.all([
      supabase
        .from('quiz_state')
        .select('status, started_at, question_seconds, gap_seconds, total_questions')
        .eq('id', 1)
        .single(),
      supabase
        .from('events')
        .select('student_id', { count: 'exact', head: true })
        .eq('type', 'login'),
    ]);

    if (stateResult.error || !stateResult.data) {
      console.error('[API /state] DB error:', stateResult.error);
      return NextResponse.json(
        { error: 'Internal error.' },
        { status: 500 }
      );
    }

    const state = stateResult.data;
    const studentsJoined = countResult.count ?? 0;

    const phase = getQuizPhase(
      state.status,
      state.started_at ? new Date(state.started_at).getTime() : null,
      {
        questionSeconds: state.question_seconds,
        gapSeconds: state.gap_seconds,
        totalQuestions: state.total_questions,
        graceMs: 1000,
      }
    );

    const responseData = {
      status: state.status,
      started_at: state.started_at,
      question_seconds: state.question_seconds,
      gap_seconds: state.gap_seconds,
      total_questions: state.total_questions,
      current_question: phase.currentQuestion,
      phase: phase.phase,
      time_remaining_ms: phase.timeRemainingMs,
      students_joined: studentsJoined,
    };

    // Cache for 1 second (reduces DB load from 200 req/s to ~1 req/s)
    cache.set('quiz_state', responseData, 1000);

    return NextResponse.json({
      ...responseData,
      server_time: Date.now(),
    });
  } catch (error) {
    console.error('[API /state] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
