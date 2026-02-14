import { vi } from "vitest";

interface MockSessionUser {
  id: string;
  name: string;
  email: string;
}

interface MockSession {
  user: MockSessionUser;
  expires: string;
}

const defaultUser: MockSessionUser = {
  id: "507f1f77bcf86cd799439011",
  name: "Test User",
  email: "test@example.com",
};

export function createMockSession(
  overrides: Partial<MockSessionUser> = {},
): MockSession {
  return {
    user: { ...defaultUser, ...overrides },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function mockAuthSession(
  session: MockSession | null = createMockSession(),
) {
  vi.mock("next-auth", () => ({
    default: vi.fn(),
  }));

  vi.mock("@/lib/auth", () => ({
    auth: vi.fn(() => Promise.resolve(session)),
  }));
}
