/**
 * Approvals Management API
 *
 * GET /api/admin/approvals
 * Lists pending 2-person approval requests for the event.
 *
 * POST /api/admin/approvals
 * Approve or reject a pending request by ID.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin/permissions";
import { getPendingApprovals, approveRequest, rejectRequest } from "@/lib/admin/approvals";

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

  const eventId = req.nextUrl.searchParams.get("eventId") || process.env.DEFAULT_EVENT_ID || "00000000-0000-0000-0000-000000000000";
  const approvals = await getPendingApprovals(eventId);

  return NextResponse.json({
    approvals,
    currentAdminId: adminUser.id,
  });
}

export async function POST(req: NextRequest) {
  let token = req.cookies.get("sb-access-token")?.value;
  if (!token && req.headers.get("authorization")?.startsWith("Bearer ")) {
    token = req.headers.get("authorization")?.substring(7).trim();
  }
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let adminUser;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    adminUser = await requirePermission(payload.sub, "void_question"); // Requires organizer level 4
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const { approvalId, decision, rejectionReason } = await req.json();

  if (!approvalId || !decision) {
    return NextResponse.json({ error: "approvalId and decision ('approved' | 'rejected') required." }, { status: 400 });
  }

  if (decision === "approved") {
    try {
      const result = await approveRequest(approvalId, adminUser.authUserId);
      return NextResponse.json({ success: true, message: "Request approved.", result });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  if (decision === "rejected") {
    try {
      await rejectRequest(approvalId, adminUser.authUserId, rejectionReason || "Rejected by organizer");
      return NextResponse.json({ success: true, message: "Request rejected." });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
}
