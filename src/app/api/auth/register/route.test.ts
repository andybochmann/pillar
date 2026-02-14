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

  it("returns 409 for duplicate email", async () => {
    await createTestUser({ email: "dupe@example.com" });

    const res = await POST(
      createRequest({
        name: "Another User",
        email: "dupe@example.com",
        password: "SecurePass123!",
      }),
    );

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Email already registered");
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
});
