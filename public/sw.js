// Náufrago Service Worker · R96.17 push handler + R96.133 PWA basics.
//
// Maneja · push notifications + notificationclick + offline fallback
// básico (cachea / + /privacidad + /mi-cuenta para que la app abra
// sin red mostrando esos shells · contenido dinámico falla con UX OK).

const CACHE_NAME = "naufrago-v1"
const OFFLINE_URLS = ["/", "/privacidad", "/mi-cuenta"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS).catch(() => {})),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      ),
    ]),
  )
})

self.addEventListener("fetch", (event) => {
  // Solo interceptar navegación GET · NO API calls ni assets dinámicos.
  if (event.request.mode !== "navigate") return
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/")),
    ),
  )
})

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Náufrago", body: event.data.text() }
  }
  const title = payload.title || "Náufrago"
  const opts = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/badge-72.png",
    image: payload.image,
    data: payload.data || {},
    tag: payload.tag || "naufrago-order",
    renotify: true,
    requireInteraction: false,
    vibrate: [120, 60, 120],
  }
  event.waitUntil(self.registration.showNotification(title, opts))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url =
    (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      // Reuse existing tab si ya hay una abierta en el mismo origin
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    }),
  )
})
