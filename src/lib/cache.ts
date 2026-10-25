// src/lib/cache.ts
// Simple in-memory TTL cache for high-frequency endpoints.
//
// Why in-memory and not Redis?
// - Vercel Hobby doesn't include Redis (Upstash free tier is 10K cmds/day)
// - The quiz lasts ~7 minutes. In-memory is sufficient.
// - Cold starts lose the cache, but it rebuilds in <1 second.
// - The worst case is a few extra DB queries on cold start.
//
// Caveat: Vercel serverless functions may run on different instances.
// Each instance has its own cache. This is acceptable because:
// - Leaderboard data is eventually consistent (5s staleness is fine)
// - The DB is the source of truth; cache is just for performance

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs: number = 60_000) {
    // Periodic cleanup to prevent memory leaks
    if (typeof globalThis !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
      // Allow the process to exit even if the interval is running
      if (this.cleanupInterval?.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  // Compatibility aliases
  delete(key: string): void {
    this.invalidate(key);
  }

  clear(): void {
    this.invalidateAll();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

// Global singleton (persists across warm invocations on the same instance)
const globalCacheInstance =
  (globalThis as unknown as { __smartlink_cache_ttl?: TTLCache }).__smartlink_cache_ttl || new TTLCache();

if (process.env.NODE_ENV !== 'production') {
  (globalThis as unknown as { __smartlink_cache_ttl?: TTLCache }).__smartlink_cache_ttl = globalCacheInstance;
}

export const cache = globalCacheInstance;
