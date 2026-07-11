import { randomBytes } from "crypto";

/**
 * Generate a high-entropy secret token for the iCal feed URL.
 *
 * 32 random bytes (256 bits) hex-encoded → 64 hex chars. This is embedded in
 * the feed URL (a Google-Calendar-style "secret address"), so it must be
 * infeasible to guess. Regenerating produces a new token, which revokes the old
 * URL.
 */
export function generateCalendarFeedToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Derive the app's absolute base URL (scheme + host, no trailing slash).
 *
 * Preference order:
 *  1. `AUTH_URL` / `NEXTAUTH_URL` — the canonical, admin-configured URL used by
 *     Auth.js (see docs/environment-variables.md). Best for stable, shareable
 *     links because it doesn't depend on the incoming request.
 *  2. Forwarded/host headers from the request (works behind the reverse proxy;
 *     `trustHost: true` is already set in auth.config.ts).
 *
 * Returns `null` when nothing usable is available so callers can fail
 * gracefully rather than emit a broken relative URL.
 */
export function getBaseUrl(headers?: Headers): string | null {
  const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  if (headers) {
    const host =
      headers.get("x-forwarded-host") ?? headers.get("host") ?? null;
    if (host) {
      const proto = headers.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}`;
    }
  }

  return null;
}

/**
 * Build the absolute feed URL for a token, or `null` if no base URL is known.
 */
export function buildFeedUrl(
  token: string,
  headers?: Headers,
): string | null {
  const base = getBaseUrl(headers);
  if (!base) return null;
  return `${base}/api/calendar/${token}/feed.ics`;
}
