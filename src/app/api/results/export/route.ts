import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentEvent,
  getAllStudents,
  getAnswersForEvent,
  getAllQuestions,
} from '@/lib/supabase/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await isAuthenticatedAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    const event = await getCurrentEvent();
    const students = await getAllStudents();
    const answers = await getAnswersForEvent(event.id);
    const questions = await getAllQuestions(event.id);

    const format = req.nextUrl.searchParams.get('format') || 'csv';

    // Build tabular dataset
    const rows = students.map((student) => {
      const studentAnswers = answers.filter((a) => a.student_id === student.id);
      const totalScore = studentAnswers.reduce((sum, a) => sum + (a.score_awarded || 0), 0);
      const correctCount = studentAnswers.filter((a) => a.is_correct).length;
      const totalTimeMs = studentAnswers.reduce((sum, a) => sum + (a.time_taken_ms || 0), 0);
      const avgTimeSec = studentAnswers.length > 0 ? (totalTimeMs / studentAnswers.length / 1000).toFixed(2) : '0';

      return {
        college_id: student.college_id,
        name: student.name,
        email: student.email || '',
        total_score: totalScore,
        correct_count: correctCount,
        total_questions: event.total_questions,
        avg_time_seconds: avgTimeSec,
        is_banned: student.is_banned,
        registered_at: student.created_at,
      };
    });

    // Sort by score DESC
    rows.sort((a, b) => b.total_score - a.total_score);

    if (format === 'json') {
      return NextResponse.json({ event_id: event.id, event_name: event.name, count: rows.length, results: rows });
    }

    // CSV format
    const headers = [
      'Rank',
      'College ID',
      'Student Name',
      'Email',
      'Total Score',
      'Correct Answers',
      'Total Questions',
      'Avg Time (s)',
      'Status',
    ];

    const csvLines = [headers.join(',')];
    rows.forEach((r, idx) => {
      const escape = (str: any) => `"${String(str).replace(/"/g, '""')}"`;
      csvLines.push(
        [
          idx + 1,
          escape(r.college_id),
          escape(r.name),
          escape(r.email),
          r.total_score,
          r.correct_count,
          r.total_questions,
          r.avg_time_seconds,
          r.is_banned ? 'Suspended' : 'Active',
        ].join(',')
      );
    });

    const csvContent = csvLines.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="smartlink_git_quiz_results_${event.id.substring(0, 8)}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Export failed' },
      { status: 500 }
    );
  }
}
