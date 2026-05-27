"use client"
/**
 * VoiceOrderModal · R97.1 · Fase 1 · Voice AI + Kushki Hybrid
 *
 * UX flow ·
 *  1) Cliente click botón "Llamame" (letrero madera estilo MENU)
 *  2) Modal abre · campos nombre + WhatsApp · auto-rellenados desde
 *     useAccount() si está logueado · editables · botón borrar (×)
 *     por campo para limpiar manualmente.
 *  3) Submit → POST /api/voice-order/initiate → Vapi llama al cliente.
 *  4) Success state · "Te llamamos en segundos al +593..." + auto-close
 *     después de 4s (cliente debería contestar de inmediato).
 *
 * Pre-fill comportamiento ·
 *  - Si account.name existe · pre-rellena · hint "Tomado de tu cuenta"
 *  - Si account.whatsapp existe · pre-rellena · hint "Tomado de tu cuenta"
 *  - Click × dentro del input limpia ese campo (cliente puede ingresar
 *    otros datos si pide para un amigo · o cambió de número)
 *  - No logueado · campos vacíos · placeholders normales
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Phone, Loader2 } from "lucide-react"
import { useAccount } from "@/lib/v2/use-account"
import { track } from "@/lib/v2/posthog-track"

export interface VoiceOrderModalProps {
  open: boolean
  onClose: () => void
}

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string; reason?: string }
  | { kind: "error"; message: string }

export function VoiceOrderModal({ open, onClose }: VoiceOrderModalProps) {
  const { account } = useAccount()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [nameFromAccount, setNameFromAccount] = useState(false)
  const [phoneFromAccount, setPhoneFromAccount] = useState(false)
  const [state, setState] = useState<SubmitState>({ kind: "idle" })

  // Pre-fill cuando se abre el modal · respeta cambios del cliente.
  // Si el modal se abre y account ya está cargado · pre-llenamos · si el
  // cliente edita los inputs · respetamos la edición (no sobreescribimos
  // en cada render). El flag `*FromAccount` solo se setea en open=true.
  useEffect(() => {
    if (!open) return
    const acctName = account?.name ?? ""
    const acctPhone = account?.whatsapp ?? ""
    setName(acctName)
    setPhone(acctPhone)
    setNameFromAccount(Boolean(acctName))
    setPhoneFromAccount(Boolean(acctPhone))
    setState({ kind: "idle" })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.kind !== "submitting") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.name, account?.whatsapp])

  function clearName() {
    setName("")
    setNameFromAccount(false)
  }
  function clearPhone() {
    setPhone("")
    setPhoneFromAccount(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state.kind === "submitting") return
    if (name.trim().length < 2) {
      setState({ kind: "error", message: "Necesitamos tu nombre" })
      return
    }
    const digits = phone.replace(/\D/g, "")
    if (digits.length < 8) {
      setState({
        kind: "error",
        message: "WhatsApp inválido · revisá el número",
      })
      return
    }

    setState({ kind: "submitting" })
    track("voice_order_initiate_submit", {
      from_account: nameFromAccount && phoneFromAccount,
      edited_name: !nameFromAccount,
      edited_phone: !phoneFromAccount,
    })

    try {
      const res = await fetch("/api/voice-order/initiate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          authUserId: account?.authUserId ?? null,
          source: "landing_button",
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setState({
          kind: "error",
          message:
            data.error === "invalid_phone"
              ? "WhatsApp inválido · revisá el número"
              : "No pudimos coordinar la llamada · intentá de nuevo",
        })
        return
      }
      setState({
        kind: "success",
        message:
          data.message ??
          `Te llamamos en segundos · contestá cuando suene tu WhatsApp`,
        reason: data.reason,
      })
      track("voice_order_initiate_success", {
        voice_call_id: data.voiceCallId,
        reason: data.reason ?? "vapi_dialing",
      })
      // Auto-close 4s post-success · cliente debería estar contestando.
      window.setTimeout(() => {
        onClose()
      }, 4500)
    } catch {
      setState({
        kind: "error",
        message: "Sin conexión · revisá tu internet",
      })
    }
  }

  const disabled = state.kind === "submitting" || state.kind === "success"

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="voice-modal-root"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Llamame · pedido por voz"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => {
              if (state.kind !== "submitting") onClose()
            }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "8%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "8%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-10 w-full max-w-md rounded-t-3xl border border-slate-800 bg-slate-950 px-6 py-6 text-slate-100 shadow-2xl shadow-violet-500/10 md:rounded-3xl"
          >
            <header className="mb-4 flex items-start justify-between gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                  Pedido por voz
                </span>
                <h2
                  className="mt-1 font-display text-2xl font-semibold leading-tight"
                  style={{ color: "#FFFFFF" }}
                >
                  Te llamamos al toque
                </h2>
                <p className="mt-2 text-xs text-slate-400">
                  Te llama un asistente · le decís qué querés · termina por
                  WhatsApp con la ubicación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (state.kind !== "submitting") onClose()
                }}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {state.kind === "success" ? (
              <div className="space-y-3 py-2">
                <div
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: "rgba(77,212,216,0.4)",
                    background: "rgba(77,212,216,0.08)",
                  }}
                >
                  <Phone className="h-5 w-5 shrink-0 text-cyan-300" />
                  <p className="text-sm text-slate-100">{state.message}</p>
                </div>
                {state.reason === "vapi_not_configured" ? (
                  <p className="text-[11px] text-slate-500">
                    Estamos coordinando con un humano · te llamamos en minutos
                    en lugar de segundos.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Si no atendés en 30 segundos te volvemos a llamar una vez
                    más · sino te escribimos por WhatsApp.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                {/* Nombre */}
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Tu nombre
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value)
                        setNameFromAccount(false)
                        if (state.kind === "error")
                          setState({ kind: "idle" })
                      }}
                      placeholder="ej · Emilio"
                      maxLength={80}
                      disabled={disabled}
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-3 pr-9 text-base text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 disabled:opacity-60"
                    />
                    {name ? (
                      <button
                        type="button"
                        onClick={clearName}
                        aria-label="Borrar nombre"
                        disabled={disabled}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  {nameFromAccount ? (
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Tomado de tu cuenta · podés editarlo
                    </span>
                  ) : null}
                </label>

                {/* WhatsApp */}
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    WhatsApp donde te llamamos
                  </span>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        setPhoneFromAccount(false)
                        if (state.kind === "error")
                          setState({ kind: "idle" })
                      }}
                      placeholder="09XXXXXXXX"
                      maxLength={20}
                      disabled={disabled}
                      inputMode="tel"
                      className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-3 pr-9 font-mono text-base tracking-[0.05em] text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 disabled:opacity-60"
                    />
                    {phone ? (
                      <button
                        type="button"
                        onClick={clearPhone}
                        aria-label="Borrar WhatsApp"
                        disabled={disabled}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  {phoneFromAccount ? (
                    <span className="mt-1 block text-[10px] text-slate-500">
                      Tomado de tu cuenta · podés editarlo
                    </span>
                  ) : null}
                </label>

                {state.kind === "error" ? (
                  <p className="text-xs text-rose-300">{state.message}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={disabled || !name.trim() || !phone.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-all disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                >
                  {state.kind === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Coordinando llamada...
                    </>
                  ) : (
                    <>
                      <Phone className="h-4 w-4" />
                      Llamame ahora
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500">
                  Al confirmar aceptás que un asistente de voz te llame para
                  tomar el pedido · gratis · sin costo de llamada para vos.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
