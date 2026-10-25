// src/app/api/admin/stats/route.ts
// Auth: Admin session required.
// Returns comprehensive live stats for the admin dashboard.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getQuizPhase } from '@/lib/quiz/timing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch all needed data in parallel
    const [stateResult, joinedResult, answersResult, leaderboardResult] =
      await Promise.all([
        supabase
          .from('quiz_state')
          .select('*')
          .eq('id', 1)
          .single(),

        supabase
          .from('events')
          .select('student_id', { count: 'exact', head: true })
          .eq('type', 'login'),

        supabase
          .from('answers')
          .select('position, is_correct, response_ms, points'),

        supabase
          .from('leaderboard')
          .select('rank, name, college_id, total_points, correct_count')
          .order('rank', { ascending: true })
          .limit(10),
      ]);

    const state = stateResult.data;
    if (!state) {
      return NextResponse.json(
        { error: 'Quiz state not found.' },
        { status: 500 }
      );
    }

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

    // Aggregate answers per question
    const answersByQuestion = new Map<
      number,
      { count: number; correct: number; totalResponseMs: number }
    >();

    for (const a of answersResult.data ?? []) {
      const existing = answersByQuestion.get(a.position) ?? {
        count: 0,
        correct: 0,
        totalResponseMs: 0,
      };
      existing.count += 1;
      if (a.is_correct) existing.correct += 1;
      existing.totalResponseMs += a.response_ms;
      answersByQuestion.set(a.position, existing);
    }

    const answersPerQuestion = Array.from({ length: 15 }, (_, i) => {
      const pos = i + 1;
      const data = answersByQuestion.get(pos);
      return {
        position: pos,
        answered: data?.count ?? 0,
        correct: data?.correct ?? 0,
        accuracy_pct: data && data.count > 0
          ? Math.round((data.correct / data.count) * 100)
          : 0,
        avg_response_ms: data && data.count > 0
          ? Math.round(data.totalResponseMs / data.count)
          : 0,
      };
    });

    return NextResponse.json({
      status: state.status,
      phase: phase.phase,
      current_question: phase.currentQuestion,
      time_remaining_ms: phase.timeRemainingMs,
      total_elapsed_ms: phase.totalElapsedMs,
      students_joined: joinedResult.count ?? 0,
      total_answers: (answersResult.data ?? []).length,
      answers_per_question: answersPerQuestion,
      top_10: leaderboardResult.data ?? [],
    });
  } catch (error) {
    console.error('[API /admin/stats] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
