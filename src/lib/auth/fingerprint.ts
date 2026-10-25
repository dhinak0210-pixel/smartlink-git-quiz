// src/lib/auth/fingerprint.ts
// Active session fingerprint tracking.
// Implements the "one login per student" rule.

interface SessionRecord {
  jti: string;
  loggedInAt: number;
  ipAddress: string;
}

const activeSessions = new Map<string, SessionRecord>();

export function registerSession(
  studentId: string,
  jti: string,
  ipAddress: string
): { kickedPrevious: boolean; previousJti: string | null } {
  const existing = activeSessions.get(studentId);
  const kickedPrevious = !!existing && existing.jti !== jti;
  const previousJti = existing?.jti ?? null;

  activeSessions.set(studentId, {
    jti,
    loggedInAt: Date.now(),
    ipAddress,
  });

  return { kickedPrevious, previousJti };
}

export function isSessionActive(studentId: string, jti: string): boolean {
  const record = activeSessions.get(studentId);
  if (!record) {
    // No record means either cold start or session before reboot; allow request if JWT is valid
    return true;
  }
  return record.jti === jti;
}

export function revokeSession(studentId: string): void {
  activeSessions.delete(studentId);
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}

export function resetSessionStore(): void {
  activeSessions.clear();
}
