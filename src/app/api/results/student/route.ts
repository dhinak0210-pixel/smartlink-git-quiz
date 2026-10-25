import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentEvent,
  getAnswersForStudent,
  getAllQuestions,
  getLeaderboardCache,
} from '@/lib/supabase/server';
import { getAuthenticatedStudent, isAuthenticatedAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const student = await getAuthenticatedStudent(req);
    const isAdmin = await isAuthenticatedAdmin(req);

    if (!student && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await getCurrentEvent();
    const studentId = req.nextUrl.searchParams.get('student_id') || student?.id;
    if (!studentId) {
      return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    const [answers, questions, cache] = await Promise.all([
      getAnswersForStudent(event.id, studentId),
      getAllQuestions(event.id),
      getLeaderboardCache(event.id),
    ]);

    const questionMap = new Map(questions.map((q) => [q.question_number, q]));

    let totalScore = 0;
    let correctCount = 0;
    let totalTimeMs = 0;

    const breakdown = questions.map((q) => {
      const ans = answers.find((a) => a.question_number === q.question_number);
      if (ans) {
        totalScore += ans.score_awarded;
        if (ans.is_correct) correctCount++;
        totalTimeMs += ans.time_taken_ms;
      }

      return {
        question_number: q.question_number,
        question_text: q.question_text,
        topic_tag: q.topic_tag,
        difficulty: q.difficulty,
        points: q.points,
        selected_answer: ans ? ans.selected_answer : null,
        correct_answer: q.correct_answer,
        is_correct: ans ? ans.is_correct : false,
        score_awarded: ans ? ans.score_awarded : 0,
        time_taken_ms: ans ? ans.time_taken_ms : 0,
        explanation: q.explanation,
      };
    });

    // Rank from cached leaderboard
    let rank = 1;
    let totalParticipants = 1;
    if (cache && cache.data) {
      totalParticipants = cache.data.length;
      const entry = cache.data.find((e) => e.student_id === studentId);
      if (entry) rank = entry.rank;
    }

    return NextResponse.json({
      student_id: studentId,
      name: student?.name || 'Student',
      college_id: student?.college_id || 'COLLEGE-ID',
      rank,
      total_participants: totalParticipants,
      total_score: totalScore,
      correct_count: correctCount,
      total_questions: event.total_questions,
      avg_time_ms: answers.length > 0 ? Math.round(totalTimeMs / answers.length) : 0,
      breakdown,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error fetching student results' },
      { status: 500 }
    );
  }
}
