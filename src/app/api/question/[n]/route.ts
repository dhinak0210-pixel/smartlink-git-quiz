// src/app/api/question/[n]/route.ts
// Auth: Student session required.
// Returns question N with shuffled options. NO correct answer.
// Refuses if question N hasn't opened yet or has already closed.

import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getQuestionWindow } from '@/lib/quiz/timing';
import { shuffleOptions } from '@/lib/quiz/shuffle';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { n: string } }
) {
  try {
    // 1. Authenticate
    const student = await requireStudent();
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 2. Parse and validate question number
    const position = parseInt(params.n, 10);
    if (isNaN(position) || position < 1 || position > 15) {
      return NextResponse.json(
        { error: 'Invalid question number. Must be 1-15.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 3. Get quiz state
    const { data: state, error: stateError } = await supabase
      .from('quiz_state')
      .select('status, started_at, question_seconds, gap_seconds, total_questions')
      .limit(1)
      .maybeSingle();

    if (stateError || !state) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 500 });
    }

    if (state.status !== 'running' && state.status !== 'active') {
      return NextResponse.json(
        { error: 'Quiz is not currently running.' },
        { status: 403 }
      );
    }

    // 4. Check timing window
    const startedAtMs = new Date(state.started_at).getTime();
    const now = Date.now();
    const window = getQuestionWindow(startedAtMs, position, {
      questionSeconds: state.question_seconds || 20,
      gapSeconds: state.gap_seconds || 5,
      totalQuestions: state.total_questions || 15,
      graceMs: 1000,
    });

    if (now < window.opensAtMs) {
      return NextResponse.json(
        { error: 'Question not yet open.' },
        { status: 403 }
      );
    }

    if (now > window.resultClosesAtMs) {
      return NextResponse.json(
        { error: 'Question has closed.' },
        { status: 403 }
      );
    }

    // 5. Get THIS student's question for position N
    // First try student_questions assignment table
    const { data: assignment } = await supabase
      .from('student_questions')
      .select('question_id')
      .eq('student_id', student.sub)
      .eq('position', position)
      .maybeSingle();

    let questionId = assignment?.question_id;

    // Fallback if student has no pre-generated assignment row
    if (!questionId) {
      const { data: qByNum } = await supabase
        .from('questions')
        .select('id')
        .eq('question_number', position)
        .maybeSingle();

      questionId = qByNum?.id;
    }

    // Secondary fallback: select question by index from all active questions
    if (!questionId) {
      const { data: anyQs } = await supabase
        .from('questions')
        .select('id')
        .order('question_number', { ascending: true })
        .limit(15);

      if (anyQs && anyQs.length > 0) {
        questionId = anyQs[(position - 1) % anyQs.length]?.id;
      }
    }

    if (!questionId) {
      return NextResponse.json(
        { error: `Question #${position} not found in question bank.` },
        { status: 404 }
      );
    }

    // 6. Fetch question text and options (NO is_correct)
    const questionCacheKey = `question:${questionId}`;
    let questionData = cache.get<{
      question: { id: string; text: string; difficulty: string; topic: string; points_base: number };
      options: { id: string; text: string }[];
    }>(questionCacheKey);

    if (!questionData) {
      const { data: question, error: qError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (qError || !question) {
        return NextResponse.json(
          { error: 'Question not found.' },
          { status: 500 }
        );
      }

      let { data: options } = await supabase
        .from('options')
        .select('id, text') // NO is_correct field!
        .eq('question_id', questionId)
        .order('label', { ascending: true });

      // Fallback: If options table is empty or missing, read from question columns
      if (!options || options.length < 4) {
        if (question.option_a && question.option_b) {
          options = [
            { id: `${questionId}-opt-a`, text: question.option_a },
            { id: `${questionId}-opt-b`, text: question.option_b },
            { id: `${questionId}-opt-c`, text: question.option_c || 'Option C' },
            { id: `${questionId}-opt-d`, text: question.option_d || 'Option D' },
          ];
        }
      }

      if (!options || options.length < 2) {
        return NextResponse.json(
          { error: 'Options not found for this question.' },
          { status: 500 }
        );
      }

      questionData = {
        question: {
          id: question.id,
          text: question.text || question.question_text || '',
          difficulty: question.difficulty || 'medium',
          topic: question.topic || 'git',
          points_base: question.points_base || 1000,
        },
        options,
      };
      cache.set(questionCacheKey, questionData, 3600_000); // Cache for 1 hour
    }

    // 7. Shuffle options deterministically per student
    const shuffled = shuffleOptions(
      questionData.options,
      student.sub,
      questionId
    );

    // 8. Check if student already answered this question
    const { data: existingAnswer } = await supabase
      .from('answers')
      .select('option_id, is_correct, points, response_ms')
      .eq('student_id', student.sub)
      .eq('question_id', questionId)
      .single();

    // 9. Compute time remaining
    const timeRemainingMs = Math.max(0, window.closesAtMs - now);

    // 10. Build response
    const response: Record<string, unknown> = {
      position,
      question_id: questionId,
      text: questionData.question.text,
      difficulty: questionData.question.difficulty,
      topic: questionData.question.topic,
      points_base: questionData.question.points_base,
      options: shuffled,
      time_remaining_ms: timeRemainingMs,
      already_answered: !!existingAnswer,
    };

    // If already answered, include the result (for the result screen)
    if (existingAnswer) {
      response.your_answer = {
        option_id: existingAnswer.option_id,
        is_correct: existingAnswer.is_correct,
        points: existingAnswer.points,
        response_ms: existingAnswer.response_ms,
      };

      // Also reveal the correct option ID (for the result screen)
      const { data: correctOption } = await supabase
        .from('options')
        .select('id')
        .eq('question_id', questionId)
        .eq('is_correct', true)
        .single();

      if (correctOption) {
        response.correct_option_id = correctOption.id;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(`[API /question/${params.n}] Error:`, error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
