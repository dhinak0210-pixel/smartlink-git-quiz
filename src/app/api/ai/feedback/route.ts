import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentEvent,
  getAllStudents,
  getAnswersForEvent,
  getAllQuestions,
} from '@/lib/supabase/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';
import { generateStudentFeedbackWithGemini } from '@/lib/ai/gemini';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await isAuthenticatedAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const event = await getCurrentEvent();
    const students = await getAllStudents();
    const answers = await getAnswersForEvent(event.id);
    const questions = await getAllQuestions(event.id);

    const questionMap = new Map(questions.map((q) => [q.question_number, q]));

    // Batch process or process a requested student
    const body = await req.json().catch(() => ({}));
    const requestedStudentId = body.student_id;

    const targetStudents = requestedStudentId
      ? students.filter((s) => s.id === requestedStudentId)
      : students.slice(0, 5); // Limit batch size to stay within free tier

    const results = [];

    for (const st of targetStudents) {
      const studentAnswers = answers.filter((a) => a.student_id === st.id);
      const totalScore = studentAnswers.reduce((sum, a) => sum + (a.score_awarded || 0), 0);
      const correctCount = studentAnswers.filter((a) => a.is_correct).length;
      const totalTimeMs = studentAnswers.reduce((sum, a) => sum + (a.time_taken_ms || 0), 0);
      const avgTime = studentAnswers.length > 0 ? (totalTimeMs / studentAnswers.length / 1000).toFixed(1) : '0';

      // Topic breakdown
      const topicStats: Record<string, { correct: number; total: number }> = {};
      const weakTopics: string[] = [];

      studentAnswers.forEach((ans) => {
        const q = questionMap.get(ans.question_number);
        const topic = q?.topic_tag || 'general';
        if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
        topicStats[topic].total++;
        if (ans.is_correct) topicStats[topic].correct++;
      });

      Object.entries(topicStats).forEach(([t, s]) => {
        if (s.correct < s.total) weakTopics.push(t);
      });

      const topicBreakdownStr = Object.entries(topicStats)
        .map(([t, s]) => `${t}: ${s.correct}/${s.total} correct`)
        .join(', ');

      const feedback = await generateStudentFeedbackWithGemini({
        name: st.name,
        score: totalScore,
        total_possible: questions.reduce((sum, q) => sum + q.points, 0) || 1500,
        rank: 1, // approximate
        total_students: students.length,
        correct_count: correctCount,
        total_questions: event.total_questions,
        avg_time: Number(avgTime),
        topic_breakdown: topicBreakdownStr,
        weak_topics: weakTopics.join(', '),
      });

      results.push({
        student_id: st.id,
        name: st.name,
        college_id: st.college_id,
        score: totalScore,
        correct_count: correctCount,
        ...feedback,
      });
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      feedback_reports: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Feedback generation failed' },
      { status: 500 }
    );
  }
}
