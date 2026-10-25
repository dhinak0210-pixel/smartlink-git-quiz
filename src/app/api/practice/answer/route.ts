/**
 * POST /api/practice/answer
 * Submit an answer to a practice question, compute Elo changes,
 * and update both student and question ratings.
 *
 * PRACTICE ONLY — scores NEVER affect competition or leaderboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyJWT } from "@/lib/auth";
import { computeEloUpdate } from "@/lib/elo";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function getClient(): SupabaseClient {
  return getSupabaseAdmin();
}

export async function POST(req: NextRequest) {
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, questionId, optionId, responseMs } = body;
  if (!sessionId || !questionId || !optionId) {
    return NextResponse.json(
      { error: "Missing required fields: sessionId, questionId, optionId" },
      { status: 400 }
    );
  }

  // 1. Fetch the selected option & question options to verify correctness
  const { data: options, error: optErr } = await supabase
    .from("options")
    .select("id, is_correct, question_id")
    .eq("question_id", questionId);

  if (optErr || !options || options.length === 0) {
    return NextResponse.json({ error: "Question options not found" }, { status: 404 });
  }

  const selectedOpt = options.find((o) => o.id === optionId);
  const correctOpt = options.find((o) => o.is_correct);

  if (!selectedOpt) {
    return NextResponse.json({ error: "Invalid optionId for question" }, { status: 400 });
  }

  const isCorrect = Boolean(selectedOpt.is_correct);

  // 2. Fetch question details (current Elo, explanation)
  const { data: qData } = await supabase
    .from("questions")
    .select("id, elo_rating, elo_games, explanation")
    .eq("id", questionId)
    .single();

  const questionEloBefore = qData?.elo_rating ?? 1500.0;
  const questionGamesBefore = qData?.elo_games ?? 0;

  // 3. Fetch student's practice rating
  const { data: studentRating } = await supabase
    .from("practice_ratings")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  const studentEloBefore = studentRating?.elo_rating ?? 1500.0;
  const totalAnswersBefore = studentRating?.total_practice_answers ?? 0;
  const totalCorrectBefore = studentRating?.total_correct ?? 0;

  // 4. Compute Elo update
  const eloUpdate = computeEloUpdate(
    studentEloBefore,
    questionEloBefore,
    isCorrect,
    totalAnswersBefore,
  );

  // 5. Insert into practice_answers
  const durationMs = typeof responseMs === "number" && responseMs >= 0 ? responseMs : 0;
  const { error: ansErr } = await supabase
    .from("practice_answers")
    .insert({
      session_id: sessionId,
      student_id: studentId,
      question_id: questionId,
      is_correct: isCorrect,
      response_ms: durationMs,
      student_elo_before: eloUpdate.studentEloBefore,
      student_elo_after: eloUpdate.studentEloAfter,
      question_elo_before: eloUpdate.questionEloBefore,
      question_elo_after: eloUpdate.questionEloAfter,
    });

  if (ansErr) {
    console.error("Error logging practice answer:", ansErr);
  }

  // 6. Update student rating
  await supabase
    .from("practice_ratings")
    .upsert({
      student_id: studentId,
      elo_rating: eloUpdate.studentEloAfter,
      total_practice_answers: totalAnswersBefore + 1,
      total_correct: totalCorrectBefore + (isCorrect ? 1 : 0),
      last_practice_at: new Date().toISOString(),
    });

  // 7. Update question Elo
  await supabase
    .from("questions")
    .update({
      elo_rating: eloUpdate.questionEloAfter,
      elo_games: questionGamesBefore + 1,
    })
    .eq("id", questionId);

  // 8. Update practice session stats
  const { data: currentSession } = await supabase
    .from("practice_sessions")
    .select("questions_answered, questions_correct")
    .eq("id", sessionId)
    .maybeSingle();

  const sessionAnswered = (currentSession?.questions_answered ?? 0) + 1;
  const sessionCorrect = (currentSession?.questions_correct ?? 0) + (isCorrect ? 1 : 0);

  await supabase
    .from("practice_sessions")
    .update({
      questions_answered: sessionAnswered,
      questions_correct: sessionCorrect,
      elo_end: eloUpdate.studentEloAfter,
    })
    .eq("id", sessionId);

  return NextResponse.json({
    isCorrect,
    correctOptionId: correctOpt?.id ?? null,
    explanation: qData?.explanation ?? "No explanation available.",
    eloUpdate: {
      studentEloBefore: eloUpdate.studentEloBefore,
      studentEloAfter: eloUpdate.studentEloAfter,
      delta: Math.round((eloUpdate.studentEloAfter - eloUpdate.studentEloBefore) * 10) / 10,
      expectedProbability: eloUpdate.expected,
      kFactor: eloUpdate.kFactor,
    },
    questionEloAfter: eloUpdate.questionEloAfter,
    sessionSummary: {
      questionsAnswered: sessionAnswered,
      questionsCorrect: sessionCorrect,
    },
    notice: "PRACTICE ONLY — This rating does not alter tournament scores.",
  });
}
