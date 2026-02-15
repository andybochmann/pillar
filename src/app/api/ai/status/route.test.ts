import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const session = vi.hoisted(() => ({
  user: {
    id: "000000000000000000000000",
    name: "Test User",
    email: "test@example.com",
  },
  expires: "2099-01-01",
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/ai", () => ({
  isAIEnabled: vi.fn(() => false),
}));

import { GET } from "./route";
import { isAIEnabled } from "@/lib/ai";
import { auth } from "@/lib/auth";

describe("GET /api/ai/status", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns enabled: false when AI is not configured", async () => {
    vi.mocked(isAIEnabled).mockReturnValue(false);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ enabled: false });
  });

  it("returns enabled: true when AI is configured", async () => {
    vi.mocked(isAIEnabled).mockReturnValue(true);
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ enabled: true });
  });
});
