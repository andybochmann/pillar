import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// Polyfill ResizeObserver for jsdom (used by cmdk/radix)
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}
