// src/app/api/admin/cheat-review/decision/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { cache } from '@/lib/cache';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
    }

    const {
      student_id,
      decision,
      primary_reviewer,
      secondary_reviewer,
      reason,
      penalty_points = 0,
    } = body;

    // 1. Validation
    if (!student_id || !decision || !primary_reviewer || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, decision, primary_reviewer, reason.' },
        { status: 400 }
      );
    }

    const validDecisions = ['clear', 'warning', 'penalize', 'disqualify'];
    if (!validDecisions.includes(decision)) {
      return NextResponse.json(
        { error: `Decision must be one of: ${validDecisions.join(', ')}` },
        { status: 400 }
      );
    }

    // Hard Rule #2 & #4: Dual-organizer consensus required for punitive actions
    if (['penalize', 'disqualify'].includes(decision)) {
      if (!secondary_reviewer || secondary_reviewer === primary_reviewer) {
        return NextResponse.json(
          {
            error:
              'Two distinct organizers must sign off before penalizing or disqualifying a candidate.',
          },
          { status: 400 }
        );
      }
    }

    // 2. Persist decision
    const supabase = getSupabaseAdmin();
    const decisionRecord = {
      student_id: String(student_id),
      decision,
      primary_reviewer,
      secondary_reviewer: secondary_reviewer || null,
      reason,
      penalty_points: decision === 'penalize' ? Number(penalty_points) : 0,
      created_at: new Date().toISOString(),
    };

    // Save to reviews audit table in Supabase
    try {
      await supabase.from('reviews').insert([
        {
          student_id: String(student_id),
          admin_name: `${primary_reviewer}${secondary_reviewer ? ` + ${secondary_reviewer}` : ''}`,
          decision,
          penalty: decisionRecord.penalty_points,
          reason,
        },
      ]);
    } catch (dbErr) {
      console.warn('Supabase DB write notice (saving local audit log):', dbErr);
    }

    // Also persist local audit log
    const auditLogDir = path.join(process.cwd(), 'layer5-cheat', 'report', 'output');
    fs.mkdirSync(auditLogDir, { recursive: true });
    const auditLogPath = path.join(auditLogDir, 'decisions_audit.jsonl');
    fs.appendFileSync(auditLogPath, JSON.stringify(decisionRecord) + '\n', 'utf8');

    // 3. Invalidate caches
    cache.invalidate('leaderboard');
    cache.invalidate('quiz_state');

    return NextResponse.json({
      ok: true,
      decision,
      student_id,
      consensus_verified: Boolean(secondary_reviewer),
      applied_at: decisionRecord.created_at,
    });
  } catch (error: any) {
    console.error('[API /admin/cheat-review/decision] Error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
