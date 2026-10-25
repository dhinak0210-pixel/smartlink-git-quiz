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
  const nextQuestionNum = event.current_question_number + 1;
  const now = new Date().toISOString();

  if (nextQuestionNum > event.total_questions) {
    const finished = await updateEvent(event.id, {
      status: 'finished',
      updated_at: now,
    });
    return NextResponse.json({
      success: true,
      status: 'finished',
      message: 'All questions completed. Event finished.',
      event: finished,
    });
  }

  const updated = await updateEvent(event.id, {
    status: 'live',
    current_question_number: nextQuestionNum,
    question_started_at: now,
    server_time_anchor: now,
  });

  return NextResponse.json({
    success: true,
    message: `Advanced to question ${nextQuestionNum}`,
    event: updated,
  });
}
