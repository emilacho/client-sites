"use client"
/**
 * /mi-cuenta · R96.112 · Fase A · página full-page de cuenta del cliente.
 *
 * Sin sesión → form WhatsApp + OTP (4-digit) → backend setea cookie firmada.
 * Con sesión → muestra header con saldo perlas + sections básicas (Hambre
 * de Náufrago · direcciones · preferencias · logout). Las sub-secciones
 * (historial pedidos · editor direcciones · etc) llegarán en Fase C+.
 */
import { useEffect, useState } from "react"
import Link from "next/link"
import { useAccount } from "@/lib/v2/use-account"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

export default function MiCuentaPage() {
  const { account, loading, refresh, logout } = useAccount()

  if (loading) {
    return (
      <main className="min-h-[100svh] bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-slate-400">
          Cargando…
        </div>
      </main>
    )
  }

  if (!account) {
    return (
      <main className="min-h-[100svh] bg-slate-950 text-slate-100">
        <Header />
        <LoginForm onSuccess={refresh} />
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] bg-slate-950 text-slate-100">
      <Header />
      <ProfileView account={account} onLogout={logout} />
    </main>
  )
}

function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider"
          style={{ color: SAND }}
        >
          NÁUFRAGO
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
          Mi Cuenta
        </span>
      </div>
    </header>
  )
}

function LoginForm({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [whatsapp, setWhatsapp] = useState("")
  const [code, setCode] = useState("")
  const [phase, setPhase] = useState<"phone" | "code" | "submitting">("phone")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem("naufrago_customer_whatsapp")
      if (cached) setWhatsapp(cached)
    } catch {
      // ignore
    }
  }, [])

  async function requestCode() {
    setError(null)
    setPhase("submitting")
    try {
      const res = await fetch("/api/account/login-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError(
          data.error === "invalid_whatsapp"
            ? "WhatsApp inválido · revisá el número"
            : "No se pudo enviar el código",
        )
        setPhase("phone")
        return
      }
      setSent(true)
      setPhase("code")
    } catch {
      setError("Error de red")
      setPhase("phone")
    }
  }

  async function confirmCode() {
    setError(null)
    setPhase("submitting")
    try {
      const res = await fetch("/api/account/login-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp, code }),
      })
      const data = await res.json()
      if (!data.ok) {
        if (data.reason === "wrong_code") {
          setError(`Código incorrecto · ${data.attemptsLeft ?? 0} intentos`)
        } else if (data.reason === "expired") {
          setError("El código expiró · pedí uno nuevo")
        } else if (data.reason === "too_many_attempts") {
          setError("Demasiados intentos · pedí otro código")
        } else {
          setError("No se pudo verificar")
        }
        setPhase("code")
        return
      }
      try {
        window.localStorage.setItem("naufrago_customer_whatsapp", whatsapp)
      } catch {
        // ignore quota
      }
      await onSuccess()
    } catch {
      setError("Error de red")
      setPhase("code")
    }
  }

  return (
    <div className="mx-auto mt-8 max-w-md px-4">
      <h1
        className="font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider"
        style={{ color: SAND }}
      >
        Entrá a tu cuenta
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Te enviamos un código por WhatsApp · sin password.
      </p>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-cyan-300/80">
            WhatsApp
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="ej. 0997123456"
            disabled={phase !== "phone"}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-60"
          />
        </label>

        {phase === "code" && (
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-cyan-300/80">
              Código (4 dígitos)
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="• • • •"
              autoFocus
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] text-cyan-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
            />
          </label>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {sent && phase === "code" && !error && (
          <p className="text-xs text-cyan-400">
            Código enviado · revisá tu WhatsApp.
          </p>
        )}

        {phase === "phone" || phase === "submitting" ? (
          <button
            type="button"
            onClick={requestCode}
            disabled={!whatsapp || phase === "submitting"}
            className="w-full rounded-md px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
            style={{
              background: `linear-gradient(90deg, ${PURPLE}, ${CYAN})`,
            }}
          >
            {phase === "submitting" ? "Enviando…" : "Enviar código"}
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase("phone")
                setCode("")
                setError(null)
              }}
              className="flex-1 rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300"
            >
              Cambiar número
            </button>
            <button
              type="button"
              onClick={confirmCode}
              disabled={code.length !== 4}
              className="flex-1 rounded-md px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              style={{
                background: `linear-gradient(90deg, ${PURPLE}, ${CYAN})`,
              }}
            >
              Entrar
            </button>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <Link
          href="/"
          className="text-xs uppercase tracking-widest text-slate-500 hover:text-slate-300"
        >
          ← Volver a la home
        </Link>
      </div>
    </div>
  )
}

