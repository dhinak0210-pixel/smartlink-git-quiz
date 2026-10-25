// src/lib/auth/jwt.ts
// JWT creation and verification using the `jose` library.
// Works in both Node.js and Edge Runtime.

import { SignJWT, jwtVerify, errors } from 'jose';
import { TOKEN_CONFIG } from './constants';

// Lazy-load the secret to avoid issues with Edge Runtime initialization
function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set and at least 32 characters long. ' +
      'Generate one: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
  }
  return new TextEncoder().encode(secret);
}

// ─── Student Token ───────────────────────────────────────

export interface StudentPayload {
  sub: string;     // student UUID
  cid: string;     // college_id
  name: string;    // display name
  role: 'student';
  jti: string;     // unique token ID
}

export async function createStudentToken(payload: Omit<StudentPayload, 'role'>): Promise<string> {
  const secret = getSecret();

  return new SignJWT({ ...payload, role: 'student' as const })
    .setProtectedHeader({ alg: TOKEN_CONFIG.ALGORITHM })
    .setIssuedAt()
    .setIssuer(TOKEN_CONFIG.ISSUER)
    .setAudience(TOKEN_CONFIG.AUDIENCE)
    .setExpirationTime(TOKEN_CONFIG.STUDENT_EXPIRY)
    .sign(secret);
}

// ─── Admin Token ─────────────────────────────────────────

export interface AdminPayload {
  sub: 'admin';
  role: 'admin';
  jti: string;
}

export async function createAdminToken(): Promise<string> {
  const secret = getSecret();
  const jti = crypto.randomUUID();

  return new SignJWT({ sub: 'admin', role: 'admin' as const, jti })
    .setProtectedHeader({ alg: TOKEN_CONFIG.ALGORITHM })
    .setIssuedAt()
    .setIssuer(TOKEN_CONFIG.ISSUER)
    .setAudience(TOKEN_CONFIG.AUDIENCE)
    .setExpirationTime(TOKEN_CONFIG.ADMIN_EXPIRY)
    .sign(secret);
}

// ─── Verification ────────────────────────────────────────

export type VerifiedPayload = StudentPayload | AdminPayload;

export async function verifyToken(token: string): Promise<VerifiedPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret, {
      issuer: TOKEN_CONFIG.ISSUER,
      audience: TOKEN_CONFIG.AUDIENCE,
      algorithms: [TOKEN_CONFIG.ALGORITHM],
    });

    // Type narrowing based on role claim
    if (payload.role === 'admin') {
      return {
        sub: 'admin',
        role: 'admin',
        jti: payload.jti as string,
      };
    }

    if (payload.role === 'student') {
      return {
        sub: payload.sub as string,
        cid: payload.cid as string,
        name: payload.name as string,
        role: 'student',
        jti: payload.jti as string,
      };
    }

    return null; // Unknown role
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return null; // Token expired — normal, not an attack
    }
    if (error instanceof errors.JWTInvalid) {
      return null; // Tampered token
    }
    // Log unexpected errors but don't leak details to the client
    console.error('[JWT] Verification error:', error);
    return null;
  }
}
