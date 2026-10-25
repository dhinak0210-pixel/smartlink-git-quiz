// src/app/api/certificates/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyStudentToken } from '@/lib/auth';
import { getAllStudents, getCurrentEvent, getAnswersForEvent } from '@/lib/supabase/server';
import { getCertificateInfo } from '@/lib/certificates/generator';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let student = await verifyStudentToken(req);
    const queryCollegeId = req.nextUrl.searchParams.get('college_id') || req.nextUrl.searchParams.get('reg');

    const students = await getAllStudents();

    // If query parameter college_id is provided, look up that student
    if (queryCollegeId && queryCollegeId.trim()) {
      const cleanQuery = queryCollegeId.trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '');
      const match = students.find((s) => {
        const c1 = (s.college_id || '').trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '');
        const c2 = ((s as any).register_no || '').trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '');
        return c1 === cleanQuery || c2 === cleanQuery;
      });

      if (match) {
        student = match as any;
      } else {
        // Fallback for valid participant register numbers not in current active slice
        student = {
          id: queryCollegeId.trim().toUpperCase(),
          name: queryCollegeId.trim(),
          college_id: queryCollegeId.trim().toUpperCase(),
        } as any;
      }
    }

    if (!student) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Please log in or provide your Register Number.' },
        { status: 401 }
      );
    }

    // Determine student rank and score from event answers
    let rank = 50;
    let studentScore = 1200;

    try {
      const event = await getCurrentEvent();
      const answers = await getAnswersForEvent(event.id);

      // Calculate scores for all students
      const scoreMap = new Map<string, { total_points: number; total_time_ms: number }>();
      for (const a of answers || []) {
        const sid = a.student_id;
        const curr = scoreMap.get(sid) || { total_points: 0, total_time_ms: 0 };
        curr.total_points += (a.score_awarded ?? (a as any).points ?? 0);
        curr.total_time_ms += (a.time_taken_ms ?? (a as any).response_ms ?? 0);
        scoreMap.set(sid, curr);
      }

      // Rank all students
      const sorted = [...students].map((s) => {
        const sc = scoreMap.get(s.id) || { total_points: 0, total_time_ms: 0 };
        return {
          id: s.id,
          name: s.name,
          college_id: s.college_id,
          score: sc.total_points,
          time_ms: sc.total_time_ms,
        };
      });

      sorted.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.time_ms - b.time_ms;
      });

      const cleanTargetId = (student.college_id || '').trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '');
      const rankIndex = sorted.findIndex((s) => 
        (s.college_id || '').trim().toUpperCase().replace(/[^A-Za-z0-9]/g, '') === cleanTargetId
      );

      if (rankIndex >= 0) {
        rank = rankIndex + 1;
        studentScore = sorted[rankIndex].score;
      }
    } catch (e) {
      console.warn('[CertificateDownload] Ranking calculation warning:', e);
    }

    const certData = getCertificateInfo({
      id: student.id,
      name: student.name,
      college_id: student.college_id,
      rank,
      total_score: studentScore,
    });

    return NextResponse.json({
      download_url: `/api/certificates/view?college_id=${encodeURIComponent(student.college_id)}`,
      tier: certData.tier,
      cert_id: certData.cert_id,
      cert_title: certData.cert_title,
      badge: certData.badge,
      citation: certData.citation,
      name: certData.name,
      college_id: certData.college_id,
      rank: certData.rank,
      total_score: certData.total_score,
      expires_in: 3600,
    });
  } catch (err: any) {
    console.error('Certificate download error:', err);
    return NextResponse.json({ error: 'server_error', message: err.message }, { status: 500 });
  }
}
