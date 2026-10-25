/**
 * Adaptive question selection for practice mode.
 *
 * Strategy: epsilon-greedy with ability-matching.
 * - With probability epsilon: random question (exploration)
 * - Otherwise: question closest to student's current Elo (exploitation)
 * - Excludes questions already answered in the current session
 * - Weights by IRT discrimination when available (higher = more informative)
 *
 * PRACTICE ONLY — never used during competition.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabase-server";

function getClient(): SupabaseClient {
  return getSupabaseAdmin();
}

export interface QuestionCandidate {
  id: string;
  elo_rating: number;
  difficulty_logit: number | null;
  discrimination: number | null;
  variant_id: string | null;
}

const EPSILON = 0.15; // 15% exploration
const MAX_ELO_GAP = 400; // Don't pick questions too far from student level

export async function selectNextQuestion(
  studentId: string,
  studentElo: number,
  sessionId: string,
): Promise<QuestionCandidate | null> {
  const supabase = getClient();

  // Get questions already answered in this session
  const { data: answered } = await supabase
    .from("practice_answers")
    .select("question_id")
    .eq("session_id", sessionId);

  const answeredIds = new Set((answered || []).map((a: { question_id: string }) => a.question_id));

  // Get all active questions with Elo ratings
  let { data: questions } = await supabase
    .from("questions")
    .select("id, elo_rating, difficulty_logit, discrimination, variant_id")
    .eq("is_active", true)
    .gt("elo_games", 0);

  // Fallback to active questions if not yet seeded with games > 0
  if (!questions || questions.length === 0) {
    const { data: allActive } = await supabase
      .from("questions")
      .select("id, elo_rating, difficulty_logit, discrimination, variant_id")
      .eq("is_active", true);

    if (allActive && allActive.length > 0) {
      questions = allActive.map((q: any) => ({
        id: q.id,
        elo_rating: q.elo_rating ?? 1500,
        difficulty_logit: q.difficulty_logit ?? null,
        discrimination: q.discrimination ?? null,
        variant_id: q.variant_id ?? null,
      }));
    }
  }

  if (!questions || questions.length === 0) return null;

  // Filter out answered questions
  const candidates = (questions as QuestionCandidate[]).filter(
    (q) => !answeredIds.has(q.id),
  );

  if (candidates.length === 0) return null;

  // Epsilon-greedy selection
  if (Math.random() < EPSILON) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Score each candidate: lower = better match
  const scored = candidates.map((q) => {
    const qElo = q.elo_rating ?? 1500;
    const eloGap = Math.abs(qElo - studentElo);
    const gapPenalty = Math.min(eloGap / MAX_ELO_GAP, 1.0);

    // Bonus for high-discrimination questions (more informative)
    const discBonus = q.discrimination ? (q.discrimination - 1.0) * 0.1 : 0;

    return {
      question: q,
      score: gapPenalty - discBonus, // Lower is better
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].question;
}
