// Pillar Service Worker
// Caching strategies: cache-first for static, network-first for API/pages

const PRECACHE_NAME = "pillar-precache-v1";
const API_CACHE_NAME = "pillar-api-v1";
const STATIC_CACHE_NAME = "pillar-static-v1";
const PAGE_CACHE_NAME = "pillar-pages-v1";

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install: precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  const currentCaches = new Set([
    PRECACHE_NAME,
    API_CACHE_NAME,
    STATIC_CACHE_NAME,
    PAGE_CACHE_NAME,
  ]);
  event.waitUntil(
    caches
      .keys()
      .then((names) => names.filter((name) => !currentCaches.has(name)))
      .then((toDelete) =>
        Promise.all(toDelete.map((name) => caches.delete(name))),
      )
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
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons") ||
    url.pathname.startsWith("/fonts")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  // API GET requests: network-first with cache fallback
  if (
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/auth")
  ) {
    event.respondWith(networkFirst(request, API_CACHE_NAME));
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Remaining same-origin GET requests (RSC payloads, etc.): network-first
  event.respondWith(networkFirst(request, PAGE_CACHE_NAME));
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
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match("/offline.html");
  }
}

// Create notification options with consistent defaults
function buildNotificationOptions(data) {
  return {
    body: data.message || data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: data.tag || data.notificationId || `notification-${Date.now()}`,
    data: {
      taskId: data.taskId,
      notificationId: data.notificationId,
      url: data.url || "/",
    },
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
  };
}

// Push: handle push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Pillar Notification";
  event.waitUntil(
    self.registration.showNotification(title, buildNotificationOptions(data))
  );
});

// Message from client: show OS notification via Service Worker
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, ...data } = event.data;
    self.registration.showNotification(
      title || "Pillar",
      buildNotificationOptions(data)
    );
  }
});

// Background Sync: replay offline mutation queue
self.addEventListener("sync", (event) => {
  if (event.tag === "pillar-offline-sync") {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  const DB_NAME = "pillar-offline";
  const STORE_NAME = "mutations";
  const DB_VERSION = 1;
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  // Generate a session ID for replayed requests
  const sessionId = crypto.randomUUID();

  // Open IndexedDB directly (can't import from src/ in SW)
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  // Read all queued mutations sorted by timestamp
  const mutations = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });

  if (mutations.length === 0) {
    db.close();
    return;
  }

  let hadFailure = false;

  for (const mutation of mutations) {
    const ok = await replayOneMutation(mutation, sessionId, MAX_RETRIES, BASE_DELAY_MS);
    if (ok) {
      // Delete successful entry from IndexedDB
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(mutation.id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } else {
      hadFailure = true;
    }
  }

  db.close();

  // Notify all open clients so the UI refreshes
  const allClients = await self.clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage({ type: "SYNC_COMPLETE" });
  }

  // If any failed, throw so the browser retries the sync event later
  if (hadFailure) {
    throw new Error("Some offline mutations failed to sync");
  }
}

async function replayOneMutation(mutation, sessionId, maxRetries, baseDelay) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const init = {
        method: mutation.method,
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": sessionId,
        },
      };
      if (mutation.body !== undefined) {
        init.body = JSON.stringify(mutation.body);
      }

      const res = await fetch(mutation.url, init);
      if (res.ok) return true;
      // Client errors (4xx) are permanent — skip retries
      if (res.status >= 400 && res.status < 500) return false;
    } catch {
      // Network error — retry
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  return false;
}

// Notification click: navigate to task or notification center
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window and navigate it to the target URL
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if no existing Pillar window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    }),
  );
});
