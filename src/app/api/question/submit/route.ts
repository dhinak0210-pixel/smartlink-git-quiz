import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentEvent,
  getQuestionByNumber,
  checkExistingAnswer,
  storeAnswer,
  logAntiCheat,
} from '@/lib/supabase/server';
import { getAuthenticatedStudent } from '@/lib/auth/session';
import { createSupabaseAdmin } from '@/lib/supabase/admin';
import { calculateScore } from '@/lib/quiz/scoring';
import { resolveOriginalAnswer } from '@/lib/quiz/shuffler';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify student session
    const student = await getAuthenticatedStudent(req);
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized: Valid student session required' }, { status: 401 });
    }

    // 1b. Session kick enforcement: check active_session_id against incoming session
    const incomingSessionId =
      req.cookies.get('quiz_session_id')?.value ||
      req.headers.get('x-session-id') ||
      req.headers.get('x-quiz-session-id');

    if (incomingSessionId) {
      const admin = createSupabaseAdmin();
      const { data: stRow } = await admin
        .from('students')
        .select('active_session_id, status')
        .or(`id.eq.${student.id},auth_user_id.eq.${student.id}`)
        .maybeSingle();

      if (stRow?.active_session_id && stRow.active_session_id !== incomingSessionId) {
        return NextResponse.json(
          { error: 'Session terminated: Another login was detected. Please log in again.' },
          { status: 401 }
        );
      }
    }

    const body = await req.json();
    const questionNumber = Number(body.question_number);
    const selectedAnswerRaw = body.selected_answer ? String(body.selected_answer).toLowerCase() : null;

    // 2. Get current event state
    const event = await getCurrentEvent();
    if (event.status !== 'live') {
      return NextResponse.json({ error: 'Quiz is not actively accepting answers' }, { status: 400 });
    }

    // 3. Validate question_number matches current question
    if (questionNumber !== event.current_question_number) {
      return NextResponse.json(
        { error: `Question #${questionNumber} is not the current active question (#${event.current_question_number})` },
        { status: 400 }
      );
    }

    // 4. Check if already answered
    const existing = await checkExistingAnswer(event.id, student.id, questionNumber);
    if (existing) {
      return NextResponse.json(
        { error: 'You have already submitted an answer for this question' },
        { status: 409 }
      );
    }

    // 5. Compute server-side time taken
    const now = new Date();
    const questionStart = new Date(event.question_started_at || now);
    const timeTakenMs = Math.max(0, now.getTime() - questionStart.getTime());

    const question = await getQuestionByNumber(event.id, questionNumber);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // 4b. Check if question has been voided by organizers
    const adminClient = createSupabaseAdmin();
    const { data: voidRecord } = await adminClient
      .from('question_voids')
      .select('id')
      .or(`question_number.eq.${questionNumber},question_id.eq.${question.id}`)
      .maybeSingle();

    if (voidRecord) {
      return NextResponse.json(
        { error: `Question #${questionNumber} has been voided by organizers.` },
        { status: 400 }
      );
    }

    const timeLimitMs = (question.time_limit_seconds || event.time_per_question_seconds) * 1000;

    // 6. Reject if outside time window (+ 2.5s network grace)
    if (timeTakenMs > timeLimitMs + 2500) {
      return NextResponse.json({ error: 'Time limit expired for this question' }, { status: 400 });
    }

    // 7. Resolve shuffled answer label back to canonical option
    let canonicalSelectedAnswer: 'a' | 'b' | 'c' | 'd' | null = null;
    if (selectedAnswerRaw && ['a', 'b', 'c', 'd'].includes(selectedAnswerRaw)) {
      canonicalSelectedAnswer = event.shuffle_options
        ? resolveOriginalAnswer(selectedAnswerRaw, student.id, question.id, question.shuffle_seed || 42)
        : (selectedAnswerRaw as 'a' | 'b' | 'c' | 'd');
    }

    // 8. Grade the answer
    const isCorrect = canonicalSelectedAnswer === question.correct_answer;

    // 9. Flag suspiciously fast answers (<1.5s)
    if (timeTakenMs < 1500 && canonicalSelectedAnswer) {
      await logAntiCheat({
        event_id: event.id,
        student_id: student.id,
        event_type: 'rapid_answer',
        question_number: questionNumber,
        metadata: {
          time_taken_ms: timeTakenMs,
          is_correct: isCorrect,
          selected_answer: canonicalSelectedAnswer,
        },
      });
    }

    // 10. Calculate score (with negative marking if actively chosen wrong answer)
    const hasAnswered = Boolean(canonicalSelectedAnswer);
    const score = calculateScore(isCorrect, timeTakenMs, timeLimitMs, question.points || 100, hasAnswered);

    // 11. Store answer
    await storeAnswer({
      event_id: event.id,
      student_id: student.id,
      question_id: question.id,
      question_number: questionNumber,
      selected_answer: canonicalSelectedAnswer,
      is_correct: isCorrect,
      time_taken_ms: timeTakenMs,
      score_awarded: score,
      server_received_at: now.toISOString(),
    });

    // 12. Return result with revealed explanation and score
    return NextResponse.json({
      is_correct: isCorrect,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      score_awarded: score,
      time_taken_ms: timeTakenMs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error submitting answer' },
      { status: 500 }
    );
  }
}
