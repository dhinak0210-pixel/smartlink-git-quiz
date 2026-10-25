import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentEvent,
  getAllQuestions,
  saveQuestion,
  deleteQuestion,
  updateEvent,
} from '@/lib/supabase/server';
import { isAuthenticatedAdmin } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await getCurrentEvent();
  const questions = await getAllQuestions(event.id);
  return NextResponse.json({ event, questions });
}

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await getCurrentEvent();
  const body = await req.json();

  if (body.bulk && Array.isArray(body.questions)) {
    // Bulk import
    const saved = [];
    for (let i = 0; i < body.questions.length; i++) {
      const q = body.questions[i];
      const res = await saveQuestion({
        ...q,
        event_id: event.id,
        question_number: i + 1,
        time_limit_seconds: q.time_limit_seconds || event.time_per_question_seconds,
        points: q.points || 100,
      });
      saved.push(res);
    }
    await updateEvent(event.id, { total_questions: saved.length });
    return NextResponse.json({ success: true, count: saved.length, questions: saved });
  }

  // Single question
  const saved = await saveQuestion({
    ...body,
    event_id: event.id,
  });

  const all = await getAllQuestions(event.id);
  await updateEvent(event.id, { total_questions: all.length });

  return NextResponse.json({ success: true, question: saved });
}

export async function DELETE(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Question ID required' }, { status: 400 });
  }

  await deleteQuestion(id);
  return NextResponse.json({ success: true });
}
