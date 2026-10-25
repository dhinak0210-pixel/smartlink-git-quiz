/**
 * GET /api/admin/metrics
 * Live Metrics Stream for Admin Command Center:
 * - Total contestants joined & active
 * - Online right now (heartbeat < 45s)
 * - Submission count per question
 * - Error rate & locked accounts
 * - Slow response time distribution (>18s)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized: Admin session required" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

    const now = new Date();
    const onlineThreshold = new Date(now.getTime() - 45 * 1000).toISOString();

    const [
      { count: totalStudents },
      { count: loggedInStudents },
      { count: onlineNow },
      { count: lockedAccounts },
      { data: answers },
      { data: state },
    ] = await Promise.all([
      admin.from("students").select("id", { count: "exact", head: true }),
      admin.from("students").select("id", { count: "exact", head: true }).neq("status", "registered"),
      admin.from("students").select("id", { count: "exact", head: true }).gt("last_seen", onlineThreshold),
      admin.from("students").select("id", { count: "exact", head: true }).gt("locked_until", now.toISOString()),
      admin.from("answers").select("position, response_ms"),
      admin.from("quiz_state").select("status, current_question, started_at").limit(1).maybeSingle(),
    ]);

    // Compute answers per question
    const answersPerQuestion: Record<number, number> = {};
    let slowResponsesCount = 0;

    for (const a of answers || []) {
      const pos = a.position || 1;
      answersPerQuestion[pos] = (answersPerQuestion[pos] || 0) + 1;
      if ((a.response_ms || 0) > 18000) {
        slowResponsesCount++;
      }
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      quizStatus: state?.status || "waiting",
      currentQuestion: state?.current_question || 0,
      totalStudents: totalStudents || 0,
      joinedCount: loggedInStudents || 0,
      onlineNowCount: onlineNow || 0,
      lockedAccountsCount: lockedAccounts || 0,
      totalAnswersSubmitted: answers?.length || 0,
      slowResponsesCount,
      answersPerQuestion,
    });
  } catch (error: any) {
    console.error("[API /admin/metrics] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch metrics" }, { status: 500 });
  }
}
