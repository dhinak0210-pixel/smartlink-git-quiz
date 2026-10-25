import { NextResponse } from "next/server";
import { getQuizState } from "@/lib/admin/quiz-state";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { DEFAULT_EVENT_ID } from "@/lib/utils/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const eventId = process.env.DEFAULT_EVENT_ID || DEFAULT_EVENT_ID;
    const cachedState = await getQuizState(eventId);

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("quiz_state")
      .select("status, started_at, question_seconds, gap_seconds, total_questions")
      .limit(1)
      .maybeSingle();

    const rawStatus = data?.status || "waiting";
    const effectiveStatus = (rawStatus === "running" ? "active" : rawStatus) || cachedState.status || "waiting";

    return NextResponse.json({
      status: effectiveStatus,
      raw_status: rawStatus,
      started_at: data?.started_at || null,
      server_time: Date.now(),
      serverTime: cachedState.serverTime,
      currentQuestion: cachedState.currentQuestion,
      totalQuestions: cachedState.totalQuestions,
      questionOpensAt: cachedState.questionOpensAt,
      questionClosesAt: cachedState.questionClosesAt,
      pauseOffsetMs: cachedState.pauseOffsetMs,
      voidedQuestions: cachedState.voidedQuestions,
      banner: cachedState.banner,
      fallbackUrl: cachedState.fallbackUrl,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ status: "waiting", error: err?.message }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      }
    });
  }
}
