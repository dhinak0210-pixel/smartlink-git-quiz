/**
 * GET /api/admin/dashboard
 * Returns counts and status for the admin overview page.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { getPendingApprovals } from "@/lib/admin/approvals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "view_live_metrics");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const eventId = req.nextUrl.searchParams.get("eventId") || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  // Student counts by status
  const { data: students } = await admin
    .from("students")
    .select("status");

  const counts: Record<string, number> = {
    registered: 0,
    account_created: 0,
    logged_in: 0,
    playing: 0,
    finished: 0,
    deactivated: 0,
  };
  for (const s of students || []) {
    counts[s.status] = (counts[s.status] || 0) + 1;
  }

  // Quiz state
  const { data: quizState } = await admin
    .from("quiz_state")
    .select("status, current_question, started_at")
    .limit(1)
    .maybeSingle();

  // Pending approvals
  const approvals = await getPendingApprovals(eventId);

  // Recent audit entries
  const { data: recentAudit } = await admin
    .from("audit_log")
    .select("action, actor_name, created_at, target_type")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    studentCounts: counts,
    totalStudents: students?.length || 0,
    quizStatus: quizState?.status || "waiting",
    currentQuestion: quizState?.current_question || 0,
    startedAt: quizState?.started_at || null,
    pendingApprovals: approvals.length,
    recentActivity: recentAudit || [],
    role: adminUser.role,
    displayName: adminUser.displayName,
  });
}
