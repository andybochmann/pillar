import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers/db";
import { createTestUser, createTestAccount } from "@/test/helpers/factories";
import { Account } from "@/models/account";
import { CalendarSync } from "@/models/calendar-sync";

const session = vi.hoisted(() => ({
  user: { id: "000000000000000000000000", name: "Test User", email: "test@example.com" },
  expires: "2099-01-01T00:00:00.000Z",
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { GET } from "./route";

beforeAll(async () => {
  await setupTestDB();
});

afterEach(async () => {
  await clearTestDB();
  mockFetch.mockReset();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await teardownTestDB();
});

function makeRequest(params: Record<string, string>, stateCookie?: string) {
  const url = new URL("http://localhost:3000/api/calendar/callback");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const req = new NextRequest(url);
  if (stateCookie) {
    req.cookies.set("calendar_oauth_state", stateCookie);
  }
  return req;
}

describe("GET /api/calendar/callback", () => {
  it("redirects to login when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const req = makeRequest({ code: "abc", state: "xyz" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects with error when Google returns error", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const req = makeRequest({ error: "access_denied" });
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("calendar=error");
    expect(res.headers.get("location")).toContain("access_denied");
  });

  it("redirects with error on state mismatch", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const req = makeRequest(
      { code: "abc", state: "wrong-state" },
      "correct-state",
    );
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("invalid_state");
  });

  it("exchanges code for tokens and creates CalendarSync", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-456",
    });

    vi.stubEnv("AUTH_GOOGLE_ID", "test-client-id");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-client-secret");
    vi.stubEnv("AUTH_URL", "http://localhost:3000");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/calendar.events openid",
        token_type: "Bearer",
      }),
    });

    const state = "valid-state";
    const req = makeRequest({ code: "auth-code", state }, state);
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("calendar=connected");

    // Verify tokens stored on account
    const account = await Account.findOne({
      userId: user._id,
      provider: "google",
    });
    expect(account?.access_token).toBe("new-access-token");
    expect(account?.refresh_token).toBe("new-refresh-token");

    // Verify CalendarSync created
    const sync = await CalendarSync.findOne({ userId: user._id });
    expect(sync).not.toBeNull();
    expect(sync?.enabled).toBe(true);

    vi.unstubAllEnvs();
  });
});
