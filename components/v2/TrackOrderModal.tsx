"use client"
/**
 * TrackOrderModal · Round 96.7 · pattern Domino's "Track Order"
 * en home · permite a clientes que ya pidieron volver a buscar
 * el tracker de su pedido sin tener el link directo.
 *
 * UX ·
 *  - Input para el código (formato NF-YYYY-XXXXXX)
 *  - Validación regex client-side antes de redirect
 *  - Submit redirige a /order/{code}
 *  - Backdrop click + ESC + × cerrar
 *  - Mobile-friendly · bottom-sheet style en sm · centered en md+
 */
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

const ORDER_CODE_REGEX = /^NF-\d{4}-[A-Z0-9]{6}$/i

export interface TrackOrderModalProps {
  open: boolean
  onClose: () => void
}

export function TrackOrderModal({ open, onClose }: TrackOrderModalProps) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCode("")
    setError(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!ORDER_CODE_REGEX.test(trimmed)) {
      setError("Código inválido · debe verse como NF-2026-AB12CD")
      return
    }
    setError(null)
    onClose()
    router.push(`/order/${trimmed}`)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="track-modal-root"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Sigue tu pedido"
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
                  Sigue tu pedido
                </span>
                <h2
                  className="mt-1 font-display text-2xl font-semibold leading-tight"
                  style={{ color: "#FFFFFF" }}
                >
                  Ingresá tu código
                </h2>
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

            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Código del pedido
                </span>
                <input
                  autoFocus
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    if (error) setError(null)
                  }}
                  placeholder="NF-2026-AB12CD"
                  maxLength={14}
                  className={[
                    "w-full rounded-md border bg-slate-950 px-3 py-3 font-mono text-base tracking-[0.1em] text-slate-100 placeholder:text-slate-500",
                    error
                      ? "border-rose-500 ring-1 ring-rose-500/40"
                      : "border-slate-700 focus:border-cyan-500",
                  ].join(" ")}
                />
              </label>
              <p className="text-[11px] text-slate-500">
                Lo encontrás en la confirmación que te enviamos por WhatsApp ·
                empieza con <span className="font-mono">NF-</span>.
              </p>
              {error ? (
                <p className="text-xs text-rose-300">{error}</p>
              ) : null}
              <button
                type="submit"
                disabled={!code.trim()}
                className="w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-all disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
              >
                Buscar mi pedido
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
