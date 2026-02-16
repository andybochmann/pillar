import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock storage-persist
vi.mock("@/lib/storage-persist", () => ({
  requestPersistentStorage: vi.fn(),
}));

import { toast } from "sonner";
import { requestPersistentStorage } from "@/lib/storage-persist";
import { SwRegistrar } from "./sw-registrar";

describe("SwRegistrar", () => {
  let originalSW: ServiceWorkerContainer;
  let mockSessionStorage: Record<string, string>;

  beforeEach(() => {
    originalSW = navigator.serviceWorker;
    vi.clearAllMocks();
    mockSessionStorage = {};

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => mockSessionStorage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        mockSessionStorage[key] = value;
      },
    );

    vi.mocked(requestPersistentStorage).mockResolvedValue("granted");
  });

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalSW,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function setupSW() {
    const readyPromise = Promise.resolve({} as ServiceWorkerRegistration);
    const registerMock = vi.fn().mockResolvedValue({});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: registerMock,
        ready: readyPromise,
      },
      writable: true,
      configurable: true,
    });

    return { registerMock };
  }

  it("renders nothing", () => {
    setupSW();
    const { container } = render(<SwRegistrar />);
    expect(container.firstChild).toBeNull();
  });

  it("registers the service worker", async () => {
    const { registerMock } = setupSW();
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("/sw.js");
    });
  });

  it("warms the SW cache with the current page after ready", async () => {
    setupSW();
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(window.location.href);
    });
  });

  it("calls requestPersistentStorage after SW is ready", async () => {
    setupSW();
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(requestPersistentStorage).toHaveBeenCalled();
    });
  });

  it("does not show toast when persistent storage is granted", async () => {
    setupSW();
    vi.mocked(requestPersistentStorage).mockResolvedValue("granted");
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(requestPersistentStorage).toHaveBeenCalled();
    });

    expect(toast.info).not.toHaveBeenCalled();
  });

  it("shows info toast when persistent storage is denied", async () => {
    setupSW();
    vi.mocked(requestPersistentStorage).mockResolvedValue("denied");
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        "Offline data may be cleared by the browser",
      );
    });
  });

  it("stores flag in sessionStorage after showing denied toast", async () => {
    setupSW();
    vi.mocked(requestPersistentStorage).mockResolvedValue("denied");
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        "pillar:persist-denied-shown",
        "1",
      );
    });
  });

  it("does not repeat denied toast if sessionStorage flag is set", async () => {
    setupSW();
    mockSessionStorage["pillar:persist-denied-shown"] = "1";
    vi.mocked(requestPersistentStorage).mockResolvedValue("denied");
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(requestPersistentStorage).toHaveBeenCalled();
    });

    expect(toast.info).not.toHaveBeenCalled();
  });

  it("does not show toast when storage is unsupported", async () => {
    setupSW();
    vi.mocked(requestPersistentStorage).mockResolvedValue("unsupported");
    render(<SwRegistrar />);

    await vi.waitFor(() => {
      expect(requestPersistentStorage).toHaveBeenCalled();
    });

    expect(toast.info).not.toHaveBeenCalled();
  });
});
