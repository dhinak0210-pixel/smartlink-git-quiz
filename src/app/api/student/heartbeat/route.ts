/**
 * POST /api/student/heartbeat
 * Participant Liveness & Condition Heartbeat
 *
 * Keeps student presence tracked in-memory (real-time, zero-latency)
 * and syncs to Supabase students.last_seen throttled to every 25s.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getAuthenticatedStudent } from "@/lib/auth/session";
import { recordPresence } from "@/lib/quiz/presence";

export const dynamic = "force-dynamic";

// In-memory throttle map to avoid hammering Supabase on every ping
const lastDbUpdateMap = new Map<string, number>();
const DB_THROTTLE_MS = 25 * 1000; // 25 seconds for database write

export async function POST(req: NextRequest) {
  try {
    const student = await getAuthenticatedStudent(req);
    if (!student) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const studentId = student.id;
    const now = Date.now();

    // Read payload from client (support JSON and sendBeacon text/plain)
    let body: any = {};
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json") || contentType.includes("text/plain")) {
        const text = await req.text();
        if (text) {
          body = JSON.parse(text);
        }
      }
    } catch {
      // If parsing fails, proceed with default values
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // 1. Immediately record in-memory presence for sub-second admin monitoring
    const presence = recordPresence(studentId, {
      studentName: student.name,
      collegeId: student.college_id,
      page: body.page || "quiz",
      questionNumber: Number(body.question_number || body.questionNumber || 0),
      isTabFocused: body.is_tab_focused !== undefined ? Boolean(body.is_tab_focused) : true,
      tabSwitches: Number(body.tab_switches || body.tabSwitches || 0),
      ip,
      userAgent,
    });

    // 2. Throttled update to Supabase DB to preserve tier bandwidth
    const lastDbTime = lastDbUpdateMap.get(studentId) || 0;
    if (now - lastDbTime >= DB_THROTTLE_MS) {
      lastDbUpdateMap.set(studentId, now);
      try {
        const admin = createSupabaseAdmin();
        await admin
          .from("students")
          .update({ last_seen: new Date().toISOString() })
          .or(`id.eq.${studentId},auth_user_id.eq.${studentId}`);
      } catch {
        // Soft fail database write; in-memory presence is already authoritative
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: now,
      page: presence.page,
      isTabFocused: presence.isTabFocused,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
