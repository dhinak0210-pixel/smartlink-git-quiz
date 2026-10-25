/**
 * GET /api/admin/late-joins
 * Late Joiners Report
 *
 * Identifies contestants who:
 * - Logged in after the quiz started
 * - First answered at question N > 1
 * - Joined during active pauses or later rounds
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isAdmin = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized: Admin session required" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const thresholdQuestion = Number(req.nextUrl.searchParams.get("afterQuestion") || "1");

  // 1. Fetch quiz start time
  const { data: state } = await admin
    .from("quiz_state")
    .select("started_at, status")
    .eq("id", 1)
    .maybeSingle();

  const quizStartTime = state?.started_at ? new Date(state.started_at).getTime() : 0;

  // 2. Fetch all student login events
  const { data: loginLogs } = await admin
    .from("login_events")
    .select("student_id, event_type, created_at, user_agent")
    .eq("event_type", "login_success")
    .order("created_at", { ascending: true });

  // 3. Fetch first answered question for each student
  const { data: answers } = await admin
    .from("answers")
    .select("student_id, position, submitted_at")
    .order("position", { ascending: true });

  const firstAnswerMap = new Map<string, { position: number; submittedAt: string }>();
  for (const a of answers || []) {
    if (!firstAnswerMap.has(a.student_id)) {
      firstAnswerMap.set(a.student_id, {
        position: a.position,
        submittedAt: a.submitted_at,
      });
    }
  }

  // 4. Fetch students
  const { data: students } = await admin
    .from("students")
    .select("id, name, email, register_no, status, created_at");

  const studentMap = new Map<string, any>((students || []).map((s: any) => [s.id, s]));

  const lateJoiners: any[] = [];

  for (const [studentId, firstA] of firstAnswerMap.entries()) {
    if (firstA.position > thresholdQuestion) {
      const st = studentMap.get(studentId);
      lateJoiners.push({
        studentId,
        name: st?.name || "Student",
        email: st?.email || "",
        registerNo: st?.register_no || "",
        firstQuestionAnswered: firstA.position,
        firstAnswerSubmittedAt: firstA.submittedAt,
        missedQuestionsCount: firstA.position - 1,
      });
    }
  }

  // Also find students who logged in after quiz started but never answered
  if (quizStartTime > 0) {
    for (const log of loginLogs || []) {
      const logTime = new Date(log.created_at).getTime();
      if (logTime > quizStartTime && log.student_id && !firstAnswerMap.has(log.student_id)) {
        const st = studentMap.get(log.student_id);
        lateJoiners.push({
          studentId: log.student_id,
          name: st?.name || "Student",
          email: st?.email || "",
          registerNo: st?.register_no || "",
          firstQuestionAnswered: null,
          missedQuestionsCount: 15,
          joinedAt: log.created_at,
          status: "joined_late_no_answers",
        });
      }
    }
  }

  return NextResponse.json({
    totalLateJoiners: lateJoiners.length,
    thresholdQuestion,
    quizStartedAt: state?.started_at || null,
    lateJoiners,
  });
}
