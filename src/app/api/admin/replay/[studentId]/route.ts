/**
 * GET /api/admin/replay/[studentId]
 * Fetches complete replay stream for an individual contestant:
 * - Student profile & verification status
 * - Assigned question variants and option permutations
 * - Response timings, points, tab switches, and correctness
 * - Anti-cheat telemetry events
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { studentId: string } }
) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    await requirePermission(payload.sub, "view_evidence");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { studentId } = params;
  const admin = createSupabaseAdmin();

  // 1. Fetch student
  const { data: student } = await admin
    .from("students")
    .select("id, name, email, register_no, status, created_at")
    .or(`id.eq.${studentId},register_no.eq.${studentId}`)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // 2. Fetch student answers
  const { data: answers } = await admin
    .from("answers")
    .select("question_id, position, selected_option, selected_label, is_correct, points, response_ms, tab_switches, visibility_hidden, submitted_at")
    .eq("student_id", student.id)
    .order("position", { ascending: true });

  // 3. Fetch questions
  const { data: questions } = await admin
    .from("questions")
    .select("id, text, topic, difficulty, points_base, explanation");

  const questionMap = new Map<string, any>((questions || []).map((q: any) => [q.id, q]));

  // 4. Fetch options for these questions
  const { data: options } = await admin
    .from("options")
    .select("id, question_id, text, is_correct, label");

  const optionsMap = new Map<string, any[]>();
  for (const opt of options || []) {
    const list = optionsMap.get(opt.question_id) || [];
    list.push(opt);
    optionsMap.set(opt.question_id, list);
  }

  // 5. Fetch telemetry / anti-cheat logs
  const { data: logs } = await admin
    .from("anti_cheat_logs")
    .select("event_type, details, created_at")
    .eq("student_id", student.id)
    .order("created_at", { ascending: true });

  const replayItems = (answers || []).map((a: any) => {
    const q = questionMap.get(a.question_id);
    const opts = optionsMap.get(a.question_id) || [];
    return {
      position: a.position,
      questionText: q?.text || "Question prompt",
      topic: q?.topic || "General",
      difficulty: q?.difficulty || "medium",
      explanation: q?.explanation || "",
      options: opts.map((o: any) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.is_correct,
      })),
      selectedOption: a.selected_option || a.selected_label,
      isCorrect: a.is_correct,
      points: a.points,
      responseMs: a.response_ms,
      tabSwitches: a.tab_switches || 0,
      visibilityHidden: a.visibility_hidden || false,
      submittedAt: a.submitted_at,
    };
  });

  return NextResponse.json({
    student,
    summary: {
      totalAnswered: replayItems.length,
      totalCorrect: replayItems.filter((i: any) => i.isCorrect).length,
      totalScore: replayItems.reduce((acc: number, i: any) => acc + (i.points || 0), 0),
      totalTimeMs: replayItems.reduce((acc: number, i: any) => acc + (i.responseMs || 0), 0),
      totalTabSwitches: replayItems.reduce((acc: number, i: any) => acc + (i.tabSwitches || 0), 0),
    },
    items: replayItems,
    telemetryLogs: logs || [],
  });
}
