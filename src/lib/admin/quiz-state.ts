/**
 * Cached quiz state object.
 * Students poll this every 3-5 seconds instead of computing from started_at.
 * Supports pause offsets, voided questions, and broadcast banners.
 *
 * The server returns the same cached copy to everyone → low DB load.
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export interface QuizState {
  status: "waiting" | "active" | "paused" | "ended";
  currentQuestion: number;       // 1-indexed, 0 if not started
  totalQuestions: number;
  questionOpensAt: string | null; // ISO timestamp
  questionClosesAt: string | null;
  pauseOffsetMs: number;         // cumulative pause time
  voidedQuestions: number[];     // question numbers that are voided
  banner: { message: string; type: string } | null;
  fallbackUrl: string | null;    // Google Form link for kill switch
  serverTime: string;            // for clock sync
}

// In-memory cache (per Vercel serverless instance)
let stateCache: QuizState | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 2000; // 2 seconds

export async function getQuizState(eventId: string): Promise<QuizState> {
  const now = Date.now();
  if (stateCache && now - cacheTime < CACHE_TTL_MS) {
    return { ...stateCache, serverTime: new Date().toISOString() };
  }

  const admin = createSupabaseAdmin();

  // Fetch quiz state
  const { data: quizState } = await admin
    .from("quiz_state")
    .select("status, started_at, current_question")
    .limit(1)
    .maybeSingle();

  // Fetch settings
  const { data: settings } = await admin
    .from("event_settings")
    .select("values")
    .eq("event_id", eventId)
    .maybeSingle();

  const secPerQ = settings?.values?.seconds_per_question || 20;
  const gapSec = settings?.values?.gap_seconds || 5;
  const totalQ = settings?.values?.total_questions || 15;

  // Fetch active pauses
  const { data: pauses } = await admin
    .from("pauses")
    .select("after_question, started_at, ended_at, duration_ms")
    .eq("event_id", eventId);

  let pauseOffsetMs = 0;
  if (pauses) {
    for (const p of pauses) {
      if (p.ended_at && p.duration_ms) {
        pauseOffsetMs += p.duration_ms;
      } else if (!p.ended_at) {
        // Active pause
        pauseOffsetMs += Date.now() - new Date(p.started_at).getTime();
      }
    }
  }

  // Fetch voided questions
  const { data: voids } = await admin
    .from("question_voids")
    .select("question_number")
    .eq("event_id", eventId);
  const voidedQuestions = (voids || []).map((v: any) => v.question_number).filter(Boolean);

  // Fetch active banner
  const { data: banner } = await admin
    .from("announcements")
    .select("message, type")
    .eq("event_id", eventId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Compute current question timing
  const rawStatus = quizState?.status || "waiting";
  const status = rawStatus === "running" ? "active" : rawStatus;
  const currentQ = quizState?.current_question || 0;
  let questionOpensAt: string | null = null;
  let questionClosesAt: string | null = null;

  if (status === "active" && currentQ > 0 && quizState?.started_at) {
    const baseStart = new Date(quizState.started_at).getTime();
    const cycleMs = (secPerQ + gapSec) * 1000;
    const openMs = baseStart + (currentQ - 1) * cycleMs + pauseOffsetMs;
    const closeMs = openMs + secPerQ * 1000;
    questionOpensAt = new Date(openMs).toISOString();
    questionClosesAt = new Date(closeMs).toISOString();
  }

  stateCache = {
    status: status as QuizState["status"],
    currentQuestion: currentQ,
    totalQuestions: totalQ,
    questionOpensAt,
    questionClosesAt,
    pauseOffsetMs,
    voidedQuestions,
    banner: banner ? { message: banner.message, type: banner.type } : null,
    fallbackUrl: null, // Set via kill switch
    serverTime: new Date().toISOString(),
  };
  cacheTime = now;

  return { ...stateCache, serverTime: new Date().toISOString() };
}

/**
 * Invalidate the cache (call after pause, void, banner changes).
 */
export function invalidateStateCache(): void {
  stateCache = null;
  cacheTime = 0;
}
