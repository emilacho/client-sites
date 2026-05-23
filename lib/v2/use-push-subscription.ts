"use client"
/**
 * usePushSubscription · R96.17 · Web Push API client flow.
 *
 * Estados ·
 *   unsupported  · browser no soporta Push API
 *   denied       · usuario bloqueó notifications
 *   default      · permiso no pedido todavía
 *   subscribed   · cliente subscribed + endpoint persistido server-side
 *   subscribing  · in-flight
 *   error        · algo falló
 *
 * VAPID public key viene de `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var.
 * Si missing · feature degrada graceful · state="unsupported".
 */
import { useCallback, useEffect, useState } from "react"

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

export type PushState =
  | "unknown"
  | "unsupported"
  | "denied"
  | "default"
  | "subscribed"
  | "subscribing"
  | "error"

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function usePushSubscription(orderCode: string | null): {
  state: PushState
  subscribe: () => Promise<void>
  errorMessage: string | null
} {
  const [state, setState] = useState<PushState>("unknown")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    if (!VAPID_PUBLIC_KEY) {
      setState("unsupported")
      return
    }
    if (Notification.permission === "denied") {
      setState("denied")
      return
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => {
        setState(sub ? "subscribed" : "default")
      })
      .catch(() => setState("default"))
  }, [])

  const subscribe = useCallback(async () => {
    if (typeof window === "undefined" || !orderCode) return
    if (state === "subscribed" || state === "subscribing") return
    setState("subscribing")
    setErrorMessage(null)
    try {
      const reg = await navigator.serviceWorker.register("/sw.js")
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default")
        return
      }
      const keyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast a BufferSource · TS strict mode no acepta Uint8Array
        // directo por SharedArrayBuffer concern · pero PushManager
        // acepta ambos en runtime sin issues.
        applicationServerKey: keyArray as unknown as BufferSource,
      })
      const json = subscription.toJSON()
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode,
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
          userAgent: navigator.userAgent,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.detail || data.error || "subscribe_failed")
      }
      setState("subscribed")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido")
      setState("error")
    }
  }, [orderCode, state])

  return { state, subscribe, errorMessage }
}
