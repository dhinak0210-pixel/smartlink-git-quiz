// src/app/api/admin/flags/route.ts

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('flagged_students')
      .select('*')
      .order('trust_score', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to load flags.' }, { status: 500 });
    }

    // Also fetch detailed flags for each student
    const { data: detailedFlags } = await supabase
      .from('flags')
      .select('id, student_id, flag_type, severity, evidence, score_penalty, is_resolved')
      .eq('is_resolved', false)
      .order('severity', { ascending: false });

    // Fetch reviews for audit trail
    const { data: reviews } = await supabase
      .from('reviews')
      .select('student_id, admin_name, decision, penalty, reason, created_at')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      flagged_students: data ?? [],
      detailed_flags: detailedFlags ?? [],
      reviews: reviews ?? [],
    });
  } catch (error) {
    console.error('[API /admin/flags] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
