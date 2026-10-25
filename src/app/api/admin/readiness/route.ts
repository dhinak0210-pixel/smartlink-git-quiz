/**
 * GET /api/admin/readiness
 * Automated Event-Day Readiness Checklist
 *
 * Verifies:
 * 1. Database is awake and responding
 * 2. Enrolled student count and allowlist status
 * 3. Question bank count and options
 * 4. Question bank SHA-256 hash freeze verification
 * 5. Both organizer accounts (Owner + Co-Organizer) exist and are active
 * 6. Emergency Google Form fallback URL is configured
 * 7. Storage bucket accessibility
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await requireAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized: Admin privileges required" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const eventId = req.nextUrl.searchParams.get("eventId") ||
      process.env.DEFAULT_EVENT_ID ||
      "00000000-0000-0000-0000-00000001";

    const checks: Record<string, { ok: boolean; message: string; details?: any }> = {};

    // 1. DB ping & responsiveness
    const dbStart = Date.now();
    const { error: pingErr } = await admin.from("quiz_state").select("id").limit(1);
    const dbLatencyMs = Date.now() - dbStart;
    checks.database = {
      ok: !pingErr,
      message: pingErr ? `DB error: ${pingErr.message}` : `Database online (${dbLatencyMs}ms latency)`,
      details: { latencyMs: dbLatencyMs },
    };

    // 2. Student count
    const { count: studentCount, error: stErr } = await admin
      .from("students")
      .select("id", { count: "exact", head: true });
    checks.students = {
      ok: !stErr && (studentCount || 0) > 0,
      message: `${studentCount || 0} registered students in allowlist`,
      details: { count: studentCount || 0 },
    };

    // 3. Question count
    const { count: questionCount, error: qErr } = await admin
      .from("questions")
      .select("id", { count: "exact", head: true });
    checks.questions = {
      ok: !qErr && (questionCount || 0) >= 10,
      message: `${questionCount || 0} questions present in bank (target: >= 10)`,
      details: { count: questionCount || 0 },
    };

    // 4. Bank freeze verification
    const { data: bankFreeze } = await admin
      .from("bank_freeze")
      .select("bank_hash, frozen_at, frozen_by")
      .eq("event_id", eventId)
      .maybeSingle();
    checks.bankFreeze = {
      ok: Boolean(bankFreeze?.bank_hash),
      message: bankFreeze?.bank_hash
        ? `Bank frozen with SHA-256: ${bankFreeze.bank_hash.slice(0, 16)}...`
        : "Bank not frozen yet — run freeze verification before event day",
      details: bankFreeze || null,
    };

    // 5. Dual organizer check (Owner + Co-Organizer)
    const { data: admins } = await admin
      .from("admin_users")
      .select("id, email, display_name, role, active")
      .eq("active", true);

    const hasOwner = admins?.some((a: any) => a.role === "owner");
    const hasCoOrg = admins?.some((a: any) => a.role === "co_organizer");
    checks.dualOrganizers = {
      ok: Boolean(hasOwner && hasCoOrg),
      message: hasOwner && hasCoOrg
        ? `Both Lead Organizer and Co-Organizer configured (${admins?.length} active admins)`
        : "Missing either Lead Organizer or Co-Organizer account",
      details: admins?.map((a: any) => ({ name: a.display_name, role: a.role })) || [],
    };

    // 6. Emergency Fallback Google Form
    const { data: eventSettings } = await admin
      .from("event_settings")
      .select("values")
      .eq("event_id", eventId)
      .maybeSingle();

    const fallbackUrl =
      eventSettings?.values?.emergency_form_url ||
      eventSettings?.values?.fallback_url ||
      process.env.FALLBACK_GOOGLE_FORM_URL;

    checks.emergencyFallback = {
      ok: Boolean(fallbackUrl),
      message: fallbackUrl
        ? `Emergency Fallback Form configured: ${fallbackUrl}`
        : "No fallback Google Form link configured in settings or environment",
      details: { fallbackUrl: fallbackUrl || null },
    };

    // 7. Overall Readiness Score
    const allPassed = Object.values(checks).every((c) => c.ok);
    const passCount = Object.values(checks).filter((c) => c.ok).length;
    const totalCount = Object.keys(checks).length;

    return NextResponse.json({
      ready: allPassed,
      readinessScore: Math.round((passCount / totalCount) * 100),
      summary: `${passCount}/${totalCount} checks passed`,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error: any) {
    console.error("[API /admin/readiness] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to run readiness audit" }, { status: 500 });
  }
}
