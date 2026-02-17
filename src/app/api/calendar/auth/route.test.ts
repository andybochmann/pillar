import { describe, it, expect, vi, beforeEach } from "vitest";

const session = vi.hoisted(() => ({
  user: { id: "user-123", name: "Test User", email: "test@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

import { GET } from "./route";

describe("GET /api/calendar/auth", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_GOOGLE_ID", "test-client-id");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
  });

  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 503 when Google is not configured", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "");

    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("redirects to Google OAuth with correct params", async () => {
    const res = await GET();

    expect(res.status).toBe(307);
    const location = res.headers.get("location")!;
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("calendar.events");
    expect(location).toContain("access_type=offline");
    expect(location).toContain("prompt=consent");
    expect(location).toContain("login_hint=test%40example.com");

    // Should set state cookie
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("calendar_oauth_state");
  });
});
