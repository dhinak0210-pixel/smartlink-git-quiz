/**
 * GET /api/practice/next?sessionId=...
 * Select the next adaptive question for the student.
 * Returns question text, shuffled options, and metadata.
 *
 * PRACTICE ONLY.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyJWT } from "@/lib/auth";
import { selectNextQuestion } from "@/lib/question-selector";
import { shuffleOptions } from "@/lib/shuffle";
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

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const studentId = payload.sub;

  // Get student's current Elo
  const { data: rating } = await supabase
    .from("practice_ratings")
    .select("elo_rating")
    .eq("student_id", studentId)
    .maybeSingle();

  const studentElo = rating?.elo_rating ?? 1500.0;

  // Select next question
  const candidate = await selectNextQuestion(studentId, studentElo, sessionId);
  if (!candidate) {
    return NextResponse.json({
      question: null,
      message: "No further unattempted practice questions available in this session.",
    });
  }

  // Fetch question details and options
  const { data: qData, error: qError } = await supabase
    .from("questions")
    .select("id, text, topic, difficulty, elo_rating")
    .eq("id", candidate.id)
    .single();

  if (qError || !qData) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const { data: optionsData, error: optError } = await supabase
    .from("options")
    .select("id, text")
    .eq("question_id", candidate.id);

  if (optError || !optionsData || optionsData.length === 0) {
    return NextResponse.json({ error: "Question options missing" }, { status: 500 });
  }

  // Deterministically shuffle options for this student and question
  const shuffled = shuffleOptions(optionsData, studentId, candidate.id);

  return NextResponse.json({
    question: {
      id: qData.id,
      text: qData.text,
      topic: qData.topic,
      difficulty: qData.difficulty,
      eloRating: qData.elo_rating ?? candidate.elo_rating ?? 1500,
      options: shuffled,
    },
    studentElo,
  });
}
