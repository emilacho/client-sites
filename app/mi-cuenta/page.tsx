"use client"
/**
 * /mi-cuenta · R96.113 · página full-page de detalles del cliente.
 * Si NO autenticado · redirige a / con ?login=1 (la home abre el
 * AccountModal). Si SÍ · muestra perfil completo con secciones
 * (Hambre · direcciones · preferencias · histórico).
 */
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAccount } from "@/lib/v2/use-account"
import { CartProvider } from "@/lib/v2/cart-context"
import OrderHistorySection from "@/components/v2/OrderHistorySection"
import AddressBookEditor from "@/components/v2/AddressBookEditor"
import PreferencesEditor from "@/components/v2/PreferencesEditor"
import WhatsappChanger from "@/components/v2/WhatsappChanger"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

export default function MiCuentaPage() {
  // R96.118 · envolver con CartProvider · OrderHistorySection usa useCart()
  // para "Pedí igual" · sin provider rompe la página al click "Ver detalles".
  return (
    <CartProvider>
      <MiCuentaInner />
    </CartProvider>
  )
}

function MiCuentaInner() {
  const { account, loading, logout, logoutAllDevices, refresh } = useAccount()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !account) {
      router.replace("/?login=1")
    }
  }, [loading, account, router])

  if (loading || !account) {
    return (
      <main className="min-h-[100svh] bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-slate-400">
          Cargando…
        </div>
      </main>
    )
  }

  // R96.117 · defensive · numbers pueden venir como string de Supabase
  // numeric columns · normalizar antes de operar.
  const perlasNum = Number(account.perlas) || 0
  const totalSpendNum = Number(account.totalSpendUsd) || 0
  const totalOrdersNum = Number(account.totalOrders) || 0
  const perlasUsd = (perlasNum * 0.01).toFixed(2)
  const nextRewardCost = 100
  const progressPct = Math.min(
    100,
    Math.round((perlasNum / nextRewardCost) * 100),
  )
  return (
    <main className="min-h-[100svh] bg-slate-950 text-slate-100">
      <Header />
      <div className="mx-auto max-w-md px-4 pb-12 pt-6">
        <div
          className="rounded-3xl p-5 shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${PURPLE} 0%, ${CYAN}dd 100%)`,
          }}
        >
          <p className="text-xs uppercase tracking-widest opacity-80">Hola</p>
          <h1 className="mt-0.5 font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wide">
            {account.name || account.email || account.whatsapp || "marinero"}
          </h1>
          <div className="mt-4 flex items-baseline gap-2">
            <span aria-hidden className="text-2xl">
              ✦
            </span>
            <span className="font-[family-name:var(--font-bebas),sans-serif] text-4xl tracking-wide tabular-nums">
              {perlasNum}
            </span>
            <span className="text-sm opacity-80">
              perlas (≈${perlasUsd})
            </span>
          </div>
          {perlasNum < nextRewardCost && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full bg-white/70"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] opacity-80">
                {nextRewardCost - perlasNum} perlas para el primer reward
              </p>
            </div>
          )}
          {!account.whatsapp && (
            <p className="mt-3 rounded-md bg-black/20 px-2 py-1.5 text-[11px] text-amber-200">
              Agregá tu WhatsApp en tu primer pedido para empezar a ganar perlas.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatChip label="Pedidos" value={`${totalOrdersNum}`} />
          <StatChip
            label="Consumo total"
            value={`$${totalSpendNum.toFixed(2)}`}
          />
        </div>

        <SectionPlaceholder
          title="Hambre de Náufrago"
          subtitle="Tu pedido favorito · 1 click para volverlo a pedir"
          cta="Pedirlo de nuevo"
          href="/"
        />
        <AddressBookEditor />
        <WhatsappChanger
          currentWhatsapp={account.whatsapp}
          onChange={refresh}
        />
        <PreferencesEditor
          whatsapp={account.whatsapp}
          initialValue={account.preferences}
        />
        <OrderHistorySection />

        <div className="mt-8 border-t border-slate-800 pt-4">
          <span className="block font-mono text-[10px] uppercase tracking-widest text-slate-500">
            {account.email ?? account.whatsapp ?? "—"}
          </span>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={logout}
              className="flex-1 rounded-full border border-slate-700 px-3 py-1.5 text-[11px] uppercase tracking-widest text-slate-400 hover:bg-slate-800"
            >
              Cerrar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "¿Cerrar sesión en TODOS los devices? Vas a tener que volver a entrar en cada uno.",
                  )
                ) {
                  void logoutAllDevices()
                }
              }}
              className="flex-1 rounded-full border border-rose-700/50 px-3 py-1.5 text-[11px] uppercase tracking-widest text-rose-400 hover:bg-rose-900/20"
            >
              Cerrar todos
            </button>
          </div>
        </div>
      </div>
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
