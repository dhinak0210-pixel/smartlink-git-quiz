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
  const updated = await updateEvent(event.id, {
    status: 'finished',
    updated_at: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    message: 'Quiz event ended',
    event: updated,
  });
}