interface AccountProps {
  account: NonNullable<ReturnType<typeof useAccount>["account"]>
  onLogout: () => Promise<void>
}

function ProfileView({ account, onLogout }: AccountProps) {
  const perlasUsd = (account.perlas * 0.01).toFixed(2)
  const nextRewardCost = 100
  const progressPct = Math.min(
    100,
    Math.round((account.perlas / nextRewardCost) * 100),
  )
  return (
    <div className="mx-auto max-w-md px-4 pb-12 pt-6">
      {/* Saludo + balance hero */}
      <div
        className="rounded-3xl p-5 shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${PURPLE} 0%, ${CYAN}dd 100%)`,
        }}
      >
        <p className="text-xs uppercase tracking-widest opacity-80">Hola</p>
        <h1 className="mt-0.5 font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wide">
          {account.name || account.whatsapp}
        </h1>
        <div className="mt-4 flex items-baseline gap-2">
          <span aria-hidden className="text-2xl">
            ✦
          </span>
          <span className="font-[family-name:var(--font-bebas),sans-serif] text-4xl tracking-wide tabular-nums">
            {account.perlas}
          </span>
          <span className="text-sm opacity-80">perlas (≈${perlasUsd})</span>
        </div>
        {account.perlas < nextRewardCost && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full bg-white/70"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] opacity-80">
              {nextRewardCost - account.perlas} perlas para el primer reward
            </p>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatChip label="Pedidos" value={`${account.totalOrders}`} />
        <StatChip
          label="Consumo total"
          value={`$${account.totalSpendUsd.toFixed(2)}`}
        />
      </div>

      {/* Secciones placeholder · Fase C+ las llena */}
      <SectionPlaceholder
        title="Hambre de Náufrago"
        subtitle="Tu pedido favorito · 1 click para volverlo a pedir"
        cta="Pedirlo de nuevo"
        href="/"
      />
      <SectionPlaceholder
        title="Mis direcciones"
        subtitle={`${account.addresses.length} ${
          account.addresses.length === 1 ? "guardada" : "guardadas"
        }`}
        cta="Ver / editar"
        disabled
      />
      <SectionPlaceholder
        title="Mis preferencias"
        subtitle={account.preferences || "Sin notas guardadas todavía"}
        cta="Editar"
        href="/"
      />
      <SectionPlaceholder
        title="Histórico de pedidos"
        subtitle="Tus últimos pedidos · pedí igual con 1 click"
        cta="Ver pedidos"
        disabled
      />

      {/* Footer · logout + WhatsApp masked */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {maskPhone(account.whatsapp)}
        </span>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-800"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <span className="block text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <span className="mt-0.5 block font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wide text-cyan-200 tabular-nums">
        {value}
      </span>
    </div>
  )
}

function SectionPlaceholder({
  title,
  subtitle,
  cta,
  href,
  disabled,
}: {
  title: string
  subtitle: string
  cta: string
  href?: string
  disabled?: boolean
}) {
  const inner = (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
      </div>
      <span
        className={`shrink-0 rounded-full border px-3 py-1 text-[10px] uppercase tracking-widest ${
          disabled
            ? "border-slate-700 text-slate-500"
            : "border-cyan-500/50 text-cyan-300"
        }`}
      >
        {disabled ? "Pronto" : cta}
      </span>
    </div>
  )
  if (disabled || !href) return inner
  return <Link href={href}>{inner}</Link>
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone
  return `+${phone.slice(0, -4).replace(/\d/g, "•")}${phone.slice(-4)}`
}
