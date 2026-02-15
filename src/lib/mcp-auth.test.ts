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
import {
  setupTestDB,
  teardownTestDB,
  createTestUser,
} from "@/test/helpers";
import { AccessToken } from "@/models/access-token";
import { generateToken, hashToken, validateBearerToken } from "./mcp-auth";

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

describe("mcp-auth", () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await AccessToken.deleteMany({});
  });

  describe("generateToken", () => {
    it("produces plt_ prefix + 64 hex chars", () => {
      const token = generateToken();
      expect(token).toMatch(/^plt_[0-9a-f]{64}$/);
    });

    it("produces unique tokens", () => {
      const a = generateToken();
      const b = generateToken();
      expect(a).not.toBe(b);
    });
  });

  describe("hashToken", () => {
    it("produces consistent SHA-256 output", () => {
      const token = "plt_abc123";
      const h1 = hashToken(token);
      const h2 = hashToken(token);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces different hashes for different tokens", () => {
      expect(hashToken("plt_aaa")).not.toBe(hashToken("plt_bbb"));
    });
  });

  describe("validateBearerToken", () => {
    beforeAll(async () => {
      const user = await createTestUser();
      userId = user._id;
    });

    it("returns null for null header", async () => {
      expect(await validateBearerToken(null)).toBeNull();
    });

    it("returns null for missing Bearer prefix", async () => {
      expect(await validateBearerToken("Token abc123")).toBeNull();
    });

    it("returns null for non-plt_ token", async () => {
      expect(await validateBearerToken("Bearer sk_abc123")).toBeNull();
    });

    it("returns null for non-existent token hash", async () => {
      const raw = generateToken();
      expect(await validateBearerToken(`Bearer ${raw}`)).toBeNull();
    });

    it("returns userId for valid token", async () => {
      const raw = generateToken();
      await AccessToken.create({
        userId,
        name: "Test",
        tokenHash: hashToken(raw),
        tokenPrefix: raw.slice(0, 8),
      });

      const result = await validateBearerToken(`Bearer ${raw}`);
      expect(result).toBe(userId.toString());
    });

    it("returns null for expired token", async () => {
      const raw = generateToken();
      await AccessToken.create({
        userId,
        name: "Expired",
        tokenHash: hashToken(raw),
        tokenPrefix: raw.slice(0, 8),
        expiresAt: new Date("2020-01-01"),
      });

      expect(await validateBearerToken(`Bearer ${raw}`)).toBeNull();
    });

    it("updates lastUsedAt on successful validation", async () => {
      const raw = generateToken();
      const hash = hashToken(raw);
      await AccessToken.create({
        userId,
        name: "Test",
        tokenHash: hash,
        tokenPrefix: raw.slice(0, 8),
      });

      const before = await AccessToken.findOne({ tokenHash: hash });
      expect(before!.lastUsedAt).toBeNull();

      await validateBearerToken(`Bearer ${raw}`);

      const after = await AccessToken.findOne({ tokenHash: hash });
      expect(after!.lastUsedAt).not.toBeNull();
    });
  });
});
