const CACHE_NAME = "batterysync-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/assets/css/styles.css",
  "/assets/css/notifications.css",
  "/assets/js/main.js",
  "/assets/img/favicon.png",
  "https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
