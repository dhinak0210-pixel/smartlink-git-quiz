/**
 * POST /api/admin/quiz/start
 * Start the official quiz competition.
 * Records started_at in quiz_state and events, auto-freezes event settings,
 * invalidates caches, and triggers live mode for all waiting participants.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthenticatedAdmin } from "@/lib/auth/session";
import { getAdminUser } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import { invalidateStateCache } from "@/lib/admin/quiz-state";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
  }

  let bodyEventId: string | undefined;
  try {
    const body = await req.json();
    bodyEventId = body?.eventId;
  } catch {
    // No body or empty payload
  }

  const admin = createSupabaseAdmin();
  const eventId = bodyEventId || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  // 1. Ensure event_settings exists and is frozen (auto-freeze instead of blocking)
  const { data: settings } = await admin
    .from("event_settings")
    .select("frozen_at, values")
    .eq("event_id", eventId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  if (!settings) {
    await admin.from("event_settings").insert({
      event_id: eventId,
      values: { seconds_per_question: 20, gap_seconds: 5, total_questions: 15 },
      frozen_at: nowIso,
    });
  } else if (!settings.frozen_at) {
    await admin
      .from("event_settings")
      .update({ frozen_at: nowIso })
      .eq("event_id", eventId);
  }

  // 2. Set quiz_state to active and record started_at
  const startedAt = nowIso;

  const { data: qsRow } = await admin
    .from("quiz_state")
    .select("id")
    .limit(1)
    .maybeSingle();

  const qsId = qsRow?.id || "2d04128a-17b8-4ccf-9f0b-a070a0e24271";

  const { error: qsError } = await admin
    .from("quiz_state")
    .update({
      status: "active",
      started_at: startedAt,
      current_question: 1,
    })
    .eq("id", qsId);

  if (qsError) {
    console.error("[StartQuiz] quiz_state update error:", qsError);
  }

  // 3. Update events table
  await admin
    .from("events")
    .update({
      status: "active",
      started_at: startedAt,
    })
    .eq("id", eventId);

  // 4. Invalidate all state caches
  invalidateStateCache();
  try {
    cache.invalidate("quiz_state");
  } catch {}

  // 5. Audit Log
  let adminUserId = "admin-dhina";
  let adminDisplayName = "Dhina (Owner)";
  try {
    let token = req.cookies.get("sb-access-token")?.value;
    if (token && token.includes(".")) {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      if (payload?.sub) {
        const u = await getAdminUser(payload.sub);
        if (u) {
          adminUserId = u.id;
          adminDisplayName = u.displayName;
        }
      }
    }
  } catch {}

  await auditLog({
    eventId,
    actorId: adminUserId,
    actorName: adminDisplayName,
    action: "start_quiz",
    targetType: "quiz",
    targetId: eventId,
    after: { started_at: startedAt, status: "active" },
    ip,
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    status: "active",
    startedAt,
    message: "Official Quiz successfully started! Participants will now automatically enter Question 1.",
  });
}

