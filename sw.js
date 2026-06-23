/* Tempo service worker — v1
   Does two jobs today:
   1) Caches the app shell so Tempo opens offline and loads instantly.
   2) Provides the notification + (future) push hooks the app calls into.
   Bump CACHE when you ship changes so users get the new version. */
const CACHE = "tempo-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  // Navigations: network-first so updates flow, fall back to cached shell offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("./index.html")));
    return;
  }
  // Everything else: cache-first, then network (and cache it).
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});

/* Tapping a notification focuses (or opens) Tempo. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});

/* Ready for the future backend: when a push server is added, it delivers here
   and the notification fires even while Tempo is fully closed. Unused in v1. */
self.addEventListener("push", (e) => {
  let data = { title: "Tempo", body: "You have tasks due." };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title || "Tempo", {
    body: data.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: "tempo-push",
    renotify: true
  }));
});
