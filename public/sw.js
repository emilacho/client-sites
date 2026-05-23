// Náufrago Service Worker · R96.17 · Web Push handler.
//
// Solo maneja eventos push y notificationclick · cualquier otro
// caching está delegado al Next.js framework (no PWA todavía).

self.addEventListener("install", () => {
  // Activar inmediatamente · no esperar al close de pestañas viejas
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
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
