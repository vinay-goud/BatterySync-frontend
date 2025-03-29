const CACHE_NAME = "batterysync-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/signup.html",
  "/manifest.json",
  "/assets/css/styles.css",
  "/assets/css/notifications.css",
  "/assets/js/main.js",
  "/assets/js/signup.js",
  "/assets/js/login.js",
  "/assets/img/favicon.png",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/assets/audio/notification.mp3",
  "https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css",
];

// Install Service Worker & Cache Files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Service Worker & Remove Old Cache
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event (Try Cache First, then Network)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
