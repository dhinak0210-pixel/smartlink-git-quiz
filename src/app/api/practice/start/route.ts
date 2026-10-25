/**
 * POST /api/practice/start
 * Create a new practice session. Seed Elo from IRT if first time.
 * Returns session ID and current Elo rating.
 *
 * PRACTICE ONLY — does not affect competition state.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { verifyJWT } from "@/lib/auth";
import { irtAbilityToElo } from "@/lib/elo";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function getClient(): SupabaseClient {
  return getSupabaseAdmin();
}

export async function POST(req: NextRequest) {
  const supabase = getClient();

  // Support quiz_token, quiz_session cookie or Authorization Bearer header
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

  // Check if student has existing practice rating
  let { data: rating } = await supabase
    .from("practice_ratings")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!rating) {
    // First time: seed from IRT ability if available, else 1500
    let seedElo = 1500;
    let seededFromIrt = false;

    const { data: irtData } = await supabase
      .from("students")
      .select("irt_ability_logit")
      .eq("id", studentId)
      .maybeSingle();

    if (irtData?.irt_ability_logit != null) {
      seedElo = irtAbilityToElo(irtData.irt_ability_logit);
      seededFromIrt = true;
    }

    const { data: newRating, error } = await supabase
      .from("practice_ratings")
      .insert({
        student_id: studentId,
        elo_rating: seedElo,
        seeded_from_irt: seededFromIrt,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    rating = newRating;
  }

  // Create session
  const newSessionId = crypto.randomUUID();
  const { data: session, error: sessionError } = await supabase
    .from("practice_sessions")
    .insert({
      id: newSessionId,
      student_id: studentId,
      elo_start: rating?.elo_rating ?? 1500,
    })
    .select()
    .single();

  const finalSessionId = session?.id || newSessionId;

  return NextResponse.json({
    sessionId: finalSessionId,
    eloRating: rating?.elo_rating ?? 1500,
    totalAnswers: rating?.total_practice_answers ?? 0,
    seededFromIrt: rating?.seeded_from_irt ?? false,
    message: "⚠️ Practice mode — scores do NOT affect the competition.",
  });
}
