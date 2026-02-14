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
  createTestCategory,
} from "@/test/helpers";
import { GET, PATCH, DELETE } from "./route";

const session = vi.hoisted(() => ({
  user: { id: "507f1f77bcf86cd799439011", name: "Test User", email: "test@example.com" },
  expires: new Date(Date.now() + 86400000).toISOString(),
}));

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(session)),
}));

describe("Categories [id] API", () => {
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
    const user = await createTestUser({ email: "catid@example.com" });
    userId = user._id as mongoose.Types.ObjectId;
    session.user.id = userId.toString();
  }

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("GET returns a category by id", async () => {
    await setupUser();
    const cat = await createTestCategory({ userId, name: "Work" });

    const res = await GET(
      new NextRequest(`http://localhost:3000/api/categories/${cat._id}`),
      makeParams(cat._id.toString()),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Work");
  });

  it("GET returns 404 for nonexistent category", async () => {
    await setupUser();
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await GET(
      new NextRequest(`http://localhost:3000/api/categories/${fakeId}`),
      makeParams(fakeId),
    );
    expect(res.status).toBe(404);
  });

  it("PATCH updates a category", async () => {
    await setupUser();
    const cat = await createTestCategory({ userId, name: "Old" });

    const res = await PATCH(
      new NextRequest(`http://localhost:3000/api/categories/${cat._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      }),
      makeParams(cat._id.toString()),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("New");
  });

  it("DELETE removes a category", async () => {
    await setupUser();
    const cat = await createTestCategory({ userId, name: "ToDelete" });

    const res = await DELETE(
      new NextRequest(`http://localhost:3000/api/categories/${cat._id}`, {
        method: "DELETE",
      }),
      makeParams(cat._id.toString()),
    );
    expect(res.status).toBe(200);

    // Verify it's gone
    const getRes = await GET(
      new NextRequest(`http://localhost:3000/api/categories/${cat._id}`),
      makeParams(cat._id.toString()),
    );
    expect(getRes.status).toBe(404);
  });
});
