// src/app/api/events/log/route.ts
// Auth: Student session required.
// Receives batched anti-cheat events from the client.
// Writes to the events table with server timestamps.

import { NextResponse } from 'next/server';
import { requireStudent } from '@/lib/auth/guard';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Allowed event types (whitelist to prevent log spam)
const ALLOWED_TYPES = new Set([
  'monitor_started',
  'tab_switch',
  'tab_return',
  'window_blur',
  'window_focus',
  'copy_blocked',
  'cut_blocked',
  'paste_blocked',
  'contextmenu_blocked',
  'shortcut_blocked',
  'fullscreen_exit',
  'page_reload',
]);

export async function POST(request: Request) {
  try {
    const student = await requireStudent();
    if (!student) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.events)) {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    // Validate and sanitize events
    const validEvents = body.events
      .filter((e: any) =>
        e &&
        typeof e.type === 'string' &&
        ALLOWED_TYPES.has(e.type) &&
        typeof e.timestamp === 'number'
      )
      .slice(0, 50) // Max 50 events per batch
      .map((e: any) => ({
        student_id: student.sub,
        type: e.type,
        metadata: {
          question_position: e.questionPosition ?? null,
          client_timestamp: e.timestamp,
          ...(e.metadata ?? {}),
        },
      }));

    if (validEvents.length === 0) {
      return NextResponse.json({ ok: true, logged: 0 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('events').insert(validEvents);

    if (error) {
      console.error('[API /events/log] Insert error:', error);
      // Don't fail the request — monitoring is best-effort
    }

    return NextResponse.json({ ok: true, logged: validEvents.length });
  } catch (error) {
    console.error('[API /events/log] Unexpected error:', error);
    return NextResponse.json({ ok: true, logged: 0 }); // Don't break the quiz
  }
}
