import { describe, it, expect, vi, beforeEach } from "vitest";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

const mockIsWebPushConfigured = vi.fn();
const mockGetVapidPublicKey = vi.fn();

vi.mock("@/lib/web-push", () => ({
  isWebPushConfigured: () => mockIsWebPushConfigured(),
  getVapidPublicKey: () => mockGetVapidPublicKey(),
}));

import { GET } from "./route";

describe("/api/push/vapid-public-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 503 when web push is not configured", async () => {
    mockIsWebPushConfigured.mockReturnValue(false);

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("not configured");
  });

  it("returns VAPID public key when configured", async () => {
    mockIsWebPushConfigured.mockReturnValue(true);
    mockGetVapidPublicKey.mockReturnValue("BPk-test-vapid-public-key");

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.publicKey).toBe("BPk-test-vapid-public-key");
  });
});
