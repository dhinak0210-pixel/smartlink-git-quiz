/**
 * Winner Approval, Sequential Reveal, and Publication.
 *
 * GET /api/admin/results/winner
 * Fetch current verification and reveal state.
 *
 * POST /api/admin/results/winner
 * Actions:
 *   - 'request': Create 2-person approval request for winner verification
 *   - 'approve': Second organizer approves request and establishes verified ranking
 *   - 'reveal': Reveal 3rd, 2nd, or 1st place sequentially
 *   - 'publish': Final publication of results (owner permission)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { createApproval, approveRequest } from "@/lib/admin/approvals";
import { auditLog } from "@/lib/admin/audit";

export async function GET(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "view_live_metrics");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const admin = createSupabaseAdmin();
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";

  const { data: verification } = await admin
    .from("winner_verification")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    verification: verification || null,
    role: adminUser.role,
  });
}

export async function POST(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action } = body;
  const eventId = process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const admin = createSupabaseAdmin();

  // 1. Request Winner Approval (Requires approve_winner permission, creates pending approval)
  if (action === "request") {
    let adminUser;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      adminUser = await requirePermission(payload.sub, "approve_winner");
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const { ranking, winnerStudentId } = body;
    if (!ranking || !Array.isArray(ranking) || ranking.length === 0) {
      return NextResponse.json({ error: "Ranking list is required." }, { status: 400 });
    }

    const approvalId = await createApproval({
      eventId,
      action: "approve_winner",
      payload: { ranking: ranking.slice(0, 10), winnerStudentId: winnerStudentId || ranking[0]?.studentId },
      requestedBy: adminUser.id,
    });

    await auditLog({
      eventId,
      actorId: adminUser.id,
      actorName: adminUser.displayName,
      action: "request_winner_approval",
      targetType: "results",
      targetId: eventId,
      after: { approvalId, winnerStudentId },
    });

    return NextResponse.json({
      success: true,
      approvalId,
      message: "Winner verification request created. Second organizer sign-off required.",
    });
  }

  // 2. Second organizer approves
  if (action === "approve") {
    let adminUser;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      adminUser = await requirePermission(payload.sub, "approve_winner");
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const { approvalId } = body;
    if (!approvalId) {
      return NextResponse.json({ error: "approvalId is required." }, { status: 400 });
    }

    let approved;
    try {
      approved = await approveRequest(approvalId, adminUser.authUserId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    if (approved.action !== "approve_winner") {
      return NextResponse.json({ error: "Approval is not for winner verification." }, { status: 400 });
    }

    const { ranking, winnerStudentId } = approved.payload as any;

    // Fetch the approval record to get the first organizer
    const { data: approvalRec } = await admin
      .from("approvals")
      .select("requested_by")
      .eq("id", approvalId)
      .single();

    const approvers = [approvalRec?.requested_by, adminUser.id].filter(Boolean);

    // Create or update winner_verification record
    const { data: newRecord } = await admin
      .from("winner_verification")
      .insert({
        event_id: eventId,
        ranking,
        winner_student_id: winnerStudentId,
        approved_by: approvers,
        revealed_places: [],
        published: false,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    await auditLog({
      eventId,
      actorId: adminUser.id,
      actorName: adminUser.displayName,
      action: "approve_winner_verified",
      targetType: "results",
      targetId: eventId,
      after: { approvers, winnerStudentId },
    });

    return NextResponse.json({
      success: true,
      verification: newRecord,
      message: "Winner verified with dual-organizer sign-off. Places can now be revealed.",
    });
  }

  // 3. Reveal place (3rd, 2nd, 1st)
  if (action === "reveal") {
    let adminUser;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      adminUser = await requirePermission(payload.sub, "reveal_winner");
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const { place } = body; // e.g. 3, 2, 1
    if (!place || ![1, 2, 3].includes(Number(place))) {
      return NextResponse.json({ error: "Valid place (1, 2, or 3) is required." }, { status: 400 });
    }

    const { data: current } = await admin
      .from("winner_verification")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: "Winner verification must be approved first." }, { status: 400 });
    }

    const currentRevealed: number[] = Array.isArray(current.revealed_places)
      ? current.revealed_places
      : [];

    if (!currentRevealed.includes(Number(place))) {
      currentRevealed.push(Number(place));
    }

    await admin
      .from("winner_verification")
      .update({ revealed_places: currentRevealed })
      .eq("id", current.id);

    await auditLog({
      eventId,
      actorId: adminUser.id,
      actorName: adminUser.displayName,
      action: "reveal_winner_place",
      targetType: "results",
      targetId: eventId,
      after: { place, revealedPlaces: currentRevealed },
    });

    return NextResponse.json({
      success: true,
      revealedPlaces: currentRevealed,
      message: `Place #${place} revealed.`,
    });
  }

  // 4. Publish results (Owner level 5)
  if (action === "publish") {
    let adminUser;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      adminUser = await requirePermission(payload.sub, "publish_results");
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const { data: current } = await admin
      .from("winner_verification")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!current) {
      return NextResponse.json({ error: "Winner verification must be approved before publication." }, { status: 400 });
    }

    await admin
      .from("winner_verification")
      .update({ published: true, revealed_places: [3, 2, 1] })
      .eq("id", current.id);

    await admin
      .from("quiz_state")
      .update({ results_published: true, results_published_at: new Date().toISOString() })
      .eq("id", 1);

    await auditLog({
      eventId,
      actorId: adminUser.id,
      actorName: adminUser.displayName,
      action: "publish_results",
      targetType: "results",
      targetId: eventId,
      after: { published: true },
    });

    return NextResponse.json({
      success: true,
      message: "Official competition results published. Certificates and leaderboard are live.",
    });
  }

  return NextResponse.json({ error: "Invalid action. Supported: request, approve, reveal, publish." }, { status: 400 });
}
