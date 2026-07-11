import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, getClientIp, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first hit in a fresh window", () => {
    const r = rateLimit("k", 3, 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("blocks once the limit is exceeded", () => {
    expect(rateLimit("k", 2, 1000).allowed).toBe(true);
    expect(rateLimit("k", 2, 1000).allowed).toBe(true);
    const third = rateLimit("k", 2, 1000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    rateLimit("k", 1, 1000);
    expect(rateLimit("k", 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("k", 1, 1000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("reads the first x-forwarded-for entry", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no headers present", () => {
    expect(getClientIp(new Request("http://localhost"))).toBe("unknown");
  });
});
