/**
 * Two-person approval system.
 * Sensitive actions create a pending approval.
 * A second organizer approves or rejects.
 * On approval, the action is executed.
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { auditLog } from "./audit";
import { getAdminUser, type AdminUser } from "./permissions";

export interface ApprovalRequest {
  eventId: string;
  action: string;
  payload: Record<string, unknown>;
  requestedBy: string; // admin_users.id
}

/**
 * Create a pending approval request.
 */
export async function createApproval(req: ApprovalRequest): Promise<string> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("approvals")
    .insert({
      event_id: req.eventId,
      action: req.action,
      payload: req.payload,
      requested_by: req.requestedBy,
      status: "pending",
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create approval: ${error.message}`);
  return data.id;
}

/**
 * Approve a pending request. The approver must be a different admin.
 * Returns the approval payload for the caller to execute.
 */
export async function approveRequest(
  approvalId: string,
  approverAuthId: string,
): Promise<{ action: string; payload: Record<string, unknown> }> {
  const admin = createSupabaseAdmin();
  const approver = await getAdminUser(approverAuthId);
  if (!approver) throw new Error("Approver not found");

  // Fetch the pending approval
  const { data: approval, error } = await admin
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("status", "pending")
    .single();

  if (error || !approval) throw new Error("Approval not found or already processed");

  // Cannot approve your own request
  if (approval.requested_by === approver.id) {
    throw new Error("Cannot approve your own request");
  }

  // Check expiry
  if (new Date(approval.expires_at) < new Date()) {
    await admin.from("approvals").update({ status: "expired" }).eq("id", approvalId);
    throw new Error("Approval has expired");
  }

  // Mark as approved
  await admin
    .from("approvals")
    .update({
      status: "approved",
      approved_by: approver.id,
      executed_at: new Date().toISOString(),
    })
    .eq("id", approvalId);

  // Audit
  await auditLog({
    eventId: approval.event_id,
    actorId: approver.id,
    actorName: approver.displayName,
    action: `approve_${approval.action}`,
    targetType: "approval",
    targetId: approvalId,
    before: { status: "pending" },
    after: { status: "approved" },
  });

  return { action: approval.action, payload: approval.payload };
}

/**
 * Reject a pending request.
 */
export async function rejectRequest(
  approvalId: string,
  rejectorAuthId: string,
  reason: string,
  eventId?: string
): Promise<void> {
  const admin = createSupabaseAdmin();
  const rejector = await getAdminUser(rejectorAuthId);
  if (!rejector) throw new Error("Rejector not found");

  await admin
    .from("approvals")
    .update({
      status: "rejected",
      approved_by: rejector.id,
      rejection_reason: reason,
    })
    .eq("id", approvalId)
    .eq("status", "pending");

  await auditLog({
    eventId: eventId || process.env.DEFAULT_EVENT_ID || "",
    actorId: rejector.id,
    actorName: rejector.displayName,
    action: "reject_approval",
    targetType: "approval",
    targetId: approvalId,
    reason,
  });
}

/**
 * Get pending approvals for the dashboard.
 */
export async function getPendingApprovals(eventId: string) {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("approvals")
    .select("*, admin_users!requested_by(display_name)")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  return data || [];
}
