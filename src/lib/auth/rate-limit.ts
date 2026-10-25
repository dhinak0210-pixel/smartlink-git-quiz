// src/lib/auth/rate-limit.ts
// In-memory rate limiter for login attempts.
// Uses a sliding window per IP address and identifier.

import { RATE_LIMIT } from './constants';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (entry.resetAt < now && entry.lockedUntil < now) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(identifier);

  // No previous attempts — allow
  if (!entry) {
    store.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT.WINDOW_MS,
      lockedUntil: 0,
    });
    return { allowed: true, remaining: RATE_LIMIT.MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  // Currently locked out
  if (entry.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.lockedUntil - now,
    };
  }

  // Window has expired — reset
  if (entry.resetAt < now) {
    store.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT.WINDOW_MS,
      lockedUntil: 0,
    });
    return { allowed: true, remaining: RATE_LIMIT.MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  // Within window — increment
  entry.count += 1;

  if (entry.count > RATE_LIMIT.MAX_ATTEMPTS) {
    // Lock out
    entry.lockedUntil = now + RATE_LIMIT.LOCKOUT_MS;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: RATE_LIMIT.LOCKOUT_MS,
    };
  }

  return {
    allowed: true,
    remaining: RATE_LIMIT.MAX_ATTEMPTS - entry.count,
    retryAfterMs: 0,
  };
}

// Get client IP from request headers (Vercel-specific)
export function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Test helper to clear rate limit store
export function resetRateLimitStore(): void {
  store.clear();
}
