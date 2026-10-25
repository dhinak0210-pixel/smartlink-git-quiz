// src/app/api/admin/start/route.ts
// Auth: Admin session required.
// Sets quiz_state to 'running' and records started_at.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // 1. Authenticate
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 2. Check current state
    const { data: state } = await supabase
      .from('quiz_state')
      .select('status')
      .eq('id', 1)
      .single();

    if (state?.status === 'running') {
      return NextResponse.json(
        { error: 'Quiz is already running.' },
        { status: 409 }
      );
    }

    if (state?.status === 'finished') {
      return NextResponse.json(
        { error: 'Quiz has already finished. Reset first.' },
        { status: 409 }
      );
    }

    // 3. Verify at least some students have joined
    const { count } = await supabase
      .from('events')
      .select('student_id', { count: 'exact', head: true })
      .eq('type', 'login');

    if (!count || count < 1) {
      return NextResponse.json(
        { error: 'No students have joined yet.' },
        { status: 400 }
      );
    }

    // 4. Start the quiz
    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from('quiz_state')
      .update({
        status: 'running',
        started_at: startedAt,
      })
      .eq('id', 1);

    if (error) {
      console.error('[API /admin/start] DB error:', error);
      return NextResponse.json(
        { error: 'Failed to start quiz.' },
        { status: 500 }
      );
    }

    // 5. Invalidate caches
    cache.invalidate('quiz_state');
    cache.invalidate('leaderboard');

    return NextResponse.json({
      ok: true,
      started_at: startedAt,
      students_joined: count,
    });
  } catch (error) {
    console.error('[API /admin/start] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
