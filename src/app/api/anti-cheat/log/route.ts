import { NextRequest, NextResponse } from 'next/server';
import { getCurrentEvent, logAntiCheat } from '@/lib/supabase/server';
import { getAuthenticatedStudent } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event = await getCurrentEvent();
    const body = await req.json();
    const events = Array.isArray(body.events) ? body.events : [];
    const questionNumber = body.question_number || event.current_question_number;

    for (const evt of events) {
      await logAntiCheat({
        event_id: event.id,
        student_id: student.id,
        event_type: evt.type,
        question_number: questionNumber,
        metadata: evt.metadata || {},
        occurred_at: evt.occurred_at || new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, count: events.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Log failed' }, { status: 500 });
  }
}
