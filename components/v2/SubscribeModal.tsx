"use client"
/**
 * SubscribeModal · Round 96.10 · pattern Amazon/Domino's account
 * lite. Lead capture sin auth · 1 form simple para recibir
 * promociones por WhatsApp + notificaciones de seguimiento de
 * pedidos. POST a /api/subscribers/signup · UPSERT idempotent
 * por (client_slug, whatsapp_e164).
 *
 * UX ·
 *  - Nombre + WhatsApp obligatorios · Email opcional
 *  - 2 checkboxes opt-in · al menos 1 debe estar marcado
 *  - Estados · idle → submitting → success | error
 *  - Backdrop click + ESC + × cerrar
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Loader2, X } from "lucide-react"

export interface SubscribeModalProps {
  open: boolean
  onClose: () => void
}

type FlowState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; whatsapp: string }
  | { kind: "error"; message: string }

export function SubscribeModal({ open, onClose }: SubscribeModalProps) {
  const [state, setState] = useState<FlowState>({ kind: "idle" })
  const [form, setForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
    optInPromos: true,
    optInTracking: true,
  })

  useEffect(() => {
    if (!open) return
    setState({ kind: "idle" })
    setForm({
      name: "",
      whatsapp: "",
      email: "",
      optInPromos: true,
      optInTracking: true,
    })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state.kind === "submitting") return
    if (!form.optInPromos && !form.optInTracking) {
      setState({
        kind: "error",
        message: "Marcá al menos una de las opciones para continuar.",
      })
      return
    }
    setState({ kind: "submitting" })
    try {
      const res = await fetch("/api/subscribers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          whatsapp: form.whatsapp,
          email: form.email || undefined,
          optInPromos: form.optInPromos,
          optInTracking: form.optInTracking,
          source: "hero",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        const map: Record<string, string> = {
          invalid_name: "Ingresá tu nombre (2-80 caracteres).",
          invalid_whatsapp:
            "WhatsApp inválido · usá formato 0997744288 o 593997744288.",
          invalid_email: "Email inválido.",
          no_opt_in: "Marcá al menos una de las opciones.",
        }
        throw new Error(map[json.error] ?? json.error ?? "signup_failed")
      }
      setState({ kind: "success", whatsapp: json.whatsapp })
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sub-modal-root"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Registrate"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
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
                  Registrate
                </span>
                <h2 className="mt-1 font-display text-2xl font-semibold leading-tight">
                  Sumate al club Náufrago
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Promos directo al WhatsApp · seguimiento automático de
                  tus pedidos · sin spam.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {state.kind === "success" ? (
              <SuccessPanel whatsapp={state.whatsapp} onClose={onClose} />
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <input
                  required
                  placeholder="Tu nombre"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500"
                />
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  placeholder="WhatsApp · 0997744288"
                  value={form.whatsapp}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whatsapp: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500"
                />
                <input
                  type="email"
                  placeholder="Email (opcional)"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500"
                />

                <div className="space-y-2 pt-1">
                  <CheckboxRow
                    checked={form.optInPromos}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, optInPromos: v }))
                    }
                    label="Quiero recibir promociones por WhatsApp"
                  />
                  <CheckboxRow
                    checked={form.optInTracking}
                    onChange={(v) =>
                      setForm((f) => ({ ...f, optInTracking: v }))
                    }
                    label="Quiero seguimiento automático de mis pedidos"
                  />
                </div>

                {state.kind === "error" ? (
                  <p className="text-xs text-rose-300">{state.message}</p>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    state.kind === "submitting" ||
                    !form.name.trim() ||
                    !form.whatsapp.trim()
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-all disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                >
                  {state.kind === "submitting" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando…
                    </>
                  ) : (
                    "Sumarme al club"
                  )}
                </button>
                <p className="text-center text-[10px] text-slate-500">
                  No compartimos tus datos · podés salir cuando quieras
                  respondiendo BAJA al WhatsApp.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function CheckboxRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-200">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-cyan-400 bg-cyan-500/30"
            : "border-slate-600 bg-slate-900",
        ].join(" ")}
      >
        {checked ? <Check className="h-3.5 w-3.5 text-cyan-200" /> : null}
      </button>
      <span className="leading-tight">{label}</span>
    </label>
  )
}

function SuccessPanel({
  whatsapp,
  onClose,
}: {
  whatsapp: string
  onClose: () => void
}) {
  return (
    <div className="space-y-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
          <Check className="h-4 w-4" />
        </span>
        <div>
          <p className="font-semibold text-emerald-200">¡Listo!</p>
          <p className="text-xs text-slate-400">
            Te anotamos al club · te escribimos al{" "}
            <span className="font-mono">+{whatsapp}</span>.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
      >
        Cerrar
      </button>
    </div>
  )
}
