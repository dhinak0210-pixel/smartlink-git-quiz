// src/app/api/admin/results-page/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Check how many approvals exist
  const { data: approvals, error: approvalError } = await supabaseAdmin
    .from('results_approval')
    .select('*');

  if (approvalError) {
    return NextResponse.json({ error: approvalError.message }, { status: 500 });
  }

  const existingApprovals = approvals || [];

  const body = await req.json().catch(() => ({}));
  const notes = body.notes || '';
  const approverId = body.organizer_id || body.approved_by || admin.sub;

  // Check if this admin already approved
  const alreadyApproved = existingApprovals.some((a: any) => a.approved_by === approverId);
  if (alreadyApproved) {
    return NextResponse.json({
      error: 'already_approved',
      message: 'You have already approved. Need a different organizer for second approval.',
      approvals: existingApprovals.length
    }, { status: 409 });
  }

  // Record this approval
  const approvalType = existingApprovals.length === 0 ? 'first' : 'second';

  await supabaseAdmin.from('results_approval').insert({
    approved_by: approverId,
    approval_type: approvalType,
    notes
  });

  // If this is the second approval, publish results
  if (existingApprovals.length >= 1) {
    await supabaseAdmin
      .from('quiz_state')
      .update({
        results_published: true,
        results_published_at: new Date().toISOString()
      })
      .eq('id', 1);

    return NextResponse.json({
      published: true,
      message: 'Results page is now live!',
      total_approvals: existingApprovals.length + 1
    });
  }

  return NextResponse.json({
    published: false,
    message: `First approval recorded. Need one more organizer to approve.`,
    total_approvals: existingApprovals.length + 1
  });
}

export async function GET(req: NextRequest) {
  // Check publication status (admin only)
  const admin = await verifyAdminToken(req);
  if (!admin) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: state } = await supabaseAdmin
    .from('quiz_state')
    .select('results_published, results_published_at')
    .eq('id', 1)
    .single();

  const { data: approvals } = await supabaseAdmin
    .from('results_approval')
    .select('*')
    .order('approved_at', { ascending: true });

  return NextResponse.json({
    published: state?.results_published || false,
    published_at: state?.results_published_at,
    approvals: approvals || []
  });
}
