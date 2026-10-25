// src/app/api/admin/review/route.ts

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { cache } from '@/lib/cache';

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

    const { student_id, flag_id, decision, penalty, reason, admin_name } = body;

    // Validate inputs
    if (!student_id || !decision || !reason || !admin_name) {
      return NextResponse.json(
        { error: 'Missing required fields: student_id, decision, reason, admin_name.' },
        { status: 400 }
      );
    }

    if (!['clear', 'penalize', 'disqualify'].includes(decision)) {
      return NextResponse.json(
        { error: 'Decision must be clear, penalize, or disqualify.' },
        { status: 400 }
      );
    }

    if (decision === 'penalize' && (!penalty || penalty <= 0)) {
      return NextResponse.json(
        { error: 'Penalty must be a positive number for penalize decisions.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Use the database function to apply the decision
    const { error } = await supabase.rpc('apply_review_decision', {
      p_student_id: student_id,
      p_admin_name: admin_name,
      p_decision: decision,
      p_penalty: penalty ?? 0,
      p_reason: reason,
      p_flag_id: flag_id ?? null,
    });

    if (error) {
      console.error('[API /admin/review] RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to apply decision.' },
        { status: 500 }
      );
    }

    // Invalidate caches
    cache.invalidate('leaderboard');
    cache.invalidate('quiz_state');

    return NextResponse.json({
      ok: true,
      decision,
      student_id,
    });
  } catch (error) {
    console.error('[API /admin/review] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
