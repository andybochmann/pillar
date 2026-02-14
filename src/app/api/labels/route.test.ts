import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  createTestLabel,
} from "@/test/helpers";
import { GET, POST } from "./route";

const session = vi.hoisted(() => ({
  user: {
    id: "507f1f77bcf86cd799439011",
    name: "Test User",
    email: "test@example.com",
  },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("Labels API", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function setupUser() {
    const user = await createTestUser({ email: "label@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  describe("GET /api/labels", () => {
    it("returns user labels sorted by name", async () => {
      await setupUser();
      await createTestLabel({ userId, name: "Feature", color: "#3b82f6" });
      await createTestLabel({ userId, name: "Bug", color: "#ef4444" });

      const res = await GET(
        new NextRequest("http://localhost:3000/api/labels"),
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Bug");
      expect(data[1].name).toBe("Feature");
    });

    it("returns 401 for unauthenticated request", async () => {
      const { auth } = await import("@/lib/auth");
      vi.mocked(auth).mockResolvedValueOnce(null);

      const res = await GET(
        new NextRequest("http://localhost:3000/api/labels"),
      );
      expect(res.status).toBe(401);
    });

    it("only returns labels for the authenticated user", async () => {
      await setupUser();
      await createTestLabel({ userId, name: "Bug" });

      const otherUser = await createTestUser({ email: "other@example.com" });
      await createTestLabel({
        userId: otherUser._id as mongoose.Types.ObjectId,
        name: "Other Label",
      });

      const res = await GET(
        new NextRequest("http://localhost:3000/api/labels"),
      );
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe("Bug");
    });
  });

  describe("POST /api/labels", () => {
    function createRequest(body: Record<string, unknown>) {
      return new NextRequest("http://localhost:3000/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("creates a label", async () => {
      await setupUser();
      const res = await POST(createRequest({ name: "Bug", color: "#ef4444" }));
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe("Bug");
      expect(data.color).toBe("#ef4444");
    });

    it("returns 400 for missing name", async () => {
      await setupUser();
      const res = await POST(createRequest({ color: "#ef4444" }));
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid color", async () => {
      await setupUser();
      const res = await POST(
        createRequest({ name: "Bug", color: "not-a-color" }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate name", async () => {
      await setupUser();
      await createTestLabel({ userId, name: "Bug" });

      const res = await POST(createRequest({ name: "Bug", color: "#3b82f6" }));
      expect(res.status).toBe(409);
    });
  });
});
