/**
 * POST /api/admin/quiz/end
 * Graceful Quiz End API
 *
 * Transitions the quiz from running/active to ended:
 * - Updates quiz_state to status='ended'
 * - Updates events to status='finished'
 * - Computes and saves an immutable snapshot to leaderboard_snapshots
 * - Clears state caches
 * - Writes to append-only audit_log
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { isAuthenticatedAdmin } from "@/lib/auth/session";
import { getAdminUser } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";
import { invalidateStateCache } from "@/lib/admin/quiz-state";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const isAdmin = await isAuthenticatedAdmin(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized: Admin session required" }, { status: 401 });
  }

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

  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

  // 1. Update quiz_state to ended
  const { data: qsRow } = await admin.from("quiz_state").select("id").limit(1).maybeSingle();
  await admin
    .from("quiz_state")
    .update({ status: "ended" })
    .eq("id", qsRow?.id || "2d04128a-17b8-4ccf-9f0b-a070a0e24271");

  // 2. Update events table status to finished
  await admin
    .from("events")
    .update({ status: "finished", updated_at: new Date().toISOString() })
    .eq("id", eventId);

  // 3. Generate snapshot of current leaderboard standings
  const { data: answers } = await admin
    .from("answers")
    .select("student_id, is_correct, points, response_ms");

  const { data: students } = await admin
    .from("students")
    .select("id, name, register_no, college_id");

  const studentMap = new Map<string, any>((students || []).map((s: any) => [s.id, s]));
  const scoreMap = new Map<string, { totalScore: number; correctCount: number; totalTimeMs: number }>();

  for (const a of answers || []) {
    const prev = scoreMap.get(a.student_id) || { totalScore: 0, correctCount: 0, totalTimeMs: 0 };
    if (a.is_correct) {
      prev.totalScore += a.points || 0;
      prev.correctCount += 1;
    }
    prev.totalTimeMs += a.response_ms || 0;
    scoreMap.set(a.student_id, prev);
  }

  const snapshotRows = Array.from(scoreMap.entries())
    .map(([studentId, s]) => {
      const st = studentMap.get(studentId);
      return {
        student_id: studentId,
        student_name: st?.name || "Student",
        register_no: st?.register_no || st?.college_id || "",
        score: s.totalScore,
        correct_count: s.correctCount,
        total_time_ms: s.totalTimeMs,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correct_count !== a.correct_count) return b.correct_count - a.correct_count;
      return a.total_time_ms - b.total_time_ms;
    })
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  // Save to leaderboard_snapshots
  await admin.from("leaderboard_snapshots").insert({
    event_id: eventId,
    reason: "quiz_end_freeze",
    standings: snapshotRows,
    created_at: new Date().toISOString(),
  });

  // 4. Invalidate state caches
  invalidateStateCache();

  // 5. Append to audit log
  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "end_quiz",
    targetType: "quiz",
    targetId: eventId,
    after: {
      status: "ended",
      totalParticipantsInSnapshot: snapshotRows.length,
      frozen_at: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    success: true,
    message: "Quiz ended gracefully and leaderboard snapshot created.",
    snapshotCount: snapshotRows.length,
    top3: snapshotRows.slice(0, 3),
  });
}
