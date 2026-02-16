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

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Pillar Notification";

  const tasks = [self.registration.showNotification(title, buildNotificationOptions(data))];
  if (data.overdueCount !== undefined) {
    tasks.push(self.navigator.setAppBadge(data.overdueCount));
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, ...data } = event.data;
    self.registration.showNotification(title || "Pillar", buildNotificationOptions(data));
  }

  if (event.data?.type === "UPDATE_BADGE") {
    const count = event.data.count || 0;
    count > 0 ? self.navigator.setAppBadge(count) : self.navigator.clearAppBadge();
  }
});

// Background Sync: replay offline mutation queue
self.addEventListener("sync", (event) => {
  if (event.tag === "pillar-offline-sync") {
    event.waitUntil(replayOfflineQueue());
  }
});

async function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pillar-offline", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("mutations")) {
        db.createObjectStore("mutations", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllMutations(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutations", "readonly");
    const req = tx.objectStore("mutations").getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

async function deleteMutation(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("mutations", "readwrite");
    const req = tx.objectStore("mutations").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function replayOfflineQueue() {
  const db = await openOfflineDB();
  const mutations = await getAllMutations(db);

  if (mutations.length === 0) {
    db.close();
    return;
  }

  const sessionId = crypto.randomUUID();
  let hadFailure = false;

  for (const mutation of mutations) {
    const ok = await replayOneMutation(mutation, sessionId, 3, 1000);
    if (ok) {
      await deleteMutation(db, mutation.id);
    } else {
      hadFailure = true;
    }
  }

  db.close();

  const allClients = await self.clients.matchAll({ type: "window" });
  allClients.forEach((client) => client.postMessage({ type: "SYNC_COMPLETE" }));

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
      if (mutation.body !== undefined) init.body = JSON.stringify(mutation.body);

      const res = await fetch(mutation.url, init);
      if (res.ok) return true;
      if (res.status >= 400 && res.status < 500) return false;
    } catch {
      // Network error — retry
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
  return false;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    }),
  );
});
