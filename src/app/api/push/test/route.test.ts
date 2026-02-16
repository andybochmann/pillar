import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { setupTestDB, teardownTestDB, clearTestDB } from "@/test/helpers/db";
import { createTestUser } from "@/test/helpers/factories";
import { PushSubscription } from "@/models/push-subscription";

const session = vi.hoisted(() => ({
  user: { id: "000000000000000000000000", name: "Test User", email: "test@example.com" },
  expires: "2099-01-01",
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

const mockSendPush = vi.fn().mockResolvedValue(1);

vi.mock("@/lib/web-push", () => ({
  isWebPushConfigured: vi.fn(() => true),
  sendPushToUser: (...args: unknown[]) => mockSendPush(...args),
}));

import { POST } from "./route";

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

afterEach(async () => {
  await clearTestDB();
  mockSendPush.mockClear();
});

describe("POST /api/push/test", () => {
  it("returns 401 when not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce(null);

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 404 when no push subscriptions exist", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    const res = await POST();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/No push subscriptions/);
  });

  it("sends a real push notification and returns success", async () => {
    const user = await createTestUser();
    session.user.id = user._id.toString();

    await PushSubscription.create({
      userId: user._id,
      endpoint: "https://push.example.com/sub/123",
      keys: { p256dh: "test-p256dh", auth: "test-auth" },
    });

    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.total).toBe(1);
    expect(mockSendPush).toHaveBeenCalledWith(
      user._id.toString(),
      expect.objectContaining({
        title: "Test Push Notification",
        message: expect.stringContaining("working"),
      }),
    );
  });
});
