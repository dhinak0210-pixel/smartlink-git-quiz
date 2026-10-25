/**
 * POST /api/admin/quiz/pause
 * Pause the quiz after the current question.
 * Only allowed between questions.
 *
 * PUT /api/admin/quiz/pause
 * Resume from pause.
 */
import { NextRequest, NextResponse } from "next/server";
import { isAuthenticatedAdmin } from "@/lib/auth/session";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import { invalidateStateCache } from "@/lib/admin/quiz-state";

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser = { id: "admin-dhina", displayName: "Dhina (Owner)" };
  try {
    let token = req.cookies.get("sb-access-token")?.value;
    if (token && token.includes(".")) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      if (payload?.sub) {
        const u = await getAdminUser(payload.sub);
        if (u) adminUser = u;
      }
    }
  } catch {}

  let bodyEventId: string | undefined;
  let reason: string | undefined;
  try {
    const body = await req.json();
    bodyEventId = body?.eventId;
    reason = body?.reason;
  } catch {}

  const admin = createSupabaseAdmin();
  const eventId = bodyEventId || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  // Verify quiz is active
  const { data: quizState } = await admin
    .from("quiz_state")
    .select("id, status, current_question")
    .limit(1)
    .maybeSingle();

  if (quizState?.status !== "active" && quizState?.status !== "running") {
    return NextResponse.json({ error: "Quiz is not active." }, { status: 400 });
  }

  // Check no active pause already
  const { data: activePause } = await admin
    .from("pauses")
    .select("id")
    .eq("event_id", eventId)
    .is("ended_at", null)
    .maybeSingle();

  if (activePause) {
    return NextResponse.json({ error: "Quiz is already paused." }, { status: 400 });
  }

  // Create pause record
  const { data: pause, error } = await admin
    .from("pauses")
    .insert({
      event_id: eventId,
      after_question: quizState.current_question || 1,
      reason: reason || "Manual pause between questions",
      created_by: adminUser.id,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update quiz state
  await admin
    .from("quiz_state")
    .update({ status: "paused" })
    .eq("id", quizState?.id || "2d04128a-17b8-4ccf-9f0b-a070a0e24271");

  invalidateStateCache();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "pause_quiz",
    targetType: "quiz",
    targetId: eventId,
    after: { after_question: quizState.current_question, reason },
    ip,
  });

  return NextResponse.json({ success: true, pauseId: pause.id });
}

export async function PUT(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser = { id: "admin-dhina", displayName: "Dhina (Owner)" };
  try {
    let token = req.cookies.get("sb-access-token")?.value;
    if (token && token.includes(".")) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      if (payload?.sub) {
        const u = await getAdminUser(payload.sub);
        if (u) adminUser = u;
      }
    }
  } catch {}

  let bodyEventId: string | undefined;
  try {
    const body = await req.json();
    bodyEventId = body?.eventId;
  } catch {}

  const admin = createSupabaseAdmin();
  const eventId = bodyEventId || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

  // Find active pause
  const { data: activePause } = await admin
    .from("pauses")
    .select("id, started_at")
    .eq("event_id", eventId)
    .is("ended_at", null)
    .maybeSingle();

  if (!activePause) {
    return NextResponse.json({ error: "No active pause found." }, { status: 400 });
  }

  const now = new Date();
  const durationMs = now.getTime() - new Date(activePause.started_at).getTime();

  await admin
    .from("pauses")
    .update({ ended_at: now.toISOString(), duration_ms: durationMs })
    .eq("id", activePause.id);

  const { data: qsRow } = await admin.from("quiz_state").select("id").limit(1).maybeSingle();
  await admin
    .from("quiz_state")
    .update({ status: "active" })
    .eq("id", qsRow?.id || "2d04128a-17b8-4ccf-9f0b-a070a0e24271");

  invalidateStateCache();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "resume_quiz",
    targetType: "quiz",
    targetId: eventId,
    after: { duration_ms: durationMs },
  });

  return NextResponse.json({ success: true, durationMs });
}
