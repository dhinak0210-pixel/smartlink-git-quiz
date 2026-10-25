import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getCurrentEvent, getAnswersForEvent, getAllStudents } from '@/lib/supabase/server';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

interface LeaderboardEntry {
  rank: number;
  student_id: string;
  name: string;
  college_id: string;
  total_points: number;
  total_score?: number;
  correct_count: number;
  answered_count: number;
  avg_response_ms: number;
  avg_time_ms?: number;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate (student or admin)
    const auth = await requireAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 2. Check cache (5-second TTL)
    const cached = cache.get<LeaderboardEntry[]>('leaderboard');
    let leaderboard: LeaderboardEntry[] = [];

    if (cached) {
      leaderboard = cached;
    } else {
      // 3. Check live answers from event
      let computed = false;
      try {
        const event = await getCurrentEvent();
        const answers = await getAnswersForEvent(event.id);
        const students = await getAllStudents();

        if (answers && answers.length > 0) {
          const studentMap = new Map<string, any>();
          for (const s of students) {
            studentMap.set(s.id, s);
          }

          const scoreMap = new Map<string, { total_points: number; correct_count: number; answered_count: number; total_time_ms: number }>();
          for (const a of answers) {
            const sid = a.student_id;
            const curr = scoreMap.get(sid) || { total_points: 0, correct_count: 0, answered_count: 0, total_time_ms: 0 };
            curr.total_points += (a.score_awarded ?? (a as any).points ?? 0);
            if (a.is_correct) curr.correct_count += 1;
            curr.answered_count += 1;
            curr.total_time_ms += (a.time_taken_ms ?? (a as any).response_ms ?? 0);
            scoreMap.set(sid, curr);
          }

          const rows: LeaderboardEntry[] = [];
          for (const [sid, stat] of scoreMap.entries()) {
            const studentInfo = studentMap.get(sid);
            const avgTime = stat.answered_count > 0 ? stat.total_time_ms / stat.answered_count : 0;
            rows.push({
              rank: 1,
              student_id: sid,
              name: studentInfo?.name || 'Unknown Contestant',
              college_id: studentInfo?.college_id || 'UNKNOWN',
              total_points: stat.total_points,
              total_score: stat.total_points,
              correct_count: stat.correct_count,
              answered_count: stat.answered_count,
              avg_response_ms: avgTime,
              avg_time_ms: avgTime,
            });
          }

          rows.sort((a, b) => b.total_points - a.total_points || a.avg_response_ms - b.avg_response_ms);
          rows.forEach((r, idx) => { r.rank = idx + 1; });
          leaderboard = rows;
          computed = true;
        } else if (students && students.length > 0) {
          leaderboard = students.map((s, idx) => ({
            rank: idx + 1,
            student_id: s.id,
            name: s.name || 'Contestant',
            college_id: s.college_id || '',
            total_points: 0,
            total_score: 0,
            correct_count: 0,
            answered_count: 0,
            avg_response_ms: 0,
            avg_time_ms: 0,
          }));
          computed = true;
        }
      } catch (e) {
        console.warn('[Leaderboard] Live event answers calculation failed, falling back:', e);
      }

      if (!computed) {
        leaderboard = [];
      }

      cache.set('leaderboard', leaderboard, 5000);
    }

    // 4. Extract top 10
    const top10 = leaderboard.slice(0, 10).map((entry) => ({
      rank: entry.rank,
      name: entry.name,
      college_id: entry.college_id,
      total_points: entry.total_points,
      total_score: entry.total_points,
      correct_count: entry.correct_count,
      avg_time_ms: entry.avg_response_ms,
    }));

    // 5. Find the requesting student's position if student
    const studentSub = auth.isStudent ? auth.studentId : null;
    const studentPayload = auth.isStudent ? (auth.payload as any) : null;
    const myEntry = studentSub
      ? leaderboard.find((e) => e.student_id === studentSub || (studentPayload?.cid && e.college_id === studentPayload.cid))
      : null;

    return NextResponse.json({
      leaderboard: leaderboard,
      top_10: top10,
      my_rank: myEntry?.rank ?? null,
      my_points: myEntry?.total_points ?? 0,
      my_correct: myEntry?.correct_count ?? 0,
      my_name: myEntry?.name ?? studentPayload?.name ?? null,
      my_college_id: myEntry?.college_id ?? studentPayload?.cid ?? null,
      total_students: leaderboard.length,
    });
  } catch (error) {
    console.error('[API /leaderboard] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
