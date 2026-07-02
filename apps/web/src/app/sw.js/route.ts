import { connection } from "next/server"

function serviceWorkerScript(cacheName: string) {
  return `const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ["/manifest.webmanifest", "/pwa-192.png", "/pwa-512.png", "/pwa-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("neram-static-") && key !== CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response("<!doctype html><title>Neram offline</title><main>Neram is offline.</main>", {
            headers: { "content-type": "text/html; charset=utf-8" },
            status: 503,
          })
      )
    );
    return;
  }

  if (!ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
    )
  );
});`
}

export async function GET() {
  await connection()
  const id =
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "dev"

  return new Response(serviceWorkerScript(`neram-static-${id}`), {
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/javascript; charset=utf-8",
    },
  })
}
