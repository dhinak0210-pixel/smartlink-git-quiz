/**
 * Event Settings API
 *
 * GET /api/admin/settings
 * Fetch current versioned event settings and freeze status.
 *
 * PUT /api/admin/settings
 * Update settings (if not frozen).
 *
 * POST /api/admin/settings/freeze
 * Freeze settings with question bank hash.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { getSettings, updateSettings, freezeSettings } from "@/lib/admin/settings";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId") || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const settings = await getSettings(eventId);
  return NextResponse.json(settings);
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
    adminUser = await requirePermission(payload.sub, "edit_settings");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { values, eventId: bodyEventId, action, bankHash } = await req.json();
  const eventId = bodyEventId || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

  if (action === "freeze") {
    try {
      await freezeSettings(eventId, bankHash || "sha256_bank_frozen", adminUser);
      return NextResponse.json({ success: true, message: "Settings frozen." });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  try {
    const updated = await updateSettings(eventId, values, adminUser, ip);
    return NextResponse.json({ success: true, ...updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
