// src/app/api/admin/sudden-death/route.ts

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Sudden Death Round Manager
export async function POST(request: Request) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, round = 1, student_id, option_id, response_ms = 0 } = body;

    const supabase = getSupabaseAdmin();

    if (action === 'start') {
      // Find an unused reserve question
      const { data: question, error: qErr } = await supabase
        .from('reserve_questions')
        .select('id, text, difficulty, topic')
        .eq('is_used', false)
        .limit(1)
        .maybeSingle();

      if (qErr || !question) {
        return NextResponse.json(
          { error: 'No reserve questions available for sudden death.' },
          { status: 404 }
        );
      }

      // Mark as used
      await supabase
        .from('reserve_questions')
        .update({ is_used: true })
        .eq('id', question.id);

      // Get options (WITHOUT is_correct)
      const { data: options } = await supabase
        .from('reserve_options')
        .select('id, text, label')
        .eq('question_id', question.id)
        .order('label');

      return NextResponse.json({
        ok: true,
        round,
        question: {
          id: question.id,
          text: question.text,
          topic: question.topic,
          difficulty: question.difficulty,
          options: options?.map((o: any) => ({
            id: o.id,
            text: o.text,
            label: o.label,
          })) ?? [],
        },
        time_limit_seconds: 30,
        started_at: new Date().toISOString(),
      });
    }

    if (action === 'submit') {
      if (!round || !student_id || !option_id) {
        return NextResponse.json({ error: 'Missing round, student_id, or option_id.' }, { status: 400 });
      }

      // Get the correct option for verification
      const { data: option } = await supabase
        .from('reserve_options')
        .select('id, question_id, is_correct')
        .eq('id', option_id)
        .single();

      if (!option) {
        return NextResponse.json({ error: 'Invalid option selected.' }, { status: 400 });
      }

      const isCorrect = Boolean(option.is_correct);

      await supabase.from('sudden_death').insert({
        round,
        question_id: option.question_id,
        student_id,
        option_id,
        is_correct: isCorrect,
        response_ms: Number(response_ms) || 0,
      });

      // Query correct answers in this round ordered by response_ms
      const { data: correctAnswers } = await supabase
        .from('sudden_death')
        .select('student_id, response_ms')
        .eq('round', round)
        .eq('is_correct', true)
        .order('response_ms', { ascending: true });

      if (correctAnswers && correctAnswers.length > 0) {
        const winnerId = correctAnswers[0].student_id;
        const { data: winnerStudent } = await supabase
          .from('students')
          .select('id, name, college_id')
          .eq('id', winnerId)
          .single();

        return NextResponse.json({
          ok: true,
          resolved: true,
          winner_id: winnerId,
          winner: winnerStudent ?? null,
          response_ms: correctAnswers[0].response_ms,
          message: 'Sudden-death champion decided!',
        });
      }

      return NextResponse.json({
        ok: true,
        resolved: false,
        is_correct: isCorrect,
        message: 'Answer recorded. No tie-breaking correct answer yet.',
      });
    }

    if (action === 'status') {
      const { data: rounds } = await supabase
        .from('sudden_death')
        .select('round, student_id, option_id, is_correct, response_ms, created_at')
        .eq('round', round)
        .order('response_ms', { ascending: true });

      return NextResponse.json({
        ok: true,
        round,
        answers: rounds ?? [],
      });
    }

    return NextResponse.json({ error: `Unknown sudden-death action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[API /admin/sudden-death] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
