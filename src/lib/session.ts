// src/lib/session.ts
// Compatibility bridge connecting legacy callers to @/lib/auth

import {
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from './auth/constants';
import {
  createStudentToken,
  verifyToken,
  StudentPayload,
  VerifiedPayload,
} from './auth/jwt';
import {
  getSessionCookie,
  setSessionCookie as authSetSessionCookie,
  clearSessionCookie as authClearSessionCookie,
} from './auth/session';
import { isSessionActive } from './auth/fingerprint';

export const SESSION_COOKIE_NAME = COOKIE_NAME;

export interface SessionPayload {
  studentId: string;
  collegeId: string;
  name: string;
  sub?: string;
  cid?: string;
  role?: string;
  jti?: string;
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

export async function createSession(payload: {
  studentId: string;
  collegeId: string;
  name: string;
}): Promise<string> {
  return createStudentToken({
    sub: payload.studentId,
    cid: payload.collegeId,
    name: payload.name,
    jti: crypto.randomUUID(),
  });
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const verified = await verifyToken(token);
  if (!verified) return null;

  if (verified.role === 'student') {
    return {
      studentId: verified.sub,
      collegeId: verified.cid,
      name: verified.name,
      sub: verified.sub,
      cid: verified.cid,
      role: verified.role,
      jti: verified.jti,
    };
  }

  return {
    studentId: 'admin',
    collegeId: 'ADMIN',
    name: 'Admin',
    sub: 'admin',
    cid: 'ADMIN',
    role: 'admin',
    jti: verified.jti,
  };
}

export function setSessionCookie(token: string) {
  authSetSessionCookie(token, process.env.NODE_ENV === 'production');
}

export function clearSessionCookie() {
  authClearSessionCookie();
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const token = getSessionCookie();
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    // Check one-session-per-student fingerprint
    if (payload.role === 'student') {
      if (!isSessionActive(payload.sub, payload.jti)) {
        return null; // Session kicked
      }
      return {
        studentId: payload.sub,
        collegeId: payload.cid,
        name: payload.name,
        sub: payload.sub,
        cid: payload.cid,
        role: payload.role,
        jti: payload.jti,
      };
    }

    return {
      studentId: 'admin',
      collegeId: 'ADMIN',
      name: 'Admin',
      sub: 'admin',
      cid: 'ADMIN',
      role: 'admin',
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
