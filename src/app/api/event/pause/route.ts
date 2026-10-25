import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, updateEvent } from '@/lib/supabase/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await getCurrentEvent();
  const newStatus = event.status === 'paused' ? 'live' : 'paused';
  const now = new Date().toISOString();

  const updates: any = {
    status: newStatus,
    updated_at: now,
  };

  // If unpausing, refresh question timer anchor so students don't lose time
  if (newStatus === 'live' && event.status === 'paused') {
    updates.question_started_at = now;
  }

  const updated = await updateEvent(event.id, updates);

  return NextResponse.json({
    success: true,
    status: newStatus,
    message: newStatus === 'paused' ? 'Event paused' : 'Event resumed',
    event: updated,
  });
}
