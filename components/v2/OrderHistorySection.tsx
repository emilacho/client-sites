"use client"
/**
 * OrderHistorySection · R96.115 · Fase C · sección "Histórico de pedidos"
 * en /mi-cuenta. Cards verticales + status badge + "Pedí igual" CTA + load more.
 */
import Link from "next/link"
import { RotateCw } from "lucide-react"
import { useOrderHistory, type OrderHistoryItem } from "@/lib/v2/use-order-history"
import { useCart } from "@/lib/v2/cart-context"

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  COOKING: "En cocina",
  READY_FOR_PICKUP: "Listo",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
}

const STATUS_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  PENDING: { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-300" },
  CONFIRMED: { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-300" },
  COOKING: { border: "border-cyan-500/40", bg: "bg-cyan-500/10", text: "text-cyan-300" },
  READY_FOR_PICKUP: { border: "border-cyan-500/40", bg: "bg-cyan-500/10", text: "text-cyan-300" },
  OUT_FOR_DELIVERY: { border: "border-violet-500/40", bg: "bg-violet-500/10", text: "text-violet-300" },
  DELIVERED: { border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-300" },
  CANCELLED: { border: "border-rose-500/40", bg: "bg-rose-500/10", text: "text-rose-300" },
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.round(ms / 60_000)
  if (min < 1) return "ahora"
  if (min < 60) return `hace ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`
  const months = Math.round(days / 30)
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`
}

export default function OrderHistorySection() {
  const { orders, loading, loadingMore, hasMore, error, loadMore } =
    useOrderHistory()
  const cart = useCart()

  function reorder(order: OrderHistoryItem) {
    // R96.116 · cast defensive · jsonb columns pueden devolver numbers
    // como strings · Number() los normaliza · sin NaN.
    for (const line of order.cart_lines) {
      const qty = Number(line.qty) || 1
      const priceUsd = Number(line.priceUsd) || 0
      if (!line.id || !line.name) continue
      cart.add(
        {
          id: line.id,
          name: line.name,
          priceUsd,
          notes: line.notes,
          customizations: line.customizations,
        },
        qty,
      )
    }
    cart.open()
  }

  if (loading) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-5">
        <p className="text-sm text-slate-400">Cargando histórico…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
        <p className="text-xs text-rose-300">{error}</p>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-5 text-center">
        <p className="text-sm text-slate-300">Aún no tenés pedidos</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Pedí tu primer Hambre de Náufrago desde la home
        </p>
        <Link
          href="/"
          className="mt-3 inline-block rounded-full border border-cyan-500/50 px-4 py-1.5 text-[11px] uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/10"
        >
          Ir a la home
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-sm font-semibold text-slate-100">
          Histórico de pedidos
        </p>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">
          {orders.length}
          {hasMore ? "+" : ""}
        </span>
      </div>
      {orders.map((order) => (
        <OrderCard key={order.order_code} order={order} onReorder={reorder} />
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900/40 px-4 py-2.5 text-xs uppercase tracking-widest text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
        >
          {loadingMore ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </div>
  )
}

function OrderCard({
  order,
  onReorder,
}: {
  order: OrderHistoryItem
  onReorder: (order: OrderHistoryItem) => void
}) {
  const style = STATUS_STYLES[order.status] ?? STATUS_STYLES.PENDING
  const label = STATUS_LABELS[order.status] ?? order.status
  // R96.116 · defensive · cart_lines puede venir undefined / object string
  // si el orden fue creado en una versión vieja del schema. Normalizamos.
  const rawLines = order.cart_lines
  const lines: OrderHistoryItem["cart_lines"] = Array.isArray(rawLines)
    ? rawLines
    : typeof rawLines === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(rawLines)
            return Array.isArray(parsed) ? parsed : []
          } catch {
            return []
          }
        })()
      : []
  const itemCount = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const firstNames = lines
    .slice(0, 2)
    .map((l) => l.name)
    .filter(Boolean)
    .join(" · ")
  const extra = lines.length > 2 ? ` + ${lines.length - 2} más` : ""
  const canReorder = lines.length > 0

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/order/${order.order_code}`}
            className="font-mono text-[11px] text-cyan-300 hover:underline"
          >
            #{order.order_code}
          </Link>
          <span
            className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest ${style.border} ${style.bg} ${style.text}`}
          >
            {label}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-300">
          {itemCount} {itemCount === 1 ? "plato" : "platos"} · $
          {Number(order.total_usd).toFixed(2)}{" "}
          <span className="text-slate-500">· {timeAgo(order.created_at)}</span>
        </p>
        {firstNames && (
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {firstNames}
            {extra}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onReorder({ ...order, cart_lines: lines })}
        disabled={!canReorder}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white shadow-md disabled:opacity-40"
        title="Pedí igual"
      >
        <RotateCw className="h-3 w-3" />
        Pedí igual
      </button>
    </div>
  )
}
