"use client"
/**
 * CookieConsentBanner · R96.129 · LOPDP Ecuador cookie consent.
 * Sticky bottom-right · solo aparece si el cliente no aceptó/rechazó
 * antes (localStorage flag). Click Aceptar/Rechazar persiste el flag
 * + log al backend (/api/consent) para audit trail LOPDP art. 24.
 */
import { useEffect, useState } from "react"
import Link from "next/link"

const STORAGE_KEY = "naufrago_consent_cookies_v1"

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timeoutId: number | undefined
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY)
      if (!existing) {
        timeoutId = window.setTimeout(() => setVisible(true), 800)
      }
    } catch {
      // ignore quota / privacy mode
    }
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  async function persistConsent(accepted: boolean) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accepted, at: Date.now() }),
      )
    } catch {
      // ignore
    }
    setVisible(false)
    // Best-effort log al backend para audit LOPDP.
    void fetch("/api/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        consent_type: "cookies_analytics",
        accepted,
        url: typeof window !== "undefined" ? window.location.href : null,
      }),
      keepalive: true,
    }).catch(() => {})
  }

  if (!visible) return null

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-md rounded-2xl border border-cyan-500/40 bg-slate-950/95 px-4 py-3 shadow-2xl backdrop-blur-md md:left-auto md:right-4"
      role="dialog"
      aria-label="Consentimiento de cookies"
    >
      <p className="text-xs text-slate-200">
        Usamos cookies funcionales (sesión · carrito) y analíticas para mejorar
        la experiencia. Podés rechazarlas sin perder funcionalidad básica.
      </p>
      <p className="mt-1 text-[10px] text-slate-500">
        Más info en{" "}
        <Link
          href="/privacidad"
          className="text-cyan-300 underline hover:text-cyan-200"
        >
          Política de Privacidad
        </Link>
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => persistConsent(false)}
          className="flex-1 rounded-full border border-slate-700 px-3 py-1.5 text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-800"
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={() => persistConsent(true)}
          className="flex-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white"
        >
          Aceptar
        </button>
      </div>
    </div>
  )
}
