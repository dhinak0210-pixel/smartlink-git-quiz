// src/lib/auth/constants.ts
// Shared constants for the auth layer.

export const COOKIE_NAME = 'quiz_session';

export const TOKEN_CONFIG = {
  ALGORITHM: 'HS256' as const,
  STUDENT_EXPIRY: '4h',
  ADMIN_EXPIRY: '2h',
  ISSUER: 'smartlink-quiz',
  AUDIENCE: 'smartlink-quiz',
} as const;

export const RATE_LIMIT = {
  MAX_ATTEMPTS: 5,          // Max login attempts
  WINDOW_MS: 60_000,        // Per 60-second window
  LOCKOUT_MS: 300_000,      // 5-minute lockout after exceeding
} as const;

export const SESSION_MAX_AGE_SECONDS = 4 * 60 * 60; // 4 hours

export type UserRole = 'student' | 'admin';
