/**
 * POST /api/admin/results/tiebreak
 * Run tie-break logic on the current ranking.
 * Order: score → correct count → cumulative response time → sudden death.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";

export async function POST(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "run_tiebreak");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { studentIds } = await req.json();
  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  if (!Array.isArray(studentIds) || studentIds.length < 2) {
    return NextResponse.json({ error: "Need at least 2 tied students to run tiebreak." }, { status: 400 });
  }

  // Fetch student info
  const { data: students } = await admin
    .from("students")
    .select("id, name, college_id")
    .in("id", studentIds);

  const studentNameMap = new Map<string, string>();
  for (const s of students || []) {
    studentNameMap.set(s.id, s.name);
  }

  // Fetch answers for tied students
  const { data: answers } = await admin
    .from("answers")
    .select("student_id, is_correct, points, response_ms")
    .in("student_id", studentIds);

  // Fetch penalties if any
  const { data: decisions } = await admin
    .from("flag_decisions")
    .select("student_id, penalty_points")
    .in("student_id", studentIds);

  const penaltyMap = new Map<string, number>();
  for (const d of decisions || []) {
    penaltyMap.set(d.student_id, (penaltyMap.get(d.student_id) || 0) + (d.penalty_points || 0));
  }

  const stats = new Map<
    string,
    { name: string; score: number; rawScore: number; penalty: number; correct: number; time: number }
  >();
  for (const id of studentIds) {
    stats.set(id, {
      name: studentNameMap.get(id) || id,
      score: 0,
      rawScore: 0,
      penalty: penaltyMap.get(id) || 0,
      correct: 0,
      time: 0,
    });
  }

  for (const a of answers || []) {
    const s = stats.get(a.student_id);
    if (!s) continue;
    if (a.is_correct) {
      s.rawScore += a.points || 0;
      s.correct++;
    }
    s.time += a.response_ms || 0;
  }

  // Apply penalties to final score
  for (const s of stats.values()) {
    s.score = Math.max(0, s.rawScore + s.penalty);
  }

  // Sort by tie-break rules: score desc -> correct desc -> time asc
  const sorted = [...studentIds].sort((a, b) => {
    const sa = stats.get(a)!;
    const sb = stats.get(b)!;
    if (sb.score !== sa.score) return sb.score - sa.score;
    if (sb.correct !== sa.correct) return sb.correct - sa.correct;
    return sa.time - sb.time;
  });

  // Check if top two are still identical across score, correct, and time
  const top = stats.get(sorted[0])!;
  const second = stats.get(sorted[1])!;
  const needsSuddenDeath =
    top.score === second.score &&
    top.correct === second.correct &&
    top.time === second.time;

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: "run_tiebreak",
    targetType: "results",
    targetId: eventId,
    after: { studentIds, sortedOrder: sorted, needsSuddenDeath },
  });

  return NextResponse.json({
    success: true,
    sorted,
    needsSuddenDeath,
    stats: Object.fromEntries(stats),
  });
}
