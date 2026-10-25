import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, updateEvent } from '@/lib/supabase/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized: Admin privileges required' }, { status: 401 });
  }

  const event = await getCurrentEvent();
  const now = new Date().toISOString();

  const updated = await updateEvent(event.id, {
    status: 'live',
    started_at: event.started_at || now,
    current_question_number: 1,
    question_started_at: now,
    server_time_anchor: now,
  });

  return NextResponse.json({
    success: true,
    message: 'Quiz started successfully',
    event: updated,
  });
}
