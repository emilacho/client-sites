"use client"
/**
 * NotificationPrefsSection · R96.144 · sección en /mi-cuenta para
 * controlar opt-in de promos por WhatsApp · LOPDP granular consent.
 * Requiere whatsapp asociado al perfil · si no · disable + CTA.
 */
import { useEffect, useState } from "react"
import { Bell } from "lucide-react"

interface Props {
  whatsapp: string | null
  name: string | null
  email: string | null
}

export default function NotificationPrefsSection({
  whatsapp,
  name,
  email,
}: Props) {
  const [optInPromos, setOptInPromos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!whatsapp) return
    setLoading(true)
    fetch(`/api/subscribers/lookup?whatsapp=${encodeURIComponent(whatsapp)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok) {
          setOptInPromos(!!data.opt_in_promos)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [whatsapp])

  async function toggle(next: boolean) {
    if (!whatsapp || saving) return
    const prev = optInPromos
    setOptInPromos(next)
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/subscribers/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name ?? "Cliente Náufrago",
          whatsapp,
          email: email || undefined,
          optInPromos: next,
          optInTracking: false,
          source: "mi_cuenta_toggle",
        }),
      })
      const data = await res.json()
      if (data?.ok) {
        setMessage(next ? "✓ Activado" : "✓ Desactivado")
        setTimeout(() => setMessage(null), 1500)
      } else {
        setOptInPromos(prev)
        setMessage("No se pudo guardar")
      }
    } catch {
      setOptInPromos(prev)
      setMessage("Error de red")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
        <Bell className="h-3.5 w-3.5 text-cyan-400" />
        Notificaciones
      </p>
      <p className="mt-1 text-[11px] text-slate-500">
        Promos por WhatsApp · podés activar/desactivar cuando quieras.
      </p>

      {!whatsapp ? (
        <p className="mt-2 text-[10px] text-amber-300">
          Agregá tu WhatsApp arriba para activar notificaciones.
        </p>
      ) : (
        <label className="mt-2 flex cursor-pointer items-center justify-between rounded-md border border-slate-700 bg-slate-950 px-3 py-2">
          <span className="text-xs text-slate-300">
            Recibir promos por WhatsApp
          </span>
          <input
            type="checkbox"
            checked={optInPromos}
            onChange={(e) => void toggle(e.target.checked)}
            disabled={loading || saving}
            className="h-4 w-4 shrink-0 accent-cyan-500"
          />
        </label>
      )}

      {message && (
        <p className="mt-1.5 text-[10px] text-emerald-400">{message}</p>
      )}
    </div>
  )
}
