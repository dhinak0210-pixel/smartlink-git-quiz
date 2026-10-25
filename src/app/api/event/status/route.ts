import { NextResponse } from 'next/server';
import { getCurrentEvent, getStudentCount } from '@/lib/supabase/server';
import { EventStatusResponse } from '@/lib/utils/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const event = await getCurrentEvent();
    const studentsJoined = await getStudentCount();

    const responseData: EventStatusResponse = {
      status: event.status,
      event_id: event.id,
      event_name: event.name,
      current_question_number: event.current_question_number,
      total_questions: event.total_questions,
      question_started_at: event.question_started_at || null,
      time_per_question_seconds: event.time_per_question_seconds,
      students_joined: studentsJoined,
      server_time: Date.now(),
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=1, stale-while-revalidate=2',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch event status' },
      { status: 500 }
    );
  }
}
