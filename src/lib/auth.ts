/**
 * Authentication utilities built on Supabase Auth.
 * Replaces the custom jose JWT from Layer 1 while preserving backward compatibility.
 *
 * Key principles:
 * - Supabase Auth handles password hashing
 * - All account creation via admin API (pre-confirmed)
 * - No emails sent by Supabase Auth
 * - Single session enforcement via active_session_id
 */
import { createSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServer } from "./supabase/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { verifyToken, StudentPayload, AdminPayload } from "./auth/jwt";
import { COOKIE_NAME } from "./auth/constants";
import { getSessionCookie } from "./auth/session";

export { verifyToken as verifyJWT } from "./auth/jwt";

export interface AuthenticatedStudent {
  id: string;
  college_id: string;
  name: string;
  role: "student";
  sub: string;
}

export interface AuthenticatedAdmin {
  sub: string;
  role: "admin";
}

// --- IP Hashing ---

export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "default-salt-change-me";
  return crypto.createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 16);
}

// --- Device Detection ---

export function detectDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) return "mobile";
  if (/tablet|ipad/.test(ua)) return "tablet";
  return "desktop";
}

// --- Common Password Check ---

const COMMON_PASSWORDS = new Set([
  "password", "12345678", "123456789", "1234567890", "qwerty12",
  "password1", "iloveyou", "sunshine1", "princess1", "football1",
  "charlie1", "shadow12", "michael1", "qwerty123", "abc12345",
  "letmein1", "welcome1", "monkey123", "master12", "dragon12",
  "login123", "starwars1", "passw0rd", "1234qwer", "qwer1234",
  "asdf1234", "zxcv1234", "password12", "pass1234", "test1234",
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

// --- Sign-Up Window ---

export function isSignupOpen(): boolean {
  const eventDateStr = process.env.EVENT_DATE || "2026-11-01T10:00:00+05:30";
  const eventDate = new Date(eventDateStr);
  const now = new Date();
  const openDate = new Date(eventDate);
  openDate.setDate(openDate.getDate() - parseInt(process.env.SIGNUP_OPEN_DAYS_BEFORE || "10", 10));
  const closeDate = new Date(eventDate);
  closeDate.setDate(closeDate.getDate() - parseInt(process.env.SIGNUP_CLOSE_DAYS_BEFORE || "1", 10));
  return now >= openDate && now <= closeDate;
}

export function isSignupClosed(): boolean {
  return !isSignupOpen();
}

// --- Email Domain Check ---

export function isAllowedDomain(email: string): boolean {
  if (email.toLowerCase().trim() === "dhina7250@gmail.com") return true;
  const allowed = process.env.ALLOWED_EMAIL_DOMAIN;
  if (!allowed) return true; // No restriction if not set
  return email.toLowerCase().endsWith(`@${allowed.toLowerCase()}`);
}

// --- Session Management ---

export function generateSessionId(): string {
  return crypto.randomUUID();
}

// --- Login Event Logging ---

export async function logLoginEvent(params: {
  studentId?: string;
  authUserId?: string;
  eventType: string;
  ip: string;
  userAgent: string;
  details?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdmin();
  await admin.from("login_events").insert({
    student_id: params.studentId || null,
    auth_user_id: params.authUserId || null,
    event_type: params.eventType,
    hashed_ip: hashIP(params.ip),
    device_type: detectDevice(params.userAgent),
    user_agent: params.userAgent.slice(0, 500),
    details: params.details || {},
  });
}

// --- Lockout Check ---

export async function isAccountLocked(email: string): Promise<{ locked: boolean; remainingMs?: number }> {
  if (email.toLowerCase().trim() === "dhina7250@gmail.com") return { locked: false };
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("students")
    .select("locked_until, join_attempts")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!data?.locked_until) return { locked: false };

  const lockExpiry = new Date(data.locked_until);
  const now = new Date();
  if (now < lockExpiry) {
    return { locked: true, remainingMs: lockExpiry.getTime() - now.getTime() };
  }

  // Lock expired — clear it
  await admin
    .from("students")
    .update({ locked_until: null, join_attempts: 0 })
    .eq("email", email.toLowerCase());

  return { locked: false };
}

// --- Get Current User ---

export async function getCurrentUser() {
  let user: any = null;

  try {
    const supabase = await createSupabaseServer();
    const { data: { user: sbUser }, error } = await supabase.auth.getUser();
    if (!error && sbUser) {
      user = sbUser;
    }
  } catch {
    // Supabase network / server client failed
  }

  // Fallback for local mock environment or direct cookie decoding
  if (!user) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("sb-access-token")?.value || cookieStore.get(COOKIE_NAME)?.value;
      if (token) {
        const parts = token.split(".");
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          if (payload?.sub) {
            const admin = createSupabaseAdmin();
            const { data: authData } = await admin.auth.getUser(token);
            if (authData?.user) {
              user = authData.user;
            } else {
              user = {
                id: payload.sub,
                email: payload.email,
                app_metadata: payload.app_metadata || { role: payload.role || "student" },
                user_metadata: payload.user_metadata || {},
              };
            }
          }
        }
      }
    } catch {
      // In contexts without cookies
    }
  }

  if (!user) return null;

  // Admin users check if they also have an associated student row (e.g. Dhina admin & participant)
  if (user.app_metadata?.role === "admin") {
    const admin = createSupabaseAdmin();
    const cleanEmail = (user.email || "dhina7250@gmail.com").toLowerCase();
    const { data: student } = await admin
      .from("students")
      .select("id, name, email, register_no, status, active_session_id, display_name_preference")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (student && student.status !== "deactivated") {
      return { ...user, student };
    }
    return user;
  }

  // Verify single session / student record
  const admin = createSupabaseAdmin();
  const { data: student } = await admin
    .from("students")
    .select("id, name, email, register_no, status, active_session_id, display_name_preference")
    .eq("auth_user_id", user.id)
    .single();

  if (!student) return null;
  if (student.status === "deactivated") return null;

  return { ...user, student };
}

