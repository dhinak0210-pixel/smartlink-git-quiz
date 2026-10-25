// src/app/api/admin/resume/route.ts
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
      .select('id, status')
      .limit(1)
      .maybeSingle();

    if (state?.status !== 'paused') {
      return NextResponse.json(
        { error: 'Quiz is not paused.' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('quiz_state')
      .update({ status: 'active' })
      .eq('id', state.id);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to resume.' },
        { status: 500 }
      );
    }

    cache.invalidate('quiz_state');

    return NextResponse.json({ ok: true, status: 'running' });
  } catch (error) {
    console.error('[API /admin/resume] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
