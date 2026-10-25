/**
 * POST /api/admin/results/recompute
 * Recompute rankings applying approved penalties and voided questions.
 * Admin NEVER edits scores by hand — this reads from decisions and voids.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { auditLog } from "@/lib/admin/audit";

interface StudentScore {
  studentId: string;
  name: string;
  collegeId: string;
  rawScore: number;
  penalty: number;
  finalScore: number;
  correctCount: number;
  totalTimeMs: number;
  flagsResolved: string[];
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
    adminUser = await requirePermission(payload.sub, "recompute");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000001";

  const body = await req.json().catch(() => ({}));
  const shouldPublish = Boolean(body?.publish);

  // 1. Get voided question IDs
  const { data: voids } = await admin
    .from("question_voids")
    .select("question_id, question_number")
    .eq("event_id", eventId);
  const voidedIds = new Set((voids || []).map((v: any) => v.question_id));

  // 2. Get approved penalties & disqualifications
  const { data: decisions } = await admin
    .from("flag_decisions")
    .select("student_id, decision, penalty_points, approval_id")
    .eq("event_id", eventId);

  const penalties = new Map<string, number>();
  const disqualified = new Set<string>();
  for (const d of decisions || []) {
    // Decisions with approval or direct recorded decisions
    if (d.decision === "disqualify") {
      disqualified.add(d.student_id);
    } else if (d.decision === "penalize") {
      penalties.set(d.student_id, (penalties.get(d.student_id) || 0) + (d.penalty_points || 0));
    }
  }

  // 3. Fetch all students to initialize ranking for all enrolled contestants
  const { data: allStudents } = await admin
    .from("students")
    .select("id, name, college_id, status");

  const studentMap = new Map<string, { name: string; college_id: string; status: string }>();
  const scores = new Map<string, StudentScore>();

  for (const st of allStudents || []) {
    if (disqualified.has(st.id)) continue;
    studentMap.set(st.id, { name: st.name, college_id: st.college_id, status: st.status });
    scores.set(st.id, {
      studentId: st.id,
      name: st.name,
      collegeId: st.college_id,
      rawScore: 0,
      penalty: penalties.get(st.id) || 0,
      finalScore: Math.max(0, penalties.get(st.id) || 0),
      correctCount: 0,
      totalTimeMs: 0,
      flagsResolved: [],
    });
  }

  // 4. Compute raw scores from answers (excluding voided questions and disqualified students)
  const { data: answers } = await admin
    .from("answers")
    .select("student_id, question_id, is_correct, points, response_ms");

  for (const a of answers || []) {
    if (voidedIds.has(a.question_id)) continue;
    if (disqualified.has(a.student_id)) continue;

    const s = scores.get(a.student_id);
    if (!s) continue;

    if (a.is_correct) {
      s.rawScore += a.points || 0;
      s.correctCount++;
    }
    s.totalTimeMs += a.response_ms || 0;
  }

  // 5. Finalize finalScore
  for (const s of scores.values()) {
    s.finalScore = Math.max(0, s.rawScore + s.penalty);
  }

  // 5. Sort: score desc → correct desc → time asc
  const ranking = Array.from(scores.values()).sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return a.totalTimeMs - b.totalTimeMs;
  });

  if (shouldPublish) {
    const publishedAt = new Date().toISOString();
    await admin
      .from("quiz_state")
      .update({
        results_published: true,
        results_published_at: publishedAt,
      })
      .eq("id", 1);

    await admin
      .from("events")
      .update({
        results_published: true,
        results_published_at: publishedAt,
      })
      .eq("id", eventId);
  }

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action: shouldPublish ? "recompute_and_publish_results" : "recompute_results",
    targetType: "results",
    targetId: eventId,
    after: {
      totalRanked: ranking.length,
      voidedQuestions: voidedIds.size,
      penaltiesApplied: penalties.size,
      disqualified: disqualified.size,
      published: shouldPublish,
    },
  });

  return NextResponse.json({
    success: true,
    published: shouldPublish,
    ranking: ranking.slice(0, 50),
    allRankingCount: ranking.length,
    stats: {
      totalRanked: ranking.length,
      voidedQuestions: voidedIds.size,
      penaltiesApplied: penalties.size,
      disqualified: disqualified.size,
    },
  });
}
