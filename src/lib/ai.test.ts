import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockOpenAIProvider = vi.hoisted(() => vi.fn(() => "openai-model-instance"));
const mockCreateOpenAI = vi.hoisted(() => vi.fn(() => mockOpenAIProvider));
const mockGoogleProvider = vi.hoisted(() => vi.fn(() => "google-model-instance"));
const mockCreateGoogle = vi.hoisted(() => vi.fn(() => mockGoogleProvider));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mockCreateOpenAI,
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mockCreateGoogle,
}));

describe("ai", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockCreateOpenAI.mockClear();
    mockOpenAIProvider.mockClear();
    mockCreateGoogle.mockClear();
    mockGoogleProvider.mockClear();
    delete process.env.AI_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("isAIEnabled", () => {
    it("returns false when AI_API_KEY is not set", async () => {
      const { isAIEnabled } = await import("./ai");
      expect(isAIEnabled()).toBe(false);
    });

    it("returns true when AI_API_KEY is set", async () => {
      process.env.AI_API_KEY = "test-key";
      const { isAIEnabled } = await import("./ai");
      expect(isAIEnabled()).toBe(true);
    });

    it("returns false when AI_API_KEY is empty string", async () => {
      process.env.AI_API_KEY = "";
      const { isAIEnabled } = await import("./ai");
      expect(isAIEnabled()).toBe(false);
    });
  });

  describe("getAIModel", () => {
    it("creates openai provider by default", async () => {
      process.env.AI_API_KEY = "test-key";
      const { getAIModel } = await import("./ai");

      getAIModel();

      expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: "test-key" });
    });

    it("uses gpt-4.1-mini as default openai model", async () => {
      process.env.AI_API_KEY = "test-key";
      const { getAIModel } = await import("./ai");

      getAIModel();

      expect(mockOpenAIProvider).toHaveBeenCalledWith("gpt-4.1-mini");
    });

    it("creates google provider when AI_PROVIDER is google", async () => {
      process.env.AI_API_KEY = "test-key";
      process.env.AI_PROVIDER = "google";
      const { getAIModel } = await import("./ai");

      getAIModel();

      expect(mockCreateGoogle).toHaveBeenCalledWith({ apiKey: "test-key" });
    });

    it("uses gemini-2.0-flash as default google model", async () => {
      process.env.AI_API_KEY = "test-key";
      process.env.AI_PROVIDER = "google";
      const { getAIModel } = await import("./ai");

      getAIModel();

      expect(mockGoogleProvider).toHaveBeenCalledWith("gemini-2.0-flash");
    });

    it("uses AI_MODEL override when set", async () => {
      process.env.AI_API_KEY = "test-key";
      process.env.AI_MODEL = "gpt-4o";
      const { getAIModel } = await import("./ai");

      getAIModel();

      expect(mockOpenAIProvider).toHaveBeenCalledWith("gpt-4o");
    });

    it("throws when AI_API_KEY is not set", async () => {
      const { getAIModel } = await import("./ai");
      expect(() => getAIModel()).toThrow("AI_API_KEY is not configured");
    });
  });

  describe("isAIAllowedForUser", () => {
    it("returns true for any email when AI_ALLOWED_EMAILS is not set", async () => {
      delete process.env.AI_ALLOWED_EMAILS;
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("anyone@example.com")).toBe(true);
    });

    it("returns true when AI_ALLOWED_EMAILS is empty string", async () => {
      process.env.AI_ALLOWED_EMAILS = "";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("anyone@example.com")).toBe(true);
    });

    it("returns false when email is null and whitelist is set", async () => {
      process.env.AI_ALLOWED_EMAILS = "allowed@example.com";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser(null)).toBe(false);
    });

    it("returns false when email is undefined and whitelist is set", async () => {
      process.env.AI_ALLOWED_EMAILS = "allowed@example.com";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser(undefined)).toBe(false);
    });

    it("returns true when email matches whitelist", async () => {
      process.env.AI_ALLOWED_EMAILS = "allowed@example.com";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("allowed@example.com")).toBe(true);
    });

    it("returns false when email does not match whitelist", async () => {
      process.env.AI_ALLOWED_EMAILS = "allowed@example.com";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("other@example.com")).toBe(false);
    });

    it("is case insensitive", async () => {
      process.env.AI_ALLOWED_EMAILS = "Allowed@Example.COM";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("allowed@example.com")).toBe(true);
    });

    it("handles whitespace around emails", async () => {
      process.env.AI_ALLOWED_EMAILS = " allowed@example.com , other@test.com ";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("allowed@example.com")).toBe(true);
      expect(isAIAllowedForUser("other@test.com")).toBe(true);
    });

    it("supports multiple emails in whitelist", async () => {
      process.env.AI_ALLOWED_EMAILS = "a@test.com,b@test.com,c@test.com";
      const { isAIAllowedForUser } = await import("./ai");
      expect(isAIAllowedForUser("b@test.com")).toBe(true);
      expect(isAIAllowedForUser("d@test.com")).toBe(false);
    });
  });
});
