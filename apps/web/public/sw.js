const CACHE = "neram-shell-v1"
const SHELL = ["/", "/dashboard", "/manifest.webmanifest", "/pwa-192.png", "/pwa-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== "GET" || url.origin !== location.origin) return

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")))
    return
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)))
})
