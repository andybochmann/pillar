import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import {
  setupTestDB,
  teardownTestDB,
  clearTestDB,
  createTestUser,
  createTestAccount,
} from "@/test/helpers";
import { User } from "@/models/user";
import { Account } from "@/models/account";
import { handleOAuthSignIn } from "@/lib/oauth-linking";

vi.mock("@/lib/db", () => ({
  connectDB: vi.fn().mockResolvedValue(undefined),
}));

describe("handleOAuthSignIn", () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  it("returns null when email is missing", async () => {
    const result = await handleOAuthSignIn(
      { email: null, name: "Test", image: null },
      { provider: "google", providerAccountId: "123" },
    );
    expect(result).toBeNull();
  });

  it("rejects unverified Google email", async () => {
    const result = await handleOAuthSignIn(
      { email: "test@gmail.com", name: "Test", image: null, email_verified: false },
      { provider: "google", providerAccountId: "123" },
    );
    expect(result).toBeNull();
  });

  it("creates new user and account for first-time OAuth login", async () => {
    const result = await handleOAuthSignIn(
      { email: "new@example.com", name: "New User", image: "https://example.com/pic.jpg", email_verified: true },
      { provider: "google", providerAccountId: "google-new" },
    );

    expect(result).not.toBeNull();

    const user = await User.findById(result);
    expect(user?.name).toBe("New User");
    expect(user?.email).toBe("new@example.com");
    expect(user?.image).toBe("https://example.com/pic.jpg");
    expect(user?.passwordHash).toBeUndefined();

    const account = await Account.findOne({ userId: user?._id, provider: "google" });
    expect(account?.providerAccountId).toBe("google-new");
  });

  it("uses email prefix as name when name is missing", async () => {
    const result = await handleOAuthSignIn(
      { email: "noname@example.com", name: null, image: null, email_verified: true },
      { provider: "google", providerAccountId: "google-noname" },
    );

    const user = await User.findById(result);
    expect(user?.name).toBe("noname");
  });

  it("links OAuth to existing user found by email", async () => {
    const existingUser = await createTestUser({ email: "existing@example.com" });

    const result = await handleOAuthSignIn(
      { email: "existing@example.com", name: "Existing", image: null, email_verified: true },
      { provider: "google", providerAccountId: "google-existing" },
    );

    expect(result).toBe(existingUser._id.toString());

    const account = await Account.findOne({ userId: existingUser._id, provider: "google" });
    expect(account).not.toBeNull();
  });

  it("returns existing user when Account link already exists", async () => {
    const user = await createTestUser({ email: "linked@example.com" });
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-linked",
    });

    const result = await handleOAuthSignIn(
      { email: "linked@example.com", name: "Linked", image: null, email_verified: true },
      { provider: "google", providerAccountId: "google-linked" },
    );

    expect(result).toBe(user._id.toString());

    const accounts = await Account.countDocuments({ userId: user._id, provider: "google" });
    expect(accounts).toBe(1);
  });

  it("updates user image from OAuth if missing", async () => {
    const user = await createTestUser({ email: "nopic@example.com" });

    await handleOAuthSignIn(
      { email: "nopic@example.com", name: "No Pic", image: "https://example.com/avatar.jpg", email_verified: true },
      { provider: "google", providerAccountId: "google-nopic" },
    );

    const updated = await User.findById(user._id);
    expect(updated?.image).toBe("https://example.com/avatar.jpg");
  });

  it("does not overwrite existing user image", async () => {
    const user = await createTestUser({ email: "haspic@example.com", image: "https://existing.com/pic.jpg" });

    await handleOAuthSignIn(
      { email: "haspic@example.com", name: "Has Pic", image: "https://new.com/pic.jpg", email_verified: true },
      { provider: "google", providerAccountId: "google-haspic" },
    );

    const updated = await User.findById(user._id);
    expect(updated?.image).toBe("https://existing.com/pic.jpg");
  });

  it("updates image on returning OAuth user if missing", async () => {
    const user = await createTestUser({ email: "returning@example.com" });
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-returning",
    });

    await handleOAuthSignIn(
      { email: "returning@example.com", name: "Returning", image: "https://example.com/new.jpg", email_verified: true },
      { provider: "google", providerAccountId: "google-returning" },
    );

    const updated = await User.findById(user._id);
    expect(updated?.image).toBe("https://example.com/new.jpg");
  });

  it("returns null when account link exists but user is deleted", async () => {
    const user = await createTestUser({ email: "deleted@example.com" });
    await createTestAccount({
      userId: user._id,
      provider: "google",
      providerAccountId: "google-deleted",
    });
    await User.findByIdAndDelete(user._id);

    const result = await handleOAuthSignIn(
      { email: "deleted@example.com", name: "Deleted", image: null, email_verified: true },
      { provider: "google", providerAccountId: "google-deleted" },
    );

    expect(result).toBeNull();
  });
});
