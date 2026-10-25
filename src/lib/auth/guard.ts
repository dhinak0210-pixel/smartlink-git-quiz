// src/lib/auth/guard.ts
// Route protection helpers.
// Used inside API routes to verify the session before processing.

import { cookies, headers } from 'next/headers';
import { getSessionCookie } from './session';
import { verifyToken, StudentPayload, AdminPayload, VerifiedPayload } from './jwt';
import { isSessionActive } from './fingerprint';

export interface AuthContext {
  payload: VerifiedPayload;
  isStudent: boolean;
  isAdmin: boolean;
  studentId: string | null;
}

/**
 * Verify the current request's session.
 * Call this at the top of every protected API route.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *   if (!auth.isStudent) return Response.json({ error: 'Forbidden' }, { status: 403 });
 */
export async function requireAuth(): Promise<AuthContext | null> {
  let token = getSessionCookie();
  if (!token) {
    try {
      const headerList = headers();
      token = headerList.get('x-admin-token') ||
              headerList.get('x-session-token') ||
              (headerList.get('authorization')?.startsWith('Bearer ')
                ? headerList.get('authorization')!.slice(7).trim()
                : undefined) || undefined;
    } catch {
      // not in request context
    }
  }
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  // Check one-session-per-student enforcement
  if (payload.role === 'student') {
    if (!isSessionActive(payload.sub, payload.jti)) {
      return null; // Session was kicked
    }
  }

  return {
    payload,
    isStudent: payload.role === 'student',
    isAdmin: payload.role === 'admin',
    studentId: payload.role === 'student' ? payload.sub : null,
  };
}

/**
 * Require a student session specifically.
 * Returns the student payload or null.
 */
export async function requireStudent(): Promise<StudentPayload | null> {
  const auth = await requireAuth();
  if (!auth || !auth.isStudent) return null;
  return auth.payload as StudentPayload;
}

/**
 * Require an admin session specifically.
 * Returns true if admin, false otherwise.
 */
export async function requireAdmin(): Promise<boolean> {
  const auth = await requireAuth();
  return auth?.isAdmin ?? false;
}
