import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requestPersistentStorage } from "./storage-persist";

describe("requestPersistentStorage", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it('returns "unsupported" when navigator.storage is undefined', async () => {
    Object.defineProperty(global, "navigator", {
      value: { storage: undefined },
      configurable: true,
    });

    expect(await requestPersistentStorage()).toBe("unsupported");
  });

  it('returns "unsupported" when navigator.storage.persist is undefined', async () => {
    Object.defineProperty(global, "navigator", {
      value: { storage: { persisted: vi.fn() } },
      configurable: true,
    });

    expect(await requestPersistentStorage()).toBe("unsupported");
  });

  it('returns "granted" when already persisted', async () => {
    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(true),
          persist: vi.fn(),
        },
      },
      configurable: true,
    });

    const result = await requestPersistentStorage();
    expect(result).toBe("granted");
    expect(navigator.storage.persist).not.toHaveBeenCalled();
  });

  it('returns "granted" when persist() succeeds', async () => {
    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(false),
          persist: vi.fn().mockResolvedValue(true),
        },
      },
      configurable: true,
    });

    expect(await requestPersistentStorage()).toBe("granted");
    expect(navigator.storage.persist).toHaveBeenCalled();
  });

  it('returns "denied" when persist() returns false', async () => {
    Object.defineProperty(global, "navigator", {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(false),
          persist: vi.fn().mockResolvedValue(false),
        },
      },
      configurable: true,
    });

    expect(await requestPersistentStorage()).toBe("denied");
  });
});
