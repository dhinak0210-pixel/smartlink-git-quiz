// src/app/api/admin/reset/route.ts
// Auth: Admin session required.
// Clears all answers and resets quiz state to 'waiting'.
// DANGEROUS: This deletes all student responses.

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

    // 1. Delete all answers
    const { error: deleteError } = await supabase
      .from('answers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('[API /admin/reset] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear answers.' },
        { status: 500 }
      );
    }

    // 2. Reset quiz state
    const { error: updateError } = await supabase
      .from('quiz_state')
      .update({
        status: 'waiting',
        started_at: null,
      })
      .eq('id', 1);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to reset state.' },
        { status: 500 }
      );
    }

    // 3. Clear all caches
    cache.invalidateAll();

    return NextResponse.json({ ok: true, message: 'Quiz reset to waiting.' });
  } catch (error) {
    console.error('[API /admin/reset] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal error.' },
      { status: 500 }
    );
  }
}
