/**
 * Append-only audit logging.
 * Every admin mutation MUST go through this.
 * Records are inserted via service_role — no RLS policy allows auth users to insert.
 * Nobody can edit or delete entries from the interface.
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

export interface AuditEntry {
  eventId: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip?: string;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  const admin = createSupabaseAdmin();
  const ipHash = entry.ip
    ? crypto.createHash("sha256").update(entry.ip).digest("hex").slice(0, 16)
    : null;

  const { error } = await admin.from("audit_log").insert({
    event_id: entry.eventId,
    actor_id: entry.actorId,
    actor_name: entry.actorName,
    action: entry.action,
    target_type: entry.targetType || null,
    target_id: entry.targetId || null,
    before_values: entry.before || {},
    after_values: entry.after || {},
    reason: entry.reason || null,
    ip_hash: ipHash,
  });

  if (error) {
    // Audit failure is critical — log to console but don't crash the action
    console.error("AUDIT LOG FAILURE:", error.message, entry);
  }
}

/**
 * Wrapper that audits a mutation automatically.
 */
export async function auditedMutation<T>(
  adminUser: { id: string; displayName: string },
  eventId: string,
  action: string,
  targetType: string,
  targetId: string,
  mutation: () => Promise<{ before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string }>,
  ip?: string,
): Promise<T> {
  const result = await mutation();

  await auditLog({
    eventId,
    actorId: adminUser.id,
    actorName: adminUser.displayName,
    action,
    targetType,
    targetId,
    before: result.before,
    after: result.after,
    reason: result.reason,
    ip,
  });

  return result as T;
}