// --- Admin Check ---

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.app_metadata?.role !== "admin") throw new Error("Not authorized");
  return user;
}

// --- Backward Compatibility with Layer 1/4 Routes ---

export async function verifyStudentToken(req?: NextRequest): Promise<AuthenticatedStudent | null> {
  // First, try Supabase Auth / cookie
  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.student) {
    return {
      id: currentUser.student.id,
      college_id: currentUser.student.register_no || currentUser.student.id,
      name: currentUser.student.name,
      role: "student",
      sub: currentUser.id,
    };
  }

  // Fallback to legacy jose JWT
  let token: string | undefined;
  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value || req.cookies.get("sb-access-token")?.value;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }
  }

  if (!token) {
    try {
      token = getSessionCookie();
    } catch {}
  }

  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "student") return null;
    const student = payload as StudentPayload;
    return {
      id: student.sub,
      college_id: student.cid,
      name: student.name,
      role: "student",
      sub: student.sub,
    };
  } catch {
    return null;
  }
}

export async function verifyAdminToken(req?: NextRequest): Promise<AuthenticatedAdmin | null> {
  const currentUser = await getCurrentUser();
  if (currentUser && currentUser.app_metadata?.role === "admin") {
    return {
      sub: currentUser.id,
      role: "admin",
    };
  }

  let token: string | undefined;
  if (req) {
    token = req.cookies.get(COOKIE_NAME)?.value || req.cookies.get("sb-access-token")?.value;
    if (!token) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }
  }

  if (!token) {
    try {
      token = getSessionCookie();
    } catch {}
  }

  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") return null;
    const admin = payload as AdminPayload;
    return {
      sub: admin.sub,
      role: "admin",
    };
  } catch {
    return null;
  }
}
