/**
 * Audit Log Viewer API
 *
 * GET /api/admin/audit
 * Append-only audit history for organizers and reviewers.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";

export async function GET(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "view_audit_log");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const eventId = req.nextUrl.searchParams.get("eventId") || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const actionFilter = req.nextUrl.searchParams.get("action") || "";
  const targetFilter = req.nextUrl.searchParams.get("target") || "";

  let query = admin
    .from("audit_log")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (actionFilter) {
    query = query.eq("action", actionFilter);
  }
  if (targetFilter) {
    query = query.eq("target_type", targetFilter);
  }

  const { data: logs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    logs: logs || [],
    role: adminUser.role,
  });
}
