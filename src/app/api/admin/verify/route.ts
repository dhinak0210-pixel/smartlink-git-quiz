// src/app/api/admin/verify/route.ts
// Runs the 8-step winner verification workflow.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { step, admin_name } = body;

    const supabase = getSupabaseAdmin();

    switch (step) {
      case 'freeze': {
        // Step 1: Freeze the leaderboard
        await supabase.from('winner_verification').insert({
          step: 'freeze',
          status: 'completed',
          admin_name: admin_name || 'Admin',
          details: { frozen_at: new Date().toISOString() },
          completed_at: new Date().toISOString(),
        });

        // Set quiz to finished if not already
        const { data: qRow } = await supabase.from('quiz_state').select('id').limit(1).maybeSingle();
        const qId = qRow?.id || '2d04128a-17b8-4ccf-9f0b-a070a0e24271';
        await supabase
          .from('quiz_state')
          .update({ status: 'finished' })
          .eq('id', qId);

        return NextResponse.json({ ok: true, step: 'freeze', message: 'Leaderboard frozen.' });
      }

      case 'compute_flags': {
        // Step 2: Flags count check and audit recording
        const { count } = await supabase
          .from('flags')
          .select('id', { count: 'exact', head: true });

        await supabase.from('winner_verification').insert({
          step: 'compute_flags',
          status: 'completed',
          admin_name: admin_name || 'Admin',
          details: { total_flags: count ?? 0 },
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json({ ok: true, step: 'compute_flags', total_flags: count ?? 0 });
      }

      case 'review_top_10': {
        // Step 3: Check if all top-10 flags are resolved
        const { data: top10 } = await supabase
          .from('leaderboard')
          .select('student_id')
          .order('rank', { ascending: true })
          .limit(10);

        const top10Ids = top10?.map((t: any) => t.student_id) ?? [];

        const { data: unresolved } = await supabase
          .from('flags')
          .select('student_id')
          .in('student_id', top10Ids)
          .eq('is_resolved', false);

        const allReviewed = !unresolved || unresolved.length === 0;

        await supabase.from('winner_verification').insert({
          step: 'review_top_10',
          status: allReviewed ? 'completed' : 'in_progress',
          admin_name: admin_name || 'Admin',
          details: {
            top_10_count: top10Ids.length,
            unresolved_flags: unresolved?.length ?? 0,
            all_reviewed: allReviewed,
          },
          completed_at: allReviewed ? new Date().toISOString() : null,
        });

        return NextResponse.json({
          ok: true,
          step: 'review_top_10',
          all_reviewed: allReviewed,
          unresolved_count: unresolved?.length ?? 0,
        });
      }

      case 'apply_decisions': {
        // Step 4: Recompute rankings after penalties
        const { data: verified } = await supabase
          .from('verified_leaderboard')
          .select('*')
          .order('final_rank', { ascending: true })
          .limit(10);

        await supabase.from('winner_verification').insert({
          step: 'apply_decisions',
          status: 'completed',
          admin_name: admin_name || 'Admin',
          details: { top_3: verified?.slice(0, 3) },
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          step: 'apply_decisions',
          top_3: verified?.slice(0, 3),
        });
      }

      case 'check_ties': {
        // Step 5: Check for ties at the top
        const { data: top } = await supabase
          .from('verified_leaderboard')
          .select('final_rank, final_score, student_id, name')
          .order('final_rank', { ascending: true })
          .limit(5);

        const rank1 = top?.filter((t: any) => t.final_rank === 1) ?? [];
        const hasTie = rank1.length > 1;

        await supabase.from('winner_verification').insert({
          step: 'check_ties',
          status: 'completed',
          admin_name: admin_name || 'Admin',
          details: { has_tie: hasTie, tied_students: rank1 },
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          step: 'check_ties',
          has_tie: hasTie,
          tied_students: rank1,
          needs_sudden_death: hasTie,
        });
      }

      case 'confirm': {
        // Step 6-7: Second organizer confirms, reveal winner
        const { data: final } = await supabase
          .from('verified_leaderboard')
          .select('final_rank, name, college_id, final_score, correct_count')
          .order('final_rank', { ascending: true })
          .limit(3);

        await supabase.from('winner_verification').insert({
          step: 'confirm',
          status: 'completed',
          admin_name: admin_name || 'Admin',
          details: { winners: final },
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
          ok: true,
          step: 'confirm',
          winners: final,
          message: 'Winners confirmed and revealed.',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown step: ${step}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API /admin/verify] Error:', error);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
