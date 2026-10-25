/**
 * POST /api/admin/results/freeze
 * Freeze the leaderboard at quiz end.
 * Locks standings so that nothing changes without organizer recomputation.
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
    adminUser = await requirePermission(payload.sub, "freeze_leaderboard");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

  // Lock quiz state to ended
  await admin
    .from("quiz_state")
    .update({ status: "ended" })
    .eq("id", 1);

  // Take an immutable leaderboard snapshot
  const { data: answers } = await admin
    .from("answers")
    .select("student_id, is_correct, points, response_ms");

  const { data: students } = await admin
    .from("students")
    .select("id, name, register_no, college_id");

  const studentMap = new Map<string, any>((students || []).map((s: any) => [s.id, s]));
  const scoreMap = new Map<string, { score: number; correct: number; timeMs: number }>();

  for (const a of answers || []) {
    const s = scoreMap.get(a.student_id) || { score: 0, correct: 0, timeMs: 0 };
    if (a.is_correct) {
      s.score += a.points || 0;
      s.correct += 1;
    }
    s.timeMs += a.response_ms || 0;
    scoreMap.set(a.student_id, s);
  }

  const snapshotRows = Array.from(scoreMap.entries())
    .map(([sid, stats]) => {
      const st = studentMap.get(sid);
      return {
        student_id: sid,
        student_name: st?.name || "Student",
        register_no: st?.register_no || st?.college_id || "",
        score: stats.score,
        correct_count: stats.correct,
        total_time_ms: stats.timeMs,
      };
    })
    .sort((a, b) => b.score - a.score || b.correct_count - a.correct_count || a.total_time_ms - b.total_time_ms)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  await admin.from("leaderboard_snapshots").insert({
    event_id: eventId,
    reason: "freeze_leaderboard",
    standings: snapshotRows,
    created_at: new Date().toISOString(),
  });

  invalidateStateCache();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "freeze_leaderboard",
    targetType: "quiz",
    targetId: eventId,
    after: { status: "ended", snapshot_entries: snapshotRows.length },
  });

  return NextResponse.json({
    success: true,
    message: "Leaderboard frozen and snapshot saved.",
    snapshot_count: snapshotRows.length,
  });
}
