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
    // Clear both the API cache and the authenticated page/RSC cache so a
    // different user on a shared device can't see the previous user's pages.
    await Promise.all([
      caches.delete("pillar-api-v1"),
      caches.delete("pillar-pages-v1"),
    ]);
  }
}
