/**
 * Emergency Kill Switch API
 *
 * POST /api/admin/quiz/killswitch
 * Activates emergency fallback mode (e.g. redirecting to Google Form).
 * Requires Owner role (Level 5).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
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
    adminUser = await requirePermission(payload.sub, "kill_switch");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { fallbackUrl, reason, typedConfirmation } = await req.json();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  if (typedConfirmation !== "ACTIVATE_KILL_SWITCH") {
    return NextResponse.json({ error: 'Type "ACTIVATE_KILL_SWITCH" to confirm emergency failover.' }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Set broadcast announcement with fallback link
  if (fallbackUrl) {
    await admin.from("announcements").insert({
      event_id: eventId,
      message: `EMERGENCY FALLBACK: Please continue the competition at: ${fallbackUrl}`,
      type: "error",
      active: true,
      created_by: adminUser.id,
      shown_from: new Date().toISOString(),
    });
  }

  // Update quiz state to ended/halted
  await admin
    .from("quiz_state")
    .update({ status: "ended" })
    .eq("id", 1);

  invalidateStateCache();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "activate_kill_switch",
    targetType: "quiz",
    targetId: eventId,
    reason: reason || "Emergency kill switch activated",
    after: { fallbackUrl, status: "ended" },
  });

  return NextResponse.json({
    success: true,
    message: "Kill switch activated. Fallback banner broadcasted and quiz state halted.",
  });
}
