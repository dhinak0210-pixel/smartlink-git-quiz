/**
 * Announcements / Broadcast Banners
 *
 * GET /api/admin/announcements
 * Retrieve active or recent announcements.
 *
 * POST /api/admin/announcements
 * Create or deactivate broadcast announcements.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import { invalidateStateCache } from "@/lib/admin/quiz-state";

export async function GET(req: NextRequest) {
  const admin = createSupabaseAdmin();
  const eventId = req.nextUrl.searchParams.get("eventId") || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  const { data: announcements, error } = await admin
    .from("announcements")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ announcements: announcements || [] });
}

export async function POST(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "broadcast");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { message, type = "info", active = true, id } = await req.json();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const admin = createSupabaseAdmin();

  // If modifying existing announcement (e.g. deactivate)
  if (id) {
    await admin
      .from("announcements")
      .update({ active })
      .eq("id", id);

    invalidateStateCache();

    await auditLog({
      eventId,
      actorId: adminUser.id,
      actorName: adminUser.displayName,
      action: active ? "activate_announcement" : "deactivate_announcement",
      targetType: "announcement",
      targetId: id,
    });

    return NextResponse.json({ success: true, message: "Announcement updated." });
  }

  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: "Broadcast message is required." }, { status: 400 });
  }

  // Deactivate prior announcements if new one is posted
  await admin
    .from("announcements")
    .update({ active: false })
    .eq("event_id", eventId);

  // Insert new announcement
  const { data: created, error } = await admin
    .from("announcements")
    .insert({
      event_id: eventId,
      message: message.trim(),
      type,
      active: true,
      created_by: adminUser.id,
      shown_from: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateStateCache();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "create_announcement",
    targetType: "announcement",
    targetId: created.id,
    after: { message, type },
  });

  return NextResponse.json({ success: true, announcement: created });
}
