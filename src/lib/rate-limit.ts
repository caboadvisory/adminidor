import "server-only";

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Scope: this guards expensive endpoints (notably the Assistant chat route,
 * which fans out to several Opus calls per request) against accidental or
 * malicious request floods / API-cost exhaustion. State lives in the process,
 * so the limit is enforced per server instance — fine for a single-instance
 * deployment. For a horizontally-scaled deployment, swap the Map for a shared
 * store (e.g. Upstash Redis) keeping the same interface.
 */
type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

// Opportunistic cleanup so the Map can't grow unbounded across many keys.
export function pruneRateLimits(now: number = Date.now()): void {
  for (const [key, win] of buckets) {
    if (now >= win.resetAt) buckets.delete(key);
  }
}
