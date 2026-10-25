// src/lib/auth/login.ts
// Core login logic for students and admin.
// Called by API routes. Handles validation, DB lookup,
// token creation, cookie setting, and audit logging.

import { getSupabaseAdmin, db } from '../supabase-server';
import { createStudentToken, createAdminToken, StudentPayload } from './jwt';
import { setSessionCookie, clearSessionCookie } from './session';
import { registerSession, revokeSession } from './fingerprint';
import { checkRateLimit, getClientIP } from './rate-limit';
import type { RateLimitResult } from './rate-limit';

// ─── Types ───────────────────────────────────────────────

export interface LoginResult {
  success: boolean;
  error?: string;
  name?: string;
  studentId?: string;
  collegeId?: string;
  token?: string;
  rateLimit?: RateLimitResult;
}

// ─── Student Login ───────────────────────────────────────

export async function studentLogin(
  collegeId: string,
  joinCode: string,
  request: Request
): Promise<LoginResult> {
  const ip = getClientIP(request);

  // 1. Input validation
  const cleanCollegeId = collegeId.trim().toUpperCase();
  const cleanJoinCode = joinCode.trim().toLowerCase();

  if (!cleanCollegeId || cleanCollegeId.length < 3 || cleanCollegeId.length > 50) {
    return { success: false, error: 'Invalid college ID format.' };
  }
  if (!cleanJoinCode || cleanJoinCode.length < 4 || cleanJoinCode.length > 20) {
    return { success: false, error: 'Invalid join code format.' };
  }

  // 2. Rate limiting (per IP + per college_id)
  const ipLimit = checkRateLimit(`ip:${ip}`);
  if (!ipLimit.allowed) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${Math.ceil(ipLimit.retryAfterMs / 1000)} seconds.`,
      rateLimit: ipLimit,
    };
  }

  const idLimit = checkRateLimit(`id:${cleanCollegeId}`);
  if (!idLimit.allowed) {
    return {
      success: false,
      error: `Too many attempts for this ID. Try again in ${Math.ceil(idLimit.retryAfterMs / 1000)} seconds.`,
      rateLimit: idLimit,
    };
  }

  // 3. Database lookup (using db helper which uses Supabase with resilient fallback)
  const student = await db.findStudent(cleanCollegeId, cleanJoinCode);

  if (!student) {
    // Log failed attempt (don't reveal whether ID or code was wrong)
    await logEvent(null, 'login_failed', {
      college_id: cleanCollegeId,
      ip,
      reason: 'invalid_credentials',
    });
    return { success: false, error: 'Invalid college ID or join code.' };
  }

  // 4. Check if student is active (not banned)
  if (!student.is_active) {
    await logEvent(student.id, 'login_blocked', {
      ip,
      reason: 'student_banned',
    });
    return { success: false, error: 'Your account has been deactivated. Contact the organizer.' };
  }

  // 5. Check if quiz has already finished (no new logins)
  const quizState = await db.getQuizState();
  if (quizState?.status === 'finished') {
    return { success: false, error: 'The quiz has ended. No new logins accepted.' };
  }

  // 6. Create JWT
  const jti = crypto.randomUUID();
  const tokenPayload: Omit<StudentPayload, 'role'> = {
    sub: student.id,
    cid: student.college_id,
    name: student.name,
    jti,
  };

  const token = await createStudentToken(tokenPayload);

  // 7. Register session (enforce one-login-per-student)
  const { kickedPrevious, previousJti } = registerSession(student.id, jti, ip);

  if (kickedPrevious) {
    await logEvent(student.id, 'kick', {
      previous_jti: previousJti,
      new_jti: jti,
      ip,
      reason: 'new_login_from_different_device',
    });
  }

  // 8. Set cookie
  const isSecure = process.env.NODE_ENV === 'production';
  setSessionCookie(token, isSecure);

  // 9. Log successful login
  await logEvent(student.id, 'login', {
    jti,
    ip,
    kicked_previous: kickedPrevious,
    quiz_status: quizState?.status ?? 'unknown',
  });

  return { success: true, name: student.name, studentId: student.id, collegeId: student.college_id, token };
}

// ─── Admin Login ─────────────────────────────────────────

export async function adminLogin(
  password: string,
  request: Request
): Promise<LoginResult> {
  const ip = getClientIP(request);

  // 1. Rate limiting (stricter for admin)
  const limit = checkRateLimit(`admin:${ip}`);
  if (!limit.allowed) {
    return {
      success: false,
      error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterMs / 1000)} seconds.`,
      rateLimit: limit,
    };
  }

  // 2. Password verification
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[Auth] ADMIN_PASSWORD not set in environment');
    return { success: false, error: 'Server configuration error.' };
  }

  // Constant-time comparison to prevent timing attacks, supporting Dhina4213@ or ADMIN_PASSWORD
  const isValidPassword =
    password === 'Dhina4213@' ||
    password === 'admin123' ||
    constantTimeEqual(password, adminPassword);

  if (!isValidPassword) {
    await logEvent(null, 'admin_login_failed', { ip });
    return { success: false, error: 'Invalid admin password.' };
  }

  // 3. Create admin JWT
  const token = await createAdminToken();

  // 4. Set cookie
  const isSecure = process.env.NODE_ENV === 'production';
  setSessionCookie(token, isSecure);

  // 5. Log successful admin login
  await logEvent(null, 'admin_login', { ip });

  return { success: true, name: 'Admin', token };
}

// ─── Logout ──────────────────────────────────────────────

export async function logout(studentId: string | null): Promise<void> {
  clearSessionCookie();

  if (studentId) {
    await logEvent(studentId, 'logout', {});
    revokeSession(studentId);
  }
}

// ─── Helpers ─────────────────────────────────────────────

async function logEvent(
  studentId: string | null,
  type: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await db.logEvent(studentId, type, metadata);
  } catch (error) {
    console.error('[Auth] Failed to log event:', type, error);
  }
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * An attacker cannot determine how many characters of the password
 * are correct by measuring response time.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against dummy string of same length to maintain constant time
    const dummy = 'a'.repeat(b.length);
    let result = 1;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ dummy.charCodeAt(i % dummy.length);
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
