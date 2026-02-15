import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
} from "@/test/helpers";
import { POST } from "./route";

// Mock connectDB — test already has an active mongodb-memory-server connection
vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

describe("POST /api/auth/register", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  function createRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("registers a new user successfully", async () => {
    const res = await POST(
      createRequest({
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("John Doe");
    expect(data.email).toBe("john@example.com");
    expect(data.id).toBeDefined();
    expect(data).not.toHaveProperty("passwordHash");
  });

  it("returns 400 for missing name", async () => {
    const res = await POST(
      createRequest({
        email: "test@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(
      createRequest({
        name: "Test",
        email: "not-an-email",
        password: "SecurePass123!",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await POST(
      createRequest({
        name: "Test",
        email: "test@example.com",
        password: "short",
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for duplicate email with generic error", async () => {
    await createTestUser({ email: "dupe@example.com" });

    const res = await POST(
      createRequest({
        name: "Another User",
        email: "dupe@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid registration data");
  });

  it("does not reveal email existence in error messages", async () => {
    // Create a user with a known email
    await createTestUser({ email: "exists@example.com" });

    // Try to register with duplicate email
    const duplicateRes = await POST(
      createRequest({
        name: "Test User",
        email: "exists@example.com",
        password: "SecurePass123!",
      }),
    );

    // Should return 400 with generic error, not revealing the email exists
    expect(duplicateRes.status).toBe(400);
    const duplicateData = await duplicateRes.json();
    expect(duplicateData.error).toBe("Invalid registration data");
    expect(duplicateData.error).not.toContain("already");
    expect(duplicateData.error).not.toContain("exists");
    expect(duplicateData.error).not.toContain("registered");
  });

  it("lowercases email on registration", async () => {
    const res = await POST(
      createRequest({
        name: "Test",
        email: "UPPER@EXAMPLE.COM",
        password: "SecurePass123!",
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.email).toBe("upper@example.com");
  });

  it("maintains timing consistency to prevent timing attacks", async () => {
    await createTestUser({ email: "existing@example.com" });

    // Measure duplicate email response time
    const start1 = Date.now();
    await POST(
      createRequest({
        name: "Test",
        email: "existing@example.com",
        password: "SecurePass123!",
      }),
    );
    const duplicateTime = Date.now() - start1;

    // Measure new user response time
    const start2 = Date.now();
    await POST(
      createRequest({
        name: "Test",
        email: "newuser@example.com",
        password: "SecurePass123!",
      }),
    );
    const newUserTime = Date.now() - start2;

    // Timing difference should be minimal (within 50ms)
    const timingDiff = Math.abs(newUserTime - duplicateTime);
    expect(timingDiff).toBeLessThan(50);
  });
});
