/**
 * /api/admin/appeals
 *
 * GET /api/admin/appeals: List student appeals (Admin only)
 * POST /api/admin/appeals: Submit appeal (Student) or resolve appeal (Admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedStudent, isAuthenticatedAdmin } from "@/lib/auth/session";
import { auditLog } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const eventId = req.nextUrl.searchParams.get("eventId") ||
    process.env.DEFAULT_EVENT_ID ||
    "00000000-0000-0000-0000-000000000001";

  const { data: appeals, error } = await admin
    .from("appeals")
    .select("*, students(name, email, register_no)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ appeals: appeals || [] });
}

export async function POST(req: NextRequest) {
  const admin = createSupabaseAdmin();
  const body = await req.json().catch(() => ({}));
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

  const isAdmin = await isAuthenticatedAdmin(req);

  // If Admin resolving appeal
  if (isAdmin && body.action === "resolve") {
    const { appealId, resolution, notes } = body;
    if (!appealId || !resolution) {
      return NextResponse.json({ error: "appealId and resolution required" }, { status: 400 });
    }

    const { error: updateErr } = await admin
      .from("appeals")
      .update({
        status: resolution, // 'approved' | 'rejected'
        admin_notes: notes || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", appealId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await auditLog({
      eventId,
      actorId: "admin",
      actorName: "Organizer",
      action: "resolve_appeal",
      targetType: "appeal",
      targetId: appealId,
      after: { resolution, notes },
    });

    return NextResponse.json({ success: true, message: `Appeal ${resolution}` });
  }

  // Student submitting appeal
  const student = await getAuthenticatedStudent(req);
  if (!student) {
    return NextResponse.json({ error: "Unauthorized: Student session required" }, { status: 401 });
  }

  const { reason, questionNumber } = body;
  if (!reason || reason.trim().length < 10) {
    return NextResponse.json({ error: "Please provide a detailed explanation for your appeal (at least 10 characters)." }, { status: 400 });
  }

  const { data: created, error: insertErr } = await admin.from("appeals").insert({
    event_id: eventId,
    student_id: student.id,
    question_number: questionNumber ? Number(questionNumber) : null,
    reason: reason.trim(),
    status: "pending",
  }).select().single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Appeal submitted successfully.", appeal: created });
}
