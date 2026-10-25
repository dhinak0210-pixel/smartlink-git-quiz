import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, getQuestionByNumber, checkExistingAnswer } from '@/lib/supabase/server';
import { getAuthenticatedStudent, isAuthenticatedAdmin } from '@/lib/auth/session';
import { shuffleStudentOptions } from '@/lib/quiz/shuffler';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const student = await getAuthenticatedStudent(req);
    const isAdmin = await isAuthenticatedAdmin(req);

    if (!student && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Student session required' }, { status: 401 });
    }

    const event = await getCurrentEvent();

    if (event.status !== 'live' && event.status !== 'paused' && !isAdmin) {
      return NextResponse.json(
        { error: 'No active question currently running', status: event.status },
        { status: 400 }
      );
    }

    if (event.current_question_number <= 0) {
      return NextResponse.json(
        { error: 'Quiz has not yet reached question 1' },
        { status: 400 }
      );
    }

    const question = await getQuestionByNumber(event.id, event.current_question_number);
    if (!question) {
      return NextResponse.json(
        { error: `Question #${event.current_question_number} not found` },
        { status: 404 }
      );
    }

    const studentId = student ? student.id : 'admin-preview';
    const existingAnswer = student
      ? await checkExistingAnswer(event.id, student.id, event.current_question_number)
      : null;

    // Deterministic option shuffle per student
    const rawOptions: { originalLabel: 'a' | 'b' | 'c' | 'd'; text: string }[] = [
      { originalLabel: 'a', text: question.option_a },
      { originalLabel: 'b', text: question.option_b },
      { originalLabel: 'c', text: question.option_c },
      { originalLabel: 'd', text: question.option_d },
    ];

    const shuffled = event.shuffle_options
      ? shuffleStudentOptions(rawOptions, studentId, question.id, question.shuffle_seed || 42)
      : rawOptions.map((o) => ({ label: o.originalLabel, text: o.text, originalLabel: o.originalLabel }));

    return NextResponse.json({
      id: question.id,
      question_number: question.question_number,
      question_text: question.question_text,
      question_type: question.question_type,
      options: shuffled.map((s) => ({ label: s.label, text: s.text })),
      difficulty: question.difficulty,
      topic_tag: question.topic_tag,
      time_limit_seconds: question.time_limit_seconds || event.time_per_question_seconds,
      points: question.points,
      already_answered: Boolean(existingAnswer),
      your_answer: existingAnswer ? existingAnswer.selected_answer : null,
      your_score: existingAnswer ? existingAnswer.score_awarded : null,
      your_is_correct: existingAnswer ? existingAnswer.is_correct : null,
      // If already answered, allow seeing correct answer and explanation
      revealed_correct_answer: existingAnswer ? question.correct_answer : undefined,
      revealed_explanation: existingAnswer ? question.explanation : undefined,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error retrieving current question' },
      { status: 500 }
    );
  }
}
