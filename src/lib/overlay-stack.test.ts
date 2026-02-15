import { describe, it, expect, vi, afterEach } from "vitest";
import {
  pushOverlay,
  removeOverlay,
  cleanupOverlay,
  getStackSize,
  _reset,
} from "./overlay-stack";

afterEach(() => {
  _reset();
  vi.restoreAllMocks();
});

describe("overlay-stack", () => {
  describe("pushOverlay", () => {
    it("adds entry to the stack and calls history.pushState", () => {
      const pushStateSpy = vi.spyOn(window.history, "pushState");
      const closeFn = vi.fn();

      pushOverlay("test-dialog", closeFn);

      expect(getStackSize()).toBe(1);
      expect(pushStateSpy).toHaveBeenCalledOnce();
      expect(pushStateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ pillarOverlay: expect.any(Number) }),
        "",
      );
    });

    it("supports multiple overlays on the stack", () => {
      pushOverlay("dialog-1", vi.fn());
      pushOverlay("dialog-2", vi.fn());

      expect(getStackSize()).toBe(2);
    });
  });

  describe("removeOverlay", () => {
    it("removes the entry from the stack and calls history.back", () => {
      const backSpy = vi.spyOn(window.history, "back");
      const closeFn = vi.fn();

      pushOverlay("test-dialog", closeFn);
      removeOverlay("test-dialog");

      expect(getStackSize()).toBe(0);
      expect(backSpy).toHaveBeenCalledOnce();
    });

    it("does nothing if the id is not in the stack", () => {
      const backSpy = vi.spyOn(window.history, "back");

      removeOverlay("non-existent");

      expect(backSpy).not.toHaveBeenCalled();
    });

    it("suppresses the next popstate event after removeOverlay", () => {
      const closeFn1 = vi.fn();
      const closeFn2 = vi.fn();

      pushOverlay("dialog-1", closeFn1);
      pushOverlay("dialog-2", closeFn2);

      // Programmatically close dialog-2 (e.g., user clicked X)
      removeOverlay("dialog-2");

      // The popstate from history.back() fires
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

      // dialog-1's close should NOT be called — the popstate was suppressed
      expect(closeFn1).not.toHaveBeenCalled();
      expect(getStackSize()).toBe(1);
    });
  });

  describe("cleanupOverlay", () => {
    it("removes from stack without calling history.back", () => {
      const backSpy = vi.spyOn(window.history, "back");
      const closeFn = vi.fn();

      pushOverlay("test-dialog", closeFn);
      cleanupOverlay("test-dialog");

      expect(getStackSize()).toBe(0);
      expect(backSpy).not.toHaveBeenCalled();
    });

    it("does nothing if the id is not in the stack", () => {
      cleanupOverlay("non-existent");
      expect(getStackSize()).toBe(0);
    });
  });

  describe("popstate handler", () => {
    it("pops the top entry and calls its close function on popstate", () => {
      const closeFn1 = vi.fn();
      const closeFn2 = vi.fn();

      pushOverlay("dialog-1", closeFn1);
      pushOverlay("dialog-2", closeFn2);

      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

      expect(closeFn2).toHaveBeenCalledOnce();
      expect(closeFn1).not.toHaveBeenCalled();
      expect(getStackSize()).toBe(1);
    });

    it("dispatches pillar:back-empty when stack is empty", () => {
      const handler = vi.fn();
      window.addEventListener("pillar:back-empty", handler);

      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

      expect(handler).toHaveBeenCalledOnce();

      window.removeEventListener("pillar:back-empty", handler);
    });

    it("handles rapid sequential closes with suppress counter", () => {
      const closeFn1 = vi.fn();
      const closeFn2 = vi.fn();
      const closeFn3 = vi.fn();

      pushOverlay("dialog-1", closeFn1);
      pushOverlay("dialog-2", closeFn2);
      pushOverlay("dialog-3", closeFn3);

      // Programmatically close dialog-3 and dialog-2 rapidly
      removeOverlay("dialog-3");
      removeOverlay("dialog-2");

      // Two popstate events fire from the two history.back() calls
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

      // Neither should trigger dialog-1's close
      expect(closeFn1).not.toHaveBeenCalled();
      expect(getStackSize()).toBe(1);
    });

    it("works correctly after suppressed popstate events", () => {
      const closeFn1 = vi.fn();
      const closeFn2 = vi.fn();

      pushOverlay("dialog-1", closeFn1);
      pushOverlay("dialog-2", closeFn2);

      // Programmatically close dialog-2
      removeOverlay("dialog-2");

      // Suppressed popstate
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      expect(closeFn1).not.toHaveBeenCalled();

      // Now a real back press (user-initiated)
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      expect(closeFn1).toHaveBeenCalledOnce();
      expect(getStackSize()).toBe(0);
    });
  });

  describe("removeOverlay for non-top entries", () => {
    it("removes a middle entry without affecting top entry", () => {
      const closeFn1 = vi.fn();
      const closeFn2 = vi.fn();
      const closeFn3 = vi.fn();

      pushOverlay("dialog-1", closeFn1);
      pushOverlay("dialog-2", closeFn2);
      pushOverlay("dialog-3", closeFn3);

      removeOverlay("dialog-2");

      expect(getStackSize()).toBe(2);

      // Popstate: first is suppressed (from removeOverlay), second closes dialog-3
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
      window.dispatchEvent(new PopStateEvent("popstate", { state: null }));

      expect(closeFn3).toHaveBeenCalledOnce();
      expect(closeFn1).not.toHaveBeenCalled();
      expect(getStackSize()).toBe(1);
    });
  });
});
