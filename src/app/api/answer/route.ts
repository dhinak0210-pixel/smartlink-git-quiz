// src/app/api/answer/route.ts
// Auth: Student session required.
// Accepts an answer, grades it server-side, stores the result.
// This is the most security-critical route in the entire application.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireStudent } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { validateAnswerTiming } from '@/lib/quiz/timing';
import { computeScore } from '@/lib/quiz/scoring';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const student = await requireStudent();
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 1b. Session kick enforcement: check active_session_id in DB
    const cookieStore = cookies();
    const incomingSessionId =
      cookieStore.get('quiz_session_id')?.value ||
      request.headers.get('x-session-id') ||
      request.headers.get('x-quiz-session-id');

    if (incomingSessionId) {
      const supabaseAdmin = getSupabaseAdmin();
      const { data: stRow } = await supabaseAdmin
        .from('students')
        .select('active_session_id')
        .or(`id.eq.${student.sub},auth_user_id.eq.${student.sub}`)
        .maybeSingle();

      if (stRow?.active_session_id && stRow.active_session_id !== incomingSessionId) {
        return NextResponse.json(
          { error: 'Session terminated: Another login was detected. Please log in again.' },
          { status: 401 }
        );
      }
    }

    // 2. Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    const question_position = Number(body.question_position ?? body.questionNumber ?? body.position);
    const option_id = String(body.option_id ?? body.selectedOption ?? body.selected_option ?? '');

    if (
      isNaN(question_position) ||
      question_position < 1 ||
      question_position > 15 ||
      !option_id ||
      option_id.length < 5
    ) {
      return NextResponse.json(
        { error: 'Invalid question_position or option_id.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 3. Get quiz state
    const { data: state } = await supabase
      .from('quiz_state')
      .select('status, started_at, question_seconds, gap_seconds, total_questions')
      .limit(1)
      .maybeSingle();

    if (!state || (state.status !== 'running' && state.status !== 'active') || !state.started_at) {
      return NextResponse.json(
        { error: 'Quiz is not running.' },
        { status: 403 }
      );
    }

    // 4. Validate timing (SERVER-SIDE — never trust client timestamps)
    const startedAtMs = new Date(state.started_at).getTime();
    const serverNow = Date.now();

    const timing = validateAnswerTiming(
      startedAtMs,
      question_position,
      serverNow,
      {
        questionSeconds: state.question_seconds || 20,
        gapSeconds: state.gap_seconds || 5,
        totalQuestions: state.total_questions || 15,
        graceMs: 1000,
      }
    );

    if (!timing.valid) {
      return NextResponse.json(
        { error: timing.reason },
        { status: 403 }
      );
    }

    // 5. Get the student's assigned question for this position
    const { data: assignment } = await supabase
      .from('student_questions')
      .select('question_id')
      .eq('student_id', student.sub)
      .eq('position', question_position)
      .maybeSingle();

    let questionId = assignment?.question_id;

    if (!questionId) {
      const { data: fallbackQ } = await supabase
        .from('questions')
        .select('id')
        .eq('question_number', question_position)
        .maybeSingle();

      questionId = fallbackQ?.id;
    }

    if (!questionId) {
      const { data: anyQs } = await supabase
        .from('questions')
        .select('id')
        .order('question_number', { ascending: true })
        .limit(15);

      if (anyQs && anyQs.length > 0) {
        questionId = anyQs[(question_position - 1) % anyQs.length]?.id;
      }
    }

    if (!questionId) {
      return NextResponse.json(
        { error: 'Question not found.' },
        { status: 404 }
      );
    }

    // 5b. Check if question has been voided by organizers
    const { data: voidRecord } = await supabase
      .from('question_voids')
      .select('id')
      .or(`question_number.eq.${question_position},question_id.eq.${questionId}`)
      .maybeSingle();

    if (voidRecord) {
      return NextResponse.json(
        { error: `Question #${question_position} has been voided by organizers.` },
        { status: 400 }
      );
    }

    // 6. Verify the option belongs to this question & check correctness
    let isCorrect = false;
    const { data: option } = await supabase
      .from('options')
      .select('id, is_correct')
      .eq('id', option_id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (option) {
      isCorrect = Boolean(option.is_correct);
    } else {
      // Fallback: check columns on question record itself
      const { data: qRecord } = await supabase
        .from('questions')
        .select('correct_answer, correct_answer_index, option_a, option_b, option_c, option_d')
        .eq('id', questionId)
        .maybeSingle();

      if (qRecord) {
        const optLetter = option_id.endsWith('-opt-a') ? 'a' :
                          option_id.endsWith('-opt-b') ? 'b' :
                          option_id.endsWith('-opt-c') ? 'c' :
                          option_id.endsWith('-opt-d') ? 'd' : option_id.toLowerCase();
        const expected = (qRecord.correct_answer || '').toLowerCase();
        isCorrect = optLetter === expected || (
          typeof qRecord.correct_answer_index === 'number' &&
          ((optLetter === 'a' && qRecord.correct_answer_index === 0) ||
           (optLetter === 'b' && qRecord.correct_answer_index === 1) ||
           (optLetter === 'c' && qRecord.correct_answer_index === 2) ||
           (optLetter === 'd' && qRecord.correct_answer_index === 3))
        );
      }
    }

    // 7. Check for duplicate submission
    const { data: existing } = await supabase
      .from('answers')
      .select('id')
      .eq('student_id', student.sub)
      .eq('question_id', questionId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already answered this question.' },
        { status: 409 }
      );
    }

    // 8. Compute score (SERVER-SIDE)
    const scoreResult = computeScore(
      isCorrect,
      timing.responseMs
    );

    // 9. Store the answer
    const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";
    const { error: insertError } = await supabase
      .from('answers')
      .insert({
        event_id: eventId,
        student_id: student.sub,
        question_id: questionId,
        selected_option: option_id,
        response_ms: timing.responseMs,
        is_correct: scoreResult.isCorrect,
        points: scoreResult.points,
      });

    if (insertError) {
      // Handle race condition: two submissions at the exact same time
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already answered this question.' },
          { status: 409 }
        );
      }
      console.error('[API /answer] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save answer.' },
        { status: 500 }
      );
    }

    // 10. Invalidate leaderboard cache (new answer changes rankings)
    cache.invalidate('leaderboard');

    // 11. Get the correct option ID and explanation for the result screen
    const { data: correctOption } = await supabase
      .from('options')
      .select('id')
      .eq('question_id', questionId)
      .eq('is_correct', true)
      .single();

    const { data: question } = await supabase
      .from('questions')
      .select('explanation')
      .eq('id', questionId)
      .single();

    // 12. Return the result
    return NextResponse.json({
      is_correct: scoreResult.isCorrect,
      points: scoreResult.points,
      speed_bonus: scoreResult.speedBonus,
      response_ms: timing.responseMs,
      correct_option_id: correctOption?.id ?? null,
      explanation: question?.explanation ?? '',
    });
  } catch (error) {
    console.error('[API /answer] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
