/**
 * /api/admin/students/[id]/notes
 * Administrative Notes on Student Records
 *
 * GET: Fetch historical admin notes on the student
 * POST: Append a new note (audit tracked)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";
import { auditLog } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const admin = createSupabaseAdmin();

  const { data: notes, error } = await admin
    .from("student_notes")
    .select("*")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notes: notes || [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const { note, authorName = "Admin" } = await req.json().catch(() => ({}));

  if (!note || !note.trim()) {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

  const { data: created, error } = await admin
    .from("student_notes")
    .insert({
      student_id: id,
      author_name: authorName,
      note: note.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await auditLog({
    eventId,
    actorId: id,
    actorName: authorName,
    action: "add_student_note",
    targetType: "student",
    targetId: id,
    after: { note: note.trim(), author: authorName },
  });

  return NextResponse.json({ success: true, note: created });
}
