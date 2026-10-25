// src/app/api/admin/next/route.ts
// Auth: Admin session required.
// Advances the quiz clock by jumping started_at backward
// so that the next question appears to open "now".

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getQuizPhase } from '@/lib/quiz/timing';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: state } = await supabase
      .from('quiz_state')
      .select('status, started_at, question_seconds, gap_seconds, total_questions')
      .eq('id', 1)
      .single();

    if (!state || state.status !== 'running' || !state.started_at) {
      return NextResponse.json(
        { error: 'Quiz is not running.' },
        { status: 409 }
      );
    }

    const startedAtMs = new Date(state.started_at).getTime();
    const phase = getQuizPhase(state.status, startedAtMs, {
      questionSeconds: state.question_seconds,
      gapSeconds: state.gap_seconds,
      totalQuestions: state.total_questions,
      graceMs: 1000,
    });

    const nextQuestion = phase.currentQuestion + 1;

    if (nextQuestion > state.total_questions) {
      // Quiz is over
      await supabase
        .from('quiz_state')
        .update({ status: 'finished' })
        .eq('id', 1);

      cache.invalidate('quiz_state');
      cache.invalidate('leaderboard');

      return NextResponse.json({ ok: true, status: 'finished' });
    }

    // Adjust started_at so that nextQuestion opens NOW
    const cycleMs = (state.question_seconds + state.gap_seconds) * 1000;
    const newStartedAtMs = Date.now() - (nextQuestion - 1) * cycleMs;
    const newStartedAt = new Date(newStartedAtMs).toISOString();

    const { error } = await supabase
      .from('quiz_state')
      .update({ started_at: newStartedAt })
      .eq('id', 1);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to advance.' },
        { status: 500 }
      );
    }

    cache.invalidate('quiz_state');

    return NextResponse.json({
      ok: true,
      current_question: nextQuestion,
      started_at: newStartedAt,
    });
  } catch (error) {
    console.error('[API /admin/next] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
