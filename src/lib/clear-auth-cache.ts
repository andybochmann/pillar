/**
 * Clears cached API responses on logout to prevent stale data
 * from leaking across user sessions.
 */
export async function clearAuthCaches() {
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker.controller
  ) {
    navigator.serviceWorker.controller.postMessage({
      type: "CLEAR_AUTH_CACHE",
    });
  }
  if (typeof caches !== "undefined") {
    await caches.delete("pillar-api-v1");
  }
}
