/**
 * GET /api/practice/stats
 * Retrieve student practice history, Elo rating progression,
 * accuracy by topic, and session summaries.
 *
 * PRACTICE ONLY — scores NEVER affect competition or leaderboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyJWT } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function getClient(): SupabaseClient {
  return getSupabaseAdmin();
}

export async function GET(req: NextRequest) {
  const supabase = getClient();

  let token = req.cookies.get("quiz_token")?.value || req.cookies.get("quiz_session")?.value;
  if (!token) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await verifyJWT(token);
  if (!payload || payload.role !== "student") {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const studentId = payload.sub;

  // 1. Fetch practice rating
  const { data: rating } = await supabase
    .from("practice_ratings")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  const currentElo = rating?.elo_rating ?? 1500.0;
  const totalAnswers = rating?.total_practice_answers ?? 0;
  const totalCorrect = rating?.total_correct ?? 0;
  const seededFromIrt = rating?.seeded_from_irt ?? false;

  // 2. Fetch answer progression (last 60 answers, chronological)
  const { data: answers } = await supabase
    .from("practice_answers")
    .select(`
      id,
      question_id,
      is_correct,
      response_ms,
      student_elo_before,
      student_elo_after,
      answered_at,
      questions (
        id,
        text,
        topic,
        difficulty
      )
    `)
    .eq("student_id", studentId)
    .order("answered_at", { ascending: true })
    .limit(60);

  // 3. Compute topic breakdown
  const topicStats: Record<string, { total: number; correct: number }> = {};
  let totalResponseMs = 0;

  (answers || []).forEach((a: any) => {
    const topic = a.questions?.topic || "General Git";
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    topicStats[topic].total += 1;
    if (a.is_correct) topicStats[topic].correct += 1;
    totalResponseMs += a.response_ms || 0;
  });

  const topicsArray = Object.entries(topicStats).map(([topic, stat]) => ({
    topic,
    total: stat.total,
    correct: stat.correct,
    accuracy: Math.round((stat.correct / stat.total) * 100),
  }));

  // 4. Rating progression curve
  const ratingProgression = (answers || []).map((a: any, index: number) => ({
    answerIndex: index + 1,
    elo: a.student_elo_after,
    isCorrect: a.is_correct,
    timestamp: a.answered_at,
    topic: a.questions?.topic || "Git",
  }));

  // 5. Recent sessions
  const { data: sessions } = await supabase
    .from("practice_sessions")
    .select("id, started_at, questions_answered, questions_correct, elo_start, elo_end")
    .eq("student_id", studentId)
    .order("started_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    rating: {
      currentElo,
      totalAnswers,
      totalCorrect,
      accuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
      seededFromIrt,
      avgResponseMs: totalAnswers > 0 ? Math.round(totalResponseMs / totalAnswers) : 0,
      lastPracticeAt: rating?.last_practice_at || null,
    },
    ratingProgression,
    topicBreakdown: topicsArray,
    recentSessions: sessions || [],
    notice: "PRACTICE ONLY — These statistics do not alter competition rankings.",
  });
}
