// Pillar Service Worker
// Caching strategies: cache-first for static, network-first for API/pages

const PRECACHE_NAME = "pillar-precache-v1";
const API_CACHE_NAME = "pillar-api-v1";
const STATIC_CACHE_NAME = "pillar-static-v1";

const PRECACHE_URLS = ["/offline.html", "/manifest.json", "/icons/icon-192x192.png", "/icons/icon-512x512.png"];

// Install: precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  const currentCaches = new Set([PRECACHE_NAME, API_CACHE_NAME, STATIC_CACHE_NAME]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => names.filter((name) => !currentCaches.has(name)))
      .then((toDelete) => Promise.all(toDelete.map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Fetch: route-based caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip mutation requests — handled by app-level offline queue
  if (request.method !== "GET") return;

  // Static assets (_next/static, fonts, icons): cache-first
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname.startsWith("/fonts")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // API GET requests: network-first with cache fallback
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth")) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    // Background revalidation
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(cacheName).then((cache) => cache.put(request, response));
        }
      })
      .catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}
