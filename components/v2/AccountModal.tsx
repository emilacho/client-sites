"use client"
/**
 * AccountModal · R96.113 · cuadro pequeño semitranslúcido (~360px)
 * que se monta sobre la isla 3D. Login = email magic link o Google.
 * Si autenticado · muestra perfil mini + link a /mi-cuenta full.
 */
import { PORCENTAJE_GANANCIA } from "@/lib/perlas"
import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mail } from "lucide-react"
import { useAccount } from "@/lib/v2/use-account"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

interface Props {
  open: boolean
  onClose: () => void
}

export default function AccountModal({ open, onClose }: Props) {
  const { account, loading, logout } = useAccount()

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(61,36,102,0.45) 0%, rgba(8,5,20,0.7) 60%, rgba(8,5,20,0.85) 100%)",
            backdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            className="relative w-full max-w-[360px] rounded-2xl border p-5 shadow-2xl"
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 12 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(15,15,25,0.78)",
              borderColor: "rgba(77,212,216,0.30)",
              backdropFilter: "blur(14px)",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>

            <h2
              className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider"
              style={{ color: SAND }}
            >
              Mi Cuenta
            </h2>

            {loading ? (
              <p className="mt-3 text-xs text-slate-400">Cargando…</p>
            ) : !account ? (
              <LoginForm onClose={onClose} />
            ) : (
              <SignedInView account={account} onLogout={logout} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function LoginForm({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [phase, setPhase] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  )
  const [error, setError] = useState<string | null>(null)

  async function sendMagicLink() {
    setPhase("sending")
    setError(null)
    try {
      const supa = getSupabaseBrowser()
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) {
        setError(error.message)
        setPhase("error")
        return
      }
      setPhase("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red")
      setPhase("error")
    }
  }

  async function signInGoogle() {
    try {
      const supa = getSupabaseBrowser()
      const redirectTo = `${window.location.origin}/auth/callback`
      const { error } = await supa.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      })
      if (error) {
        setError(error.message)
        setPhase("error")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red")
      setPhase("error")
    }
  }

  if (phase === "sent") {
    return (
      <div className="mt-3 text-sm text-slate-200">
        <p>
          Te enviamos un enlace a <strong className="text-cyan-300">{email}</strong>
          .
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Ábrelo desde tu correo para entrar.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
        >
          Cerrar
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      {/* R119 - Por que tener cuenta. Antes esta pantalla ofrecia entrar sin
          decir nunca para que servia.
          R120 - reescrito en espanol de Ecuador (tuteo, no voseo) y con la
          tasa real: 4%, bajada por Emilio el 28-ago. El numero NO se tipea
          aca, sale de lib/perlas.ts, para que no pueda contradecir a lo que
          el servidor acredita. Los tres beneficios existen y estan
          verificados: perlas, /api/customer/addresses y /api/orders/by-account. */}
      <p className="text-sm font-semibold text-slate-100">
        Crea tu cuenta y por cada pedido acumula tesoro de náufrago
      </p>
      <ul className="space-y-1.5 text-xs text-slate-300">
        <li className="flex gap-2">
          <span aria-hidden>🦪</span>
          <span>
            Ganas el{" "}
            <strong className="text-cyan-300">
              {PORCENTAJE_GANANCIA}% de cada pedido
            </strong>{" "}
            en perlas · las usas como descuento
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>📍</span>
          <span>Guarda tu dirección y pide con un solo toque</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🛶</span>
          <span>Repite cualquier pedido anterior sin volver a armarlo</span>
        </li>
      </ul>

      <p className="text-xs text-slate-400">
        Entra con tu correo o Google · sin contraseña.
      </p>

      <button
        type="button"
        onClick={signInGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
      >
        <GoogleGlyph />
        Continuar con Google
      </button>

      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
        <span className="h-px flex-1 bg-slate-700" />
        o
        <span className="h-px flex-1 bg-slate-700" />
      </div>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        disabled={phase === "sending"}
        className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={sendMagicLink}
        disabled={!email || phase === "sending"}
        className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        style={{
          background: `linear-gradient(90deg, ${PURPLE}, ${CYAN})`,
        }}
      >
        <Mail className="h-4 w-4" />
        {phase === "sending" ? "Enviando…" : "Enviar enlace por correo"}
      </button>

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}

function SignedInView({
  account,
  onLogout,
}: {
  account: NonNullable<ReturnType<typeof useAccount>["account"]>
  onLogout: () => Promise<void>
}) {
  const perlasUsd = (account.perlas * 0.01).toFixed(2)
  return (
    <div className="mt-3 space-y-3 text-slate-100">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-slate-400">
          Hola
        </p>
        <p className="font-[family-name:var(--font-bebas),sans-serif] text-lg tracking-wide">
          {account.name || account.email || "marinero"}
        </p>
      </div>

      <div
        className="rounded-xl border px-3 py-2.5"
        style={{
          borderColor: "rgba(77,212,216,0.30)",
          background: "rgba(77,212,216,0.08)",
        }}
      >
        <div className="flex items-baseline gap-1.5">
          <span aria-hidden className="text-base text-cyan-200">
            ✦
          </span>
          <span className="font-[family-name:var(--font-bebas),sans-serif] text-2xl tracking-wide tabular-nums text-cyan-100">
            {account.perlas}
          </span>
          <span className="text-xs text-cyan-200/80">
            perlas (≈${perlasUsd})
          </span>
        </div>
        {!account.whatsapp && (
          <p className="mt-1 text-[10px] text-amber-300/80">
            Agrega tu WhatsApp en tu primer pedido para empezar a ganar perlas.
          </p>
        )}
      </div>

      <Link
        href="/mi-cuenta"
        className="block w-full rounded-md border border-cyan-500/40 bg-cyan-500/5 px-3 py-2 text-center text-xs uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-500/15"
      >
        Ver detalles · Hambre · Direcciones
      </Link>

      <button
        type="button"
        onClick={onLogout}
        className="w-full rounded-md border border-slate-700 px-3 py-2 text-[11px] uppercase tracking-widest text-slate-400 hover:bg-white/5"
      >
        Cerrar sesión
      </button>
    </div>
  )
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}
