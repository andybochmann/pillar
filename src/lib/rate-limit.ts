/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * NOTE (M19): state lives in the process only. This is adequate for the
 * single-instance Docker Compose deployment this app ships with, but provides
 * NO protection across multiple app instances / serverless workers. A shared
 * store (Redis, etc.) would be required for a horizontally-scaled deployment.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  // Survive Next.js HMR so limits aren't reset on every hot reload in dev.
  var __rateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets: Map<string, Bucket> = (globalThis.__rateLimitBuckets ??=
  new Map());

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the current window resets (0 when allowed with room). */
  retryAfterMs: number;
}

/**
 * Records a hit against `key` and reports whether it is within `limit` per
 * `windowMs`. The first call in a fresh window is always allowed.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Opportunistic pruning to keep the map bounded under many distinct keys.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterMs: 0,
  };
}

/** Best-effort client IP from standard proxy headers; falls back to "unknown". */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Clears all rate-limit state. Intended for tests. */
export function resetRateLimits(): void {
  buckets.clear();
}
