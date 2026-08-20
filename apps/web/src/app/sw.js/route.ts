const retirementScript = `self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("neram-static-"))
            .map((key) => caches.delete(key))
        )
      ),
      self.registration.unregister(),
    ])
  );
});`

export function GET() {
  return new Response(retirementScript, {
    headers: {
      "cache-control": "no-cache, no-store, must-revalidate",
      "content-type": "application/javascript; charset=utf-8",
    },
  })
}
