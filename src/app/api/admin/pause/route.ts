// src/app/api/admin/pause/route.ts
// Auth: Admin session required.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: state } = await supabase
      .from('quiz_state')
      .select('status')
      .eq('id', 1)
      .single();

    if (state?.status !== 'running') {
      return NextResponse.json(
        { error: 'Quiz is not running.' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('quiz_state')
      .update({ status: 'paused' })
      .eq('id', 1);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to pause.' },
        { status: 500 }
      );
    }

    cache.invalidate('quiz_state');

    return NextResponse.json({ ok: true, status: 'paused' });
  } catch (error) {
    console.error('[API /admin/pause] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
