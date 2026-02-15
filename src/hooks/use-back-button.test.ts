import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBackButton } from "./use-back-button";
import * as overlayStack from "@/lib/overlay-stack";

vi.mock("@/lib/overlay-stack", () => ({
  pushOverlay: vi.fn(),
  removeOverlay: vi.fn(),
  cleanupOverlay: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("useBackButton", () => {
  it("calls pushOverlay when open transitions false -> true", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: false } },
    );

    rerender({ open: true });

    expect(overlayStack.pushOverlay).toHaveBeenCalledOnce();
    expect(overlayStack.pushOverlay).toHaveBeenCalledWith(
      "test-dialog",
      expect.any(Function),
    );
  });

  it("calls removeOverlay when open transitions true -> false programmatically", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: true } },
    );

    rerender({ open: false });

    expect(overlayStack.removeOverlay).toHaveBeenCalledOnce();
    expect(overlayStack.removeOverlay).toHaveBeenCalledWith("test-dialog");
  });

  it("does not call removeOverlay when close was initiated by popstate", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: false } },
    );

    // Open the overlay
    rerender({ open: true });

    // Simulate popstate-initiated close: the overlay-stack calls the close callback
    const pushCall = vi.mocked(overlayStack.pushOverlay).mock.calls[0];
    const closeCallback = pushCall[1];
    act(() => {
      closeCallback();
    });

    // onClose should have been called
    expect(onClose).toHaveBeenCalledOnce();

    // Now rerender with open=false (parent responds to onClose)
    rerender({ open: false });

    // removeOverlay should NOT be called since close was via popstate
    expect(overlayStack.removeOverlay).not.toHaveBeenCalled();
  });

  it("calls cleanupOverlay on unmount while open", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(
      ({ open }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: true } },
    );

    unmount();

    expect(overlayStack.cleanupOverlay).toHaveBeenCalledOnce();
    expect(overlayStack.cleanupOverlay).toHaveBeenCalledWith("test-dialog");
  });

  it("does not call cleanupOverlay on unmount while closed", () => {
    const onClose = vi.fn();
    const { unmount } = renderHook(
      ({ open }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: false } },
    );

    unmount();

    expect(overlayStack.cleanupOverlay).not.toHaveBeenCalled();
  });

  it("does nothing when open stays false", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: false } },
    );

    rerender({ open: false });

    expect(overlayStack.pushOverlay).not.toHaveBeenCalled();
    expect(overlayStack.removeOverlay).not.toHaveBeenCalled();
  });

  it("uses latest onClose callback without re-registering", () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    const { rerender } = renderHook(
      ({ open, onClose }) => useBackButton("test-dialog", open, onClose),
      { initialProps: { open: false, onClose: onClose1 } },
    );

    // Open with first callback
    rerender({ open: true, onClose: onClose1 });

    // Update callback without re-opening
    rerender({ open: true, onClose: onClose2 });

    // pushOverlay should only have been called once
    expect(overlayStack.pushOverlay).toHaveBeenCalledOnce();

    // Simulate popstate close — should call the latest callback
    const pushCall = vi.mocked(overlayStack.pushOverlay).mock.calls[0];
    const closeCallback = pushCall[1];
    act(() => {
      closeCallback();
    });

    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledOnce();
  });

  it("pushes overlay on initial render when open is true", () => {
    const onClose = vi.fn();
    renderHook(() => useBackButton("test-dialog", true, onClose));

    expect(overlayStack.pushOverlay).toHaveBeenCalledOnce();
  });
});
