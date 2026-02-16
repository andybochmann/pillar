import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { SwRegistrar } from "./sw-registrar";

describe("SwRegistrar", () => {
  let originalSW: ServiceWorkerContainer;

  beforeEach(() => {
    originalSW = navigator.serviceWorker;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalSW,
      writable: true,
      configurable: true,
    });
  });

  it("renders nothing", () => {
    const readyPromise = Promise.resolve({} as ServiceWorkerRegistration);
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue({}),
        ready: readyPromise,
      },
      writable: true,
      configurable: true,
    });
    const { container } = render(<SwRegistrar />);
    expect(container.firstChild).toBeNull();
  });

  it("registers the service worker", async () => {
    const readyPromise = Promise.resolve({} as ServiceWorkerRegistration);
    const registerMock = vi.fn().mockResolvedValue({});

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: registerMock,
        ready: readyPromise,
      },
      writable: true,
      configurable: true,
    });

    render(<SwRegistrar />);

    // Wait for the registration promise chain to resolve
    await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("/sw.js");
    });
  });

  it("warms the SW cache with the current page after ready", async () => {
    const readyPromise = Promise.resolve({} as ServiceWorkerRegistration);
    const registerMock = vi.fn().mockResolvedValue({});
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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

    render(<SwRegistrar />);

    // Wait for the full chain: register → ready → fetch
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(window.location.href);
    });
  });
});
