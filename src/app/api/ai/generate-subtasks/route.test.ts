import { describe, it, expect, vi, beforeEach } from "vitest";

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
  isAIEnabled: vi.fn(() => true),
  isAIAllowedForUser: vi.fn(() => true),
  getAIModel: vi.fn(() => "mock-model"),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  jsonSchema: vi.fn((schema: unknown) => schema),
}));

import { POST } from "./route";
import { auth } from "@/lib/auth";
import { isAIEnabled, isAIAllowedForUser } from "@/lib/ai";
import { generateObject } from "ai";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ai/generate-subtasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/generate-subtasks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(isAIEnabled).mockReturnValue(true);
    vi.mocked(isAIAllowedForUser).mockReturnValue(true);
    vi.mocked(auth).mockResolvedValue(session);
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null);
    const res = await POST(makeRequest({ title: "Test" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AI is not enabled", async () => {
    vi.mocked(isAIEnabled).mockReturnValue(false);
    const res = await POST(makeRequest({ title: "Test" }));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("not configured");
  });

  it("returns 403 when user is not whitelisted", async () => {
    vi.mocked(isAIAllowedForUser).mockReturnValue(false);
    const res = await POST(makeRequest({ title: "Test" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("not available");
  });

  it("returns 400 when title is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title is empty", async () => {
    const res = await POST(makeRequest({ title: "" }));
    expect(res.status).toBe(400);
  });

  it("generates subtasks successfully", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { subtasks: ["Write tests", "Implement feature", "Deploy"] },
    } as never);

    const res = await POST(makeRequest({ title: "Build login page" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subtasks).toEqual([
      "Write tests",
      "Implement feature",
      "Deploy",
    ]);
  });

  it("passes description and priority to generation", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { subtasks: ["Step 1"] },
    } as never);

    await POST(
      makeRequest({
        title: "Build login",
        description: "OAuth based login",
        priority: "high",
      }),
    );

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("OAuth based login"),
      }),
    );
  });

  it("respects maxCount to limit generation", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { subtasks: ["Step 1", "Step 2"] },
    } as never);

    await POST(makeRequest({ title: "Task", maxCount: 2 }));

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("2"),
      }),
    );
  });

  it("includes existing subtasks in prompt to avoid duplicates", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: { subtasks: ["New step"] },
    } as never);

    await POST(
      makeRequest({
        title: "Task",
        existingSubtasks: ["Already done"],
      }),
    );

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Already done"),
      }),
    );
  });

  it("returns 500 when AI generation fails", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("API error"));

    const res = await POST(makeRequest({ title: "Test" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Failed to generate");
  });
});
