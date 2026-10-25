import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { DEFAULT_EVENT_ID } from "@/lib/utils/constants";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const violationType = body.type || "fullscreen_exit";
    const questionNumber = Number(body.questionNumber || 0);

    const supabase = getSupabaseAdmin();
    const eventId = process.env.DEFAULT_EVENT_ID || DEFAULT_EVENT_ID;

    // 1. Count existing flags for this student in this event
    const { count } = await supabase
      .from("flags")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("event_id", eventId);

    const strikeCount = (count || 0) + 1;
    const isDisqualified = strikeCount >= 3;

    // 2. Insert into flags table (adheres to flags check constraints: detector IN ('person_fit', 'timing', 'pair', 'behavior'))
    const { error: flagError } = await supabase.from("flags").insert({
      student_id: student.id,
      event_id: eventId,
      flag_type: violationType === "tab_switch" ? "heavy_tab_switching" : "fullscreen_exit",
      severity: "critical",
      detector: "behavior",
      tier: isDisqualified ? "strong" : "review",
      details: {
        reason: "Participant exited fullscreen or switched away from locked quiz window",
        violation_type: violationType,
        question_number: questionNumber,
        strike_count: strikeCount,
        disqualified: isDisqualified,
        timestamp: new Date().toISOString(),
      },
      evidence: {
        action: violationType,
        client_user_agent: req.headers.get("user-agent") || "",
        strike: strikeCount,
      },
      score_penalty: 200,
      is_resolved: false,
    });

    if (flagError) {
      console.error("[Malpractice] Error inserting flag:", flagError);
    }

    // 3. Update student status in students table if disqualified
    if (isDisqualified) {
      await supabase
        .from("students")
        .update({
          status: "deactivated",
          is_active: false,
        })
        .eq("id", student.id);
    }

    // 4. Update student_status table
    try {
      await supabase.from("student_status").upsert({
        student_id: student.id,
        tier: isDisqualified ? "strong" : "review",
        review_status: isDisqualified ? "disqualified" : "malpractice",
        trust_score: Math.max(0, 100 - strikeCount * 30),
        last_updated: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[Malpractice] student_status update warning:", e);
    }

    // 5. Log in student_notes for administrative audit trail
    try {
      await supabase.from("student_notes").insert({
        event_id: eventId,
        student_id: student.id,
        actor_id: eventId,
        note: `MALPRACTICE FLAG #${strikeCount}: Exited screen lock during Q${questionNumber} (${violationType}). ${
          isDisqualified ? "DISQUALIFIED." : "-200 pts penalty applied."
        }`,
      });
    } catch (e) {
      console.warn("[Malpractice] Note insert error:", e);
    }

    return NextResponse.json({
      success: true,
      strikeCount,
      isDisqualified,
      penalty: 200,
      status: isDisqualified ? "disqualified" : "malpractice",
      message: `Malpractice recorded. Strike ${strikeCount} of 3.`,
    });
  } catch (error: any) {
    console.error("[Malpractice] Error:", error);
    return NextResponse.json({ error: "Failed to record malpractice" }, { status: 500 });
  }
}
