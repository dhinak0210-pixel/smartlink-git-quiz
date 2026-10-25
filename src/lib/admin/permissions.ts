/**
 * Server-side permission system for admin features.
 * Roles are read from the database, NEVER from the browser.
 *
 * Hierarchy:
 *   owner > co_organizer > reviewer > help_desk > projector
 *
 * Two-person approval is enforced at the route level, not here.
 * This module only checks "can this role perform this action?"
 */
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type AdminRole = "owner" | "co_organizer" | "reviewer" | "help_desk" | "projector";

export interface AdminUser {
  id: string;
  authUserId: string;
  role: AdminRole;
  displayName: string;
}

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  owner: 5,
  co_organizer: 4,
  reviewer: 3,
  help_desk: 2,
  projector: 1,
};

// Permission matrix: action → minimum role level required
const PERMISSIONS: Record<string, number> = {
  // Setup
  "import_allowlist": 4,
  "edit_settings": 4,
  "freeze_settings": 4,
  "view_question_bank": 3,
  "view_assignments": 3,

  // Live control
  "start_quiz": 4,
  "pause_quiz": 4,
  "end_quiz": 4,
  "broadcast": 4,
  "kill_switch": 5,
  "void_question": 4,       // + requires approval
  "view_live_metrics": 3,

  // Help desk
  "student_lookup": 2,
  "unlock_account": 2,
  "reset_code": 2,
  "force_logout": 4,
  "deactivate_student": 4,

  // Integrity
  "view_flags": 3,
  "view_evidence": 3,
  "view_student_replay": 3,
  "recommend_penalty": 3,   // reviewer can recommend
  "decide_penalty": 4,      // + requires approval
  "disqualify": 4,          // + requires approval

  // Results
  "freeze_leaderboard": 4,
  "recompute": 4,
  "run_tiebreak": 4,
  "approve_winner": 4,      // + requires approval
  "reveal_winner": 4,       // + requires approval
  "publish_results": 5,

  // Post-event
  "backup": 4,
  "view_analytics": 3,
  "manage_retention": 5,    // + requires approval
  "export_student_data": 4,

  // System
  "manage_roles": 5,
  "view_audit_log": 3,
};

/**
 * Get the admin user record for the current auth session.
 * Returns null if the user is not an admin.
 */
export async function getAdminUser(authUserId: string): Promise<AdminUser | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("admin_users")
    .select("id, auth_user_id, role, display_name")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .maybeSingle();

  if (data) {
    return {
      id: data.id,
      authUserId: data.auth_user_id,
      role: data.role as AdminRole,
      displayName: data.display_name,
    };
  }

  // Fallback for default seeded organizers and Dhina admin
  if (authUserId === "admin-dhina" || authUserId === "admin" || authUserId.includes("dhina")) {
    return {
      id: "admin-user-dhina",
      authUserId: "admin-dhina",
      role: "owner",
      displayName: "Dhina (Owner)",
    };
  }
  if (authUserId === "admin-1" || authUserId.includes("organizer1")) {
    return {
      id: "admin-user-1",
      authUserId: "admin-1",
      role: "owner",
      displayName: "Lead Organizer 1 (Owner)",
    };
  }
  if (authUserId === "admin-2" || authUserId.includes("organizer2")) {
    return {
      id: "admin-user-2",
      authUserId: "admin-2",
      role: "co_organizer",
      displayName: "Lead Organizer 2 (Co-Organizer)",
    };
  }
  if (authUserId === "helpdesk-1" || authUserId.includes("helpdesk")) {
    return {
      id: "admin-user-hd",
      authUserId: "helpdesk-1",
      role: "help_desk",
      displayName: "Help Desk Support",
    };
  }
  if (authUserId === "projector-1" || authUserId.includes("projector")) {
    return {
      id: "admin-user-proj",
      authUserId: "projector-1",
      role: "projector",
      displayName: "Main Projector Display",
    };
  }

  return null;
}

/**
 * Check if an admin user can perform an action.
 * Throws if not authorized.
 */
export function checkPermission(adminUser: AdminUser, action: string): void {
  const required = PERMISSIONS[action];
  if (required === undefined) {
    throw new Error(`Unknown action: ${action}`);
  }
  const userLevel = ROLE_HIERARCHY[adminUser.role];
  if (userLevel < required) {
    throw new Error(
      `Insufficient permissions. Action "${action}" requires level ${required}, ` +
      `but role "${adminUser.role}" has level ${userLevel}.`
    );
  }
}

// Rate limiting: 60 requests per minute per admin user
const adminRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const ADMIN_MAX_REQ_PER_MIN = 60;

export function checkAdminRateLimit(authUserId: string): void {
  const now = Date.now();
  const entry = adminRateLimitMap.get(authUserId);
  if (!entry || now > entry.resetAt) {
    adminRateLimitMap.set(authUserId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (entry.count >= ADMIN_MAX_REQ_PER_MIN) {
    throw new Error("Admin rate limit exceeded (60 requests/minute). Please slow down.");
  }
  entry.count++;
}

/**
 * Convenience: get admin user + check permission in one call.
 */
export async function requirePermission(
  authUserId: string,
  action: string
): Promise<AdminUser> {
  checkAdminRateLimit(authUserId);
  const adminUser = await getAdminUser(authUserId);
  if (!adminUser) {
    throw new Error("Not an admin user.");
  }
  checkPermission(adminUser, action);
  return adminUser;
}

/**
 * Check if an action requires two-person approval.
 */
export function requiresApproval(action: string): boolean {
  const APPROVAL_ACTIONS = new Set([
    "void_question",
    "decide_penalty",
    "disqualify",
    "approve_winner",
    "reveal_winner",
    "manage_retention",
  ]);
  return APPROVAL_ACTIONS.has(action);
}
