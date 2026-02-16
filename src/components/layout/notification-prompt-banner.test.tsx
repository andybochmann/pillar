import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationPromptBanner } from "./notification-prompt-banner";

const DISMISS_KEY = "pillar:notification-prompt-dismissed";
const DELAY = 2500;

// --- Mocks ---

const mockRequestPermission = vi.fn<() => Promise<NotificationPermission>>();
const mockSubscribe = vi.fn<() => Promise<boolean>>();

let mockPermission: NotificationPermission = "default";

vi.mock("@/hooks/use-notification-permission", () => ({
  useNotificationPermission: () => ({
    permission: mockPermission,
    requestPermission: mockRequestPermission,
    isSupported: true,
  }),
}));

vi.mock("@/hooks/use-push-subscription", () => ({
  usePushSubscription: () => ({
    subscribe: mockSubscribe,
    unsubscribe: vi.fn(),
    loading: false,
    error: null,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// We need toast reference for assertions
import { toast } from "sonner";

// --- Helpers ---

function setupNotificationAPI(permission: NotificationPermission = "default") {
  Object.defineProperty(globalThis, "Notification", {
    value: { permission },
    writable: true,
    configurable: true,
  });
}

function removeNotificationAPI() {
  // @ts-expect-error -- Removing for test
  delete globalThis.Notification;
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({}) },
      writable: true,
      configurable: true,
    });
  }
}

function removeServiceWorker() {
  // Must delete so `"serviceWorker" in navigator` returns false
  // @ts-expect-error -- Removing for test
  delete navigator.serviceWorker;
  // In case delete fails in jsdom, override with a getter that hides it
  if ("serviceWorker" in navigator) {
    Object.defineProperty(navigator, "serviceWorker", {
      get() {
        return undefined;
      },
      configurable: true,
    });
  }
}

// --- Tests ---

describe("NotificationPromptBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockPermission = "default";
    mockRequestPermission.mockResolvedValue("default");
    mockSubscribe.mockResolvedValue(true);
    setupNotificationAPI("default");
    setupServiceWorker();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders nothing when Notification API is unsupported", async () => {
    removeNotificationAPI();
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing when service worker is unavailable", async () => {
    removeServiceWorker();
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing when permission is already granted", async () => {
    setupNotificationAPI("granted");
    mockPermission = "granted";
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing when permission is already denied", async () => {
    setupNotificationAPI("denied");
    mockPermission = "denied";
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing when previously dismissed via localStorage", async () => {
    localStorage.setItem(DISMISS_KEY, "true");
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not render before the delay elapses", () => {
    render(<NotificationPromptBanner />);
    // Just before the delay
    act(() => {
      vi.advanceTimersByTime(DELAY - 100);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders banner after delay when all conditions are met", async () => {
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText(/enable notifications/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enable/i }),
    ).toBeInTheDocument();
  });

  it("Enable click → granted → subscribes → updates prefs → success toast → hides", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockRequestPermission.mockImplementation(async () => {
      mockPermission = "granted";
      setupNotificationAPI("granted");
      return "granted";
    });
    mockSubscribe.mockResolvedValue(true);

    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    await user.click(screen.getByRole("button", { name: /^enable$/i }));

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/notifications/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ enableBrowserPush: true }),
      }),
    );
    expect(toast.success).toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("Enable click → denied → info toast → hides", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockRequestPermission.mockImplementation(async () => {
      mockPermission = "denied";
      setupNotificationAPI("denied");
      return "denied";
    });

    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    await user.click(screen.getByRole("button", { name: /^enable$/i }));

    expect(toast.info).toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("Enable click → default (user closed prompt) → banner remains", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockRequestPermission.mockResolvedValue("default");

    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    await user.click(screen.getByRole("button", { name: /^enable$/i }));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("Dismiss button saves to localStorage and hides banner", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    await user.click(
      screen.getByRole("button", { name: /dismiss notification prompt/i }),
    );

    expect(localStorage.getItem(DISMISS_KEY)).toBe("true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows loading state while enabling", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // Make requestPermission hang so we can observe loading state
    let resolvePermission!: (v: NotificationPermission) => void;
    mockRequestPermission.mockImplementation(
      () =>
        new Promise<NotificationPermission>((resolve) => {
          resolvePermission = resolve;
        }),
    );

    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    // Click enable — should show loading
    await user.click(screen.getByRole("button", { name: /^enable$/i }));

    expect(screen.getByText(/enabling/i)).toBeInTheDocument();

    // Resolve to clean up
    await act(async () => {
      resolvePermission("default");
    });
  });

  it("has role=status and aria-live=polite for accessibility", async () => {
    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("shows error toast when subscribe fails after grant", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockRequestPermission.mockImplementation(async () => {
      mockPermission = "granted";
      setupNotificationAPI("granted");
      return "granted";
    });
    mockSubscribe.mockResolvedValue(false);

    render(<NotificationPromptBanner />);
    await act(() => vi.advanceTimersByTimeAsync(DELAY + 100));

    await user.click(screen.getByRole("button", { name: /^enable$/i }));

    expect(toast.error).toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
