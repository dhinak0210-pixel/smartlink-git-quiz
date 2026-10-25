// src/app/api/results/route.ts
// Auth: Student session required.
// Returns the student's complete quiz results for the final screen.

import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { maxPossibleScore } from '@/lib/quiz/scoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const student = await requireStudent();
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get all answers for this student with question details
    const { data: answers, error } = await supabase
      .from('answers')
      .select(`
        question_id,
        position,
        option_id,
        response_ms,
        is_correct,
        points,
        questions (
          text,
          difficulty,
          topic,
          explanation
        ),
        options (
          text
        )
      `)
      .eq('student_id', student.sub)
      .order('position', { ascending: true });

    if (error) {
      console.error('[API /results] DB error:', error);
      return NextResponse.json(
        { error: 'Failed to load results.' },
        { status: 500 }
      );
    }

    // 2. Get correct options for each question
    const questionIds = (answers ?? []).map((a) => a.question_id);
    const { data: correctOptions } =
      questionIds.length > 0
        ? await supabase
            .from('options')
            .select('question_id, text')
            .in('question_id', questionIds)
            .eq('is_correct', true)
        : { data: [] };

    const correctMap = new Map(
      (correctOptions ?? []).map((o) => [o.question_id, o.text])
    );

    // 3. Get student's rank from leaderboard
    const { data: leaderboard } = await supabase
      .from('leaderboard')
      .select('rank, total_points, correct_count')
      .eq('student_id', student.sub)
      .single();

    // 4. Build response
    const totalPoints = (answers ?? []).reduce((sum, a) => sum + (a.points || 0), 0);
    const correctCount = (answers ?? []).filter((a) => a.is_correct).length;
    const maxScore = maxPossibleScore();

    const questionResults = (answers ?? []).map((a) => {
      const q = a.questions as { text?: string; difficulty?: string; topic?: string; explanation?: string } | null;
      const opt = a.options as { text?: string } | null;
      return {
        position: a.position,
        question_text: q?.text ?? '',
        difficulty: q?.difficulty ?? '',
        topic: q?.topic ?? '',
        explanation: q?.explanation ?? '',
        your_answer: opt?.text ?? 'No answer',
        correct_answer: correctMap.get(a.question_id) ?? '',
        is_correct: a.is_correct,
        points: a.points,
        response_ms: a.response_ms,
      };
    });

    return NextResponse.json({
      name: student.name,
      college_id: student.cid,
      total_points: totalPoints,
      max_possible: maxScore,
      percentage: Math.round((totalPoints / maxScore) * 100),
      correct_count: correctCount,
      total_questions: 15,
      rank: leaderboard?.rank ?? null,
      total_students: 200,
      questions: questionResults,
    });
  } catch (error) {
    console.error('[API /results] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
