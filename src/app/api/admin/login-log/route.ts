/**
 * GET /api/admin/login-log
 * Export login events for review and appeals.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "500", 10);
  const eventType = req.nextUrl.searchParams.get("type");

  let query = admin
    .from("login_events")
    .select("*, students(name, email)")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 2000));

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data, count: data?.length || 0 });
}
