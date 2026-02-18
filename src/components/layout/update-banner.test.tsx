import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UpdateBanner } from "./update-banner";

describe("UpdateBanner", () => {
  type Listener = (event: Event) => void;
  let originalSW: ServiceWorkerContainer;
  let mockController: ServiceWorker | null;
  let listeners: Map<string, Listener>;

  // jsdom's window.location.reload is non-configurable — replace the object once.
  beforeAll(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { reload: vi.fn() },
    });
  });

  beforeEach(() => {
    originalSW = navigator.serviceWorker;
    mockController = {} as ServiceWorker;
    listeners = new Map();
    vi.mocked(window.location.reload).mockReset();

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        get controller() {
          return mockController;
        },
        addEventListener: vi.fn((event: string, handler: Listener) => {
          listeners.set(event, handler);
        }),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalSW,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  function fireControllerChange() {
    listeners.get("controllerchange")?.(new Event("controllerchange"));
  }

  it("renders nothing initially", () => {
    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows banner when controllerchange fires and there was an existing controller", async () => {
    mockController = {} as ServiceWorker;
    render(<UpdateBanner />);

    await act(async () => {
      fireControllerChange();
    });

    expect(screen.getByText("A new version is available.")).toBeInTheDocument();
  });

  it("does not show banner on first SW install (no previous controller)", async () => {
    mockController = null;
    render(<UpdateBanner />);

    await act(async () => {
      fireControllerChange();
    });

    expect(screen.queryByText("A new version is available.")).not.toBeInTheDocument();
  });

  it("reloads the page when Refresh is clicked", async () => {
    mockController = {} as ServiceWorker;
    render(<UpdateBanner />);

    await act(async () => {
      fireControllerChange();
    });

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(window.location.reload).toHaveBeenCalled();
  });

  it("hides banner when dismissed", async () => {
    mockController = {} as ServiceWorker;
    render(<UpdateBanner />);

    await act(async () => {
      fireControllerChange();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss update notification" }),
    );
    expect(screen.queryByText("A new version is available.")).not.toBeInTheDocument();
  });

  it("removes the event listener on unmount", () => {
    const { unmount } = render(<UpdateBanner />);
    unmount();
    expect(navigator.serviceWorker.removeEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
    );
  });

  it("does nothing when serviceWorker is not supported", () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { container } = render(<UpdateBanner />);
    expect(container.firstChild).toBeNull();
  });
});
