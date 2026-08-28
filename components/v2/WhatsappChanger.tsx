"use client"
/**
 * WhatsappChanger · R96.119 · permite agregar (primer set) o cambiar
 * el WhatsApp del cliente · en ambos casos con OTP step-up enviado al
 * nuevo número. Al confirmar · server mueve loyalty + orders + easy_order
 * del viejo al nuevo (si existía viejo).
 */
import { useState } from "react"
import { Pencil, Check, X } from "lucide-react"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

interface Props {
  currentWhatsapp: string | null
  onChange: () => void
}

type Phase = "idle" | "input" | "requesting" | "code" | "verifying"

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  return `+${phone.slice(0, -4).replace(/\d/g, "•")}${phone.slice(-4)}`
}

export default function WhatsappChanger({ currentWhatsapp, onChange }: Props) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [newWa, setNewWa] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function authHeader(): Promise<HeadersInit | null> {
    const supa = getSupabaseBrowser()
    const {
      data: { session },
    } = await supa.auth.getSession()
    if (!session?.access_token) return null
    return {
      "content-type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    }
  }

  async function requestCode() {
    setPhase("requesting")
    setError(null)
    try {
      const headers = await authHeader()
      if (!headers) {
        setError("Sesión expirada")
        setPhase("idle")
        return
      }
      const res = await fetch("/api/customer/change-whatsapp-request", {
        method: "POST",
        headers,
        body: JSON.stringify({ newWhatsapp: newWa }),
      })
      const data = await res.json()
      if (data?.ok) {
        setSent(true)
        setPhase("code")
        return
      }
      if (data?.error === "whatsapp_taken") {
        setError("Ese número ya está en uso por otra cuenta")
      } else if (data?.error === "same_as_current") {
        setError("Es el mismo número que ya tienes")
      } else if (data?.error === "invalid_whatsapp") {
        setError("WhatsApp inválido")
      } else {
        setError("No se pudo enviar el código")
      }
      setPhase("input")
    } catch {
      setError("Error de red")
      setPhase("input")
    }
  }

  async function confirmCode() {
    setPhase("verifying")
    setError(null)
    try {
      const headers = await authHeader()
      if (!headers) {
        setError("Sesión expirada")
        setPhase("code")
        return
      }
      const res = await fetch("/api/customer/change-whatsapp-confirm", {
        method: "POST",
        headers,
        body: JSON.stringify({ newWhatsapp: newWa, code }),
      })
      const data = await res.json()
      if (data?.ok) {
        // reset + parent refresh
        setNewWa("")
        setCode("")
        setSent(false)
        setPhase("idle")
        onChange()
        return
      }
      if (data?.reason === "wrong_code") {
        setError(`Código incorrecto · ${data.attemptsLeft ?? 0} intentos`)
      } else if (data?.reason === "expired") {
        setError("Código expirado · pedí otro")
      } else if (data?.reason === "too_many_attempts") {
        setError("Demasiados intentos · pedí otro código")
      } else if (data?.reason === "whatsapp_taken") {
        setError("Ese número ya está tomado")
      } else {
        setError("No se pudo verificar")
      }
      setPhase("code")
    } catch {
      setError("Error de red")
      setPhase("code")
    }
  }

  function cancel() {
    setNewWa("")
    setCode("")
    setSent(false)
    setError(null)
    setPhase("idle")
  }

  if (phase === "idle") {
    return (
      <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">Mi WhatsApp</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
            {currentWhatsapp ? maskPhone(currentWhatsapp) : "Sin WhatsApp asociado"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("input")}
          className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 px-2.5 py-1 text-[10px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/10"
        >
          <Pencil className="h-2.5 w-2.5" />
          {currentWhatsapp ? "Cambiar" : "Agregar"}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-3">
      <p className="text-sm font-semibold text-slate-100">
        {currentWhatsapp ? "Cambiar WhatsApp" : "Agregar WhatsApp"}
      </p>
      <input
        type="tel"
        inputMode="tel"
        value={newWa}
        onChange={(e) => setNewWa(e.target.value)}
        placeholder="ej. 0997123456"
        disabled={phase !== "input"}
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-60"
      />

      {phase === "code" && (
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="• • • •"
          autoFocus
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-center font-mono text-xl tracking-[0.5em] text-cyan-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
        />
      )}

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {sent && phase === "code" && !error && (
        <p className="text-[11px] text-cyan-400">
          Código enviado al nuevo WhatsApp · revisalo
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={cancel}
          className="flex-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          <X className="mr-1 inline-block h-3 w-3" />
          Cancelar
        </button>
        {phase === "input" || phase === "requesting" ? (
          <button
            type="button"
            onClick={requestCode}
            disabled={!newWa || phase === "requesting"}
            className="flex-1 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {phase === "requesting" ? "Enviando…" : "Enviar código"}
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmCode}
            disabled={code.length !== 4 || phase === "verifying"}
            className="flex-1 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Check className="mr-1 inline-block h-3 w-3" />
            {phase === "verifying" ? "Verificando…" : "Confirmar"}
          </button>
        )}
      </div>
    </div>
  )
}
