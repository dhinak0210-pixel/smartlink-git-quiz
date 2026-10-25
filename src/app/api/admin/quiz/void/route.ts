/**
 * POST /api/admin/quiz/void
 * Request to void a question. Creates an approval.
 * Requires typed confirmation (type eventId).
 *
 * PUT /api/admin/quiz/void
 * Execute an approved void with second organizer sign-off.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { createApproval, approveRequest } from "@/lib/admin/approvals";
import { auditLog } from "@/lib/admin/audit";
import { invalidateStateCache } from "@/lib/admin/quiz-state";

export async function POST(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "void_question");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { eventId: bodyEventId, questionId, questionNumber, reason, typedConfirmation } = await req.json();
  const eventId = bodyEventId || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  // Typed confirmation check (must type the event name or event ID)
  if (typedConfirmation !== eventId && typedConfirmation !== "SmartLink Git Quiz") {
    return NextResponse.json(
      { error: `Type "${eventId}" to confirm.` },
      { status: 400 }
    );
  }

  if (!reason || reason.length < 10) {
    return NextResponse.json(
      { error: "Provide a detailed reason (at least 10 characters)." },
      { status: 400 }
    );
  }

  // Create approval request
  const approvalId = await createApproval({
    eventId,
    action: "void_question",
    payload: { questionId, questionNumber, reason },
    requestedBy: adminUser.id,
  });

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "request_void_question",
    targetType: "question",
    targetId: questionId,
    after: { questionNumber, reason, approvalId },
  });

  return NextResponse.json({
    success: true,
    approvalId,
    message: "Void request created. Waiting for second organizer approval.",
  });
}

export async function PUT(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "void_question");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { approvalId } = await req.json();

  let approved;
  try {
    approved = await approveRequest(approvalId, adminUser.authUserId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  if (approved.action !== "void_question") {
    return NextResponse.json({ error: "Wrong approval type." }, { status: 400 });
  }

  const { questionId, questionNumber, reason } = approved.payload as any;
  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  // Insert void record
  await admin.from("question_voids").insert({
    event_id: eventId,
    question_id: questionId,
    question_number: questionNumber,
    reason,
    approval_id: approvalId,
    voided_at: new Date().toISOString(),
  });

  invalidateStateCache();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "execute_void_question",
    targetType: "question",
    targetId: questionId,
    after: { questionNumber, reason },
  });

  return NextResponse.json({ success: true, message: `Question ${questionNumber} voided.` });
}
