"use client"
/**
 * CartDrawer · responsive cart surface.
 *
 *  - desktop · slide-in from the right (Radix Dialog · framer-motion)
 *  - mobile  · bottom-sheet drawer (`<md` viewport)
 *
 * Round 89 compaction · item cards reduced (10x10 thumb · p-2 · 2-row
 * layout) so 8 lines fit in 800px portrait viewport without scroll.
 *
 * Footer flow ·
 *   1. DiscountCodeRow · code input or applied chip
 *   2. Totals · Subtotal · Descuento · Envío · Total (breakdown
 *      appears as lines become non-zero)
 *   3. Action surface · 2 buttons side-by-side
 *        · "Pedir por WhatsApp" · opens wa.me
 *        · "Pedir por PedidosYa" · inline quote flow (address form ·
 *          quote · confirm) · injects Envío line in step 2 on quote
 *          ready · sustituye los botones temporalmente cuando activo
 */
import { useEffect, useState } from "react"
import { ArrowLeft, Loader2, MessageSquare, Minus, Plus, Trash2, Utensils, X } from "lucide-react"
import { CanoeIcon } from "./CanoeIcon"
import { motion, AnimatePresence } from "framer-motion"
import { useCart } from "@/lib/v2/cart-context"
import { buildWhatsAppLink, naufragoV2 } from "@/lib/v2/naufrago-content"
import { saveLastOrder } from "@/lib/v2/use-last-order"
import {
  LOYALTY_REWARDS,
  perlasToUsd,
  useLoyaltyBalance,
  type LoyaltyReward,
} from "@/lib/v2/use-loyalty-balance"

/** WhatsApp brand glyph · simpleicons.org path · pure white fill. */
function WhatsAppGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

/** PedidosYa brand mark · rounded white tile + red "P" inset.
 *  Aproximación al brand bug oficial (Pantone Red 032 C #F52F41). */
function PedidosYaGlyph() {
  return (
    <span
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-white"
      aria-hidden
    >
      <span
        className="font-display text-[13px] font-black leading-none"
        style={{ color: "#F52F41" }}
      >
        P
      </span>
    </span>
  )
}

function MenuThumb({ id, emoji }: { id: string; emoji: string }) {
  const item = naufragoV2.menu.find((m) => m.id === id)
  const gradient = item?.gradient ?? "from-slate-700 to-slate-900"
  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${gradient} text-lg shadow-inner ring-1 ring-white/20`}
      aria-hidden
    >
      {emoji}
    </div>
  )
}

type ShippingState =
  | { kind: "none" }
  | { kind: "address" }
  | { kind: "quoting" }
  | {
      kind: "quoted"
      quoteToken: string
      priceUsd: number
      etaMinutes: number
      expiresAt: string
    }
  | { kind: "ordering"; priceUsd: number; etaMinutes: number }
  | {
      kind: "success"
      orderId: string
      trackingUrl?: string
      status: string
      priceUsd: number
    }
  | { kind: "error"; message: string; previous: "address" | "quoted" }

export function CartDrawer() {
  const cart = useCart()
  const [isMobile, setIsMobile] = useState(false)
  // R96.11 · qué líneas tienen el editor de notas expandido.
  const [notesExpanded, setNotesExpanded] = useState<Set<string>>(new Set())
  const toggleNoteEditor = (id: string) =>
    setNotesExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setIsMobile(mq.matches)
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", h)
    return () => mq.removeEventListener("change", h)
  }, [])

  return (
    <AnimatePresence>
      {cart.isOpen ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={cart.close}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-label="Tu carrito"
            initial={isMobile ? { y: "100%" } : { x: "100%" }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={[
              "fixed z-50 flex flex-col bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl",
              "border-violet-500/20",
              isMobile
                ? "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t-2"
                : "inset-y-0 right-0 w-full max-w-md border-l-2",
            ].join(" ")}
          >
            {isMobile ? (
              <div className="flex justify-center pt-2 pb-1">
                <span className="h-1.5 w-12 rounded-full bg-slate-700" />
              </div>
            ) : null}

            <header className="flex items-center justify-between gap-2 border-b border-slate-800 px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <CanoeIcon className="h-6 w-6 shrink-0 text-cyan-300" />
                <h2 className="text-base font-semibold tracking-tight">Tu pedido</h2>
                {cart.itemCount > 0 ? (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-500/20 px-1.5 text-[11px] font-mono text-violet-200 tabular-nums">
                    {cart.itemCount}
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {/* R96.29 · "Seguir comprando" · dispatch CustomEvent ·
                    LandingV2 escucha y abre MenuModal · cierra cart drawer. */}
                <button
                  type="button"
                  onClick={() => {
                    cart.close()
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("naufrago:open-menu"))
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <Utensils className="h-3 w-3" />
                  Seguir comprando
                </button>
                <button
                  type="button"
                  onClick={cart.close}
                  aria-label="Cerrar carrito"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {cart.lines.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="flex flex-col gap-2">
                  {cart.lines.map((line) => {
                    const item = naufragoV2.menu.find((m) => m.id === line.id)
                    const noteOpen = notesExpanded.has(line.id) || !!line.notes
                    return (
                      <li
                        key={line.id}
                        className="flex flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 p-2"
                      >
                        <div className="flex items-center gap-2">
                          <MenuThumb id={line.id} emoji={item?.emoji ?? "🍽"} />
                          <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium leading-tight">
                                {line.name}
                                <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-500 tabular-nums">
                                  ${line.priceUsd.toFixed(2)} c/u
                                </span>
                              </span>
                              <span className="font-mono text-sm tabular-nums text-cyan-200">
                                ${(line.priceUsd * line.qty).toFixed(2)}
                              </span>
                            </div>
                            {line.customizations && line.customizations.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {line.customizations.map((c) => (
                                  <span
                                    key={c.id}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-200 ring-1 ring-violet-500/20"
                                  >
                                    {c.label}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div className="flex items-center justify-between gap-2">
                              <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950">
                                <button
                                  type="button"
                                  onClick={() => cart.setQty(line.id, line.qty - 1)}
                                  aria-label="Quitar uno"
                                  className="rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="min-w-[20px] text-center font-mono text-xs tabular-nums">
                                  {line.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => cart.setQty(line.id, line.qty + 1)}
                                  aria-label="Agregar uno"
                                  className="rounded-full p-1 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleNoteEditor(line.id)}
                                  aria-label={line.notes ? "Editar nota" : "Agregar nota"}
                                  className={[
                                    "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors",
                                    line.notes
                                      ? "bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                                  ].join(" ")}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {line.notes ? "Nota" : "+ Nota"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cart.remove(line.id)}
                                  aria-label="Eliminar producto"
                                  className="rounded-md p-1 text-rose-300/70 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        {noteOpen ? (
                          <input
                            type="text"
                            value={line.notes ?? ""}
                            onChange={(e) => cart.setNotes(line.id, e.target.value)}
                            placeholder="Notas · alergias · sin cilantro · poco picante"
                            maxLength={140}
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-cyan-500"
                          />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <CartFooter />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function CartFooter() {
  const cart = useCart()
  const [shipping, setShipping] = useState<ShippingState>({ kind: "none" })
  const [form, setForm] = useState({
    street: "",
    detail: "",
    name: "",
    phone: "",
    email: "",
    notes: "",
  })
  // R96.21 · loyalty perlas · lookup balance by form.phone debounced.
  const { balance: loyaltyBalance } = useLoyaltyBalance(form.phone)
  const [useLoyalty, setUseLoyalty] = useState(false)
  // R96.24 · multi-tier redemption · mutually exclusive con spend directo.
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null)
  // Spend directo · solo activo si useLoyalty=true Y selectedReward=null
  const directSpendActive = useLoyalty && !selectedReward
  const loyaltySpendCap = Math.floor((cart.subtotal * 0.5) / 0.01)
  const loyaltySpendPerlas =
    directSpendActive && loyaltyBalance
      ? Math.min(loyaltyBalance.perlas, loyaltySpendCap)
      : 0
  const loyaltySpendUsd = perlasToUsd(loyaltySpendPerlas)
  // Reward applied · impact en total via percentOff (free_item NO afecta
  // el total visible · queda como nota al pedido).
  const rewardPercentOffUsd =
    selectedReward?.type === "percent_off" && selectedReward.percentOff
      ? Math.round(cart.subtotal * (selectedReward.percentOff / 100) * 100) / 100
      : 0
  // free_item · no afecta total visible (el item se agrega gratis kitchen-side ·
  // no se carga al cart porque cost=0 confunde el flow del cliente · solo
  // queda como nota al pedido).

  const shippingPrice =
    shipping.kind === "quoted" ||
    shipping.kind === "ordering" ||
    shipping.kind === "success"
      ? shipping.priceUsd
      : 0
  const total =
    cart.subtotal -
    cart.discountUsd +
    shippingPrice +
    cart.tipUsd -
    loyaltySpendUsd -
    rewardPercentOffUsd
  const showBreakdown =
    cart.discountUsd > 0 ||
    shippingPrice > 0 ||
    cart.tipUsd > 0 ||
    loyaltySpendUsd > 0 ||
    selectedReward !== null
  const buttonsDisabled = cart.lines.length === 0

  async function requestQuote(e: React.FormEvent) {
    e.preventDefault()
    setShipping({ kind: "quoting" })
    try {
      const res = await fetch("/api/courier/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropoff: { street: form.street, detail: form.detail || undefined },
          lines: cart.lines.map((l) => ({
            id: l.id,
            name: l.name,
            priceUsd: l.priceUsd,
            qty: l.qty,
            notes: l.notes,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "quote_failed")
      }
      setShipping({
        kind: "quoted",
        quoteToken: json.quoteToken,
        priceUsd: json.priceUsd,
        etaMinutes: json.etaMinutes,
        expiresAt: json.expiresAt,
      })
    } catch (err) {
      setShipping({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        previous: "address",
      })
    }
  }

  async function confirmOrder() {
    if (shipping.kind !== "quoted") return
    const { quoteToken, priceUsd, etaMinutes } = shipping
    setShipping({ kind: "ordering", priceUsd, etaMinutes })
    try {
      const res = await fetch("/api/courier/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteToken,
          dropoff: { street: form.street, detail: form.detail || undefined },
          customer: {
            name: form.name,
            phone: form.phone,
            email: form.email || undefined,
          },
          lines: cart.lines.map((l) => ({
            id: l.id,
            name: l.name,
            priceUsd: l.priceUsd,
            qty: l.qty,
            notes: l.notes,
          })),
          tipUsd: cart.tipUsd > 0 ? cart.tipUsd : undefined,
          loyaltySpendPerlas:
            loyaltySpendPerlas > 0 ? loyaltySpendPerlas : undefined,
          loyaltyRewardId: selectedReward?.id,
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "order_failed")
      }
      // R96.9 · persist last order para pattern "Pedí lo mismo"
      saveLastOrder({
        orderCode: json.orderId ?? null,
        lines: cart.lines,
        totalUsd: total,
      })
      // R96.106 · save Easy Order ("Hambre de Náufrago") · cross-device.
      // Best-effort · si falla solo no persiste el perfil server-side.
      try {
        window.localStorage.setItem("naufrago_customer_whatsapp", form.phone)
      } catch {
        // ignore quota
      }
      void fetch("/api/easy-order/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp: form.phone,
          name: form.name,
          email: form.email || null,
          cart_lines: cart.lines,
          dropoff: {
            street: form.street,
            detail: form.detail || null,
            latitude: null,
            longitude: null,
            countryCode: "EC",
          },
          payment_method: "whatsapp",
          delivery_provider: "courier",
          total_usd: total,
          source_order_code: json.orderId ?? null,
        }),
        keepalive: true,
      }).catch(() => {})
      // R96.14 · WhatsApp confirmation fire-and-forget · si Twilio
      // no está configurado el endpoint degrada graceful · UI no
      // se entera del status del send.
      const trackingUrl =
        typeof window !== "undefined" && json.orderId
          ? `${window.location.origin}/order/${json.orderId}`
          : (json.trackingUrl ?? "")
      void fetch("/api/notifications/order-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: json.orderId,
          customerPhone: form.phone,
          trackingUrl,
          totalUsd: total,
          itemCount: cart.itemCount,
        }),
        keepalive: true,
      }).catch(() => {})
      setShipping({
        kind: "success",
        orderId: json.orderId,
        trackingUrl: json.trackingUrl,
        status: json.status,
        priceUsd,
      })
      cart.clear()
    } catch (err) {
      setShipping({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        previous: "quoted",
      })
    }
  }

  function resetShipping() {
    setShipping({ kind: "none" })
  }

  return (
    <footer className="border-t border-slate-800 bg-slate-950/80 px-5 py-3">
      <DiscountCodeRow />

      {/* Totals · breakdown when discount o envío activos · single
          row Total otherwise. */}
      {showBreakdown ? (
        <div className="mb-3 space-y-1">
          <div className="flex items-baseline justify-between text-xs text-slate-400">
            <span>Subtotal</span>
            <span className="tabular-nums">${cart.subtotal.toFixed(2)}</span>
          </div>
          {cart.discountUsd > 0 ? (
            <div className="flex items-baseline justify-between text-xs" style={{ color: "#4DD4D8" }}>
              <span>Descuento · {cart.discount?.code}</span>
              <span className="tabular-nums">−${cart.discountUsd.toFixed(2)}</span>
            </div>
          ) : null}
          {shippingPrice > 0 ? (
            <div className="flex items-baseline justify-between text-xs text-slate-300">
              <span>
                Envío · PedidosYa
                {shipping.kind === "quoted" || shipping.kind === "ordering" ? (
                  <span className="ml-1 text-slate-500">
                    ({shipping.kind === "quoted" ? shipping.etaMinutes : "—"} min)
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums">${shippingPrice.toFixed(2)}</span>
            </div>
          ) : null}
          {cart.tipUsd > 0 ? (
            <div className="flex items-baseline justify-between text-xs text-slate-300">
              <span>Propina motorizado</span>
              <span className="tabular-nums">${cart.tipUsd.toFixed(2)}</span>
            </div>
          ) : null}
          {loyaltySpendUsd > 0 ? (
            <div className="flex items-baseline justify-between text-xs" style={{ color: "#A78BFA" }}>
              <span>Perlas canjeadas · {loyaltySpendPerlas}</span>
              <span className="tabular-nums">−${loyaltySpendUsd.toFixed(2)}</span>
            </div>
          ) : null}
          {selectedReward ? (
            <div className="flex items-baseline justify-between text-xs" style={{ color: "#A78BFA" }}>
              <span>
                Reward · {selectedReward.label}{" "}
                <span className="text-violet-400/70">({selectedReward.cost}p)</span>
              </span>
              <span className="tabular-nums">
                {rewardPercentOffUsd > 0
                  ? `−$${rewardPercentOffUsd.toFixed(2)}`
                  : "gratis"}
              </span>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-sm text-slate-300">Total</span>
            <span className="font-display text-xl font-semibold tabular-nums text-cyan-200">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-slate-400">Total</span>
          <span className="font-display text-xl font-semibold tabular-nums text-cyan-200">
            ${total.toFixed(2)}
          </span>
        </div>
      )}

      {/* R96.15 · tip chips · solo cuando hay items y no estás en
          medio del flow PedidosYa. */}
      {cart.lines.length > 0 && shipping.kind === "none" ? (
        <TipChips
          value={cart.tipUsd}
          onChange={(v) => cart.setTip(v)}
        />
      ) : null}

      {/* Action surface · changes with shipping state.
          Brand-accurate buttons · WhatsApp #25D366 verde oficial
          con glyph SDR · PedidosYa #F52F41 rojo Pantone 032 C con
          "P" mark blanca. */}
      {shipping.kind === "none" ? (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={buildWhatsAppLink(cart.lines, cart.discount, cart.tipUsd)}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={buttonsDisabled}
            onClick={() => {
              if (buttonsDisabled) return
              // R96.9 · save intent · WhatsApp flow no tiene callback
              // de confirmación · best-effort persist al click.
              saveLastOrder({
                orderCode: null,
                lines: cart.lines,
                totalUsd: total,
              })
            }}
            style={
              buttonsDisabled
                ? undefined
                : {
                    background:
                      "linear-gradient(180deg, #25D366 0%, #1FB855 100%)",
                    boxShadow: "0 10px 24px -10px rgba(37,211,102,0.55)",
                  }
            }
            className={[
              "flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-all",
              buttonsDisabled
                ? "pointer-events-none bg-slate-800 text-slate-500"
                : "text-white hover:translate-y-[-1px]",
            ].join(" ")}
          >
            {!buttonsDisabled ? <WhatsAppGlyph /> : null}
            <span>Pedir por WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => setShipping({ kind: "address" })}
            disabled={buttonsDisabled}
            style={
              buttonsDisabled
                ? undefined
                : {
                    background:
                      "linear-gradient(180deg, #F52F41 0%, #D92235 100%)",
                    boxShadow: "0 10px 24px -10px rgba(245,47,65,0.55)",
                  }
            }
            className={[
              "flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-all",
              buttonsDisabled
                ? "bg-slate-800 text-slate-500"
                : "text-white hover:translate-y-[-1px]",
            ].join(" ")}
          >
            {!buttonsDisabled ? <PedidosYaGlyph /> : null}
            <span>Pedir por PedidosYa</span>
          </button>
        </div>
      ) : shipping.kind === "address" ? (
        <form onSubmit={requestQuote} className="space-y-2">
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
            Datos de entrega
          </span>
          <input
            required
            placeholder="Dirección · calle y número"
            value={form.street}
            onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <input
            placeholder="Piso · depto · referencia (opcional)"
            value={form.detail}
            onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Tu nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <input
              required
              type="tel"
              placeholder="Teléfono"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
          {loyaltyBalance && loyaltyBalance.perlas > 0 ? (
            <div className="space-y-2 rounded-md border border-violet-500/40 bg-violet-500/10 p-3 text-xs text-violet-100">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300">
                    Perlas del náufrago
                  </span>
                  <span>
                    Tenés <strong>{loyaltyBalance.perlas}</strong> perlas · ≈$
                    {perlasToUsd(loyaltyBalance.perlas).toFixed(2)}
                  </span>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[11px]">
                  <span className="text-violet-300/80">Descuento directo</span>
                  <input
                    type="checkbox"
                    checked={directSpendActive}
                    disabled={!!selectedReward}
                    onChange={(e) => {
                      setUseLoyalty(e.target.checked)
                      if (e.target.checked) setSelectedReward(null)
                    }}
                    className="h-4 w-4 accent-cyan-400 disabled:opacity-40"
                  />
                </label>
              </div>
              {/* R96.24 · multi-tier redemption catalog · cada reward
                  un botón · click toggle · selección mutually exclusive
                  con descuento directo. */}
              <div className="space-y-1.5 border-t border-violet-500/20 pt-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet-300">
                  O canjeá un reward
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {LOYALTY_REWARDS.map((r) => {
                    const affordable = loyaltyBalance.perlas >= r.cost
                    const selected = selectedReward?.id === r.id
                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={!affordable && !selected}
                        onClick={() => {
                          if (selected) {
                            setSelectedReward(null)
                          } else {
                            setSelectedReward(r)
                            setUseLoyalty(false)
                          }
                        }}
                        className={[
                          "flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                          selected
                            ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                            : affordable
                              ? "border-violet-500/30 bg-slate-950/50 text-violet-100 hover:bg-violet-500/15"
                              : "cursor-not-allowed border-slate-700 bg-slate-900/30 text-slate-500",
                        ].join(" ")}
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-[11px] font-semibold">
                            {r.label}
                          </span>
                          <span className="truncate text-[10px] opacity-80">
                            {r.description}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px]">
                          {r.cost}p
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
          {/* R96.29 · flecha back + submit "Cotizar envío" lado a lado ·
              back resetea shipping.kind='none' permitiendo elegir otro
              servicio (WhatsApp en lugar de PedidosYa). */}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={resetShipping}
              aria-label="Volver · elegir otro servicio de entrega"
              className="flex shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-3 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="submit"
              style={{
                background:
                  "linear-gradient(180deg, #F52F41 0%, #D92235 100%)",
                boxShadow: "0 10px 24px -10px rgba(245,47,65,0.55)",
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold text-white"
            >
              <PedidosYaGlyph />
              <span>Cotizar envío</span>
            </button>
          </div>
        </form>
      ) : shipping.kind === "quoting" ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-cyan-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cotizando envío…
        </div>
      ) : shipping.kind === "quoted" ? (
        <div className="space-y-2">
          <textarea
            placeholder="Notas para el motorizado (opcional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={resetShipping}
              className="rounded-full border border-slate-700 px-3 py-2.5 text-sm font-medium text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmOrder}
              style={{
                background:
                  "linear-gradient(180deg, #F52F41 0%, #D92235 100%)",
                boxShadow: "0 10px 24px -10px rgba(245,47,65,0.55)",
              }}
              className="flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold text-white"
            >
              <PedidosYaGlyph />
              <span>Confirmar pedido</span>
            </button>
          </div>
        </div>
      ) : shipping.kind === "ordering" ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-cyan-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Confirmando pedido…
        </div>
      ) : shipping.kind === "success" ? (
        <div className="space-y-2 text-sm">
          <div className="font-semibold text-emerald-300">¡Pedido confirmado!</div>
          <div className="text-xs text-slate-300">
            ID · <code className="font-mono">{shipping.orderId}</code>
          </div>
          {shipping.trackingUrl ? (
            <a
              href={shipping.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-2.5 text-center text-sm font-semibold text-white"
            >
              Seguir el envío
            </a>
          ) : null}
        </div>
      ) : shipping.kind === "error" ? (
        <div className="space-y-2 text-sm">
          <div className="font-semibold text-rose-300">No pudimos cotizar</div>
          <div className="text-xs text-slate-300">{shipping.message}</div>
          <button
            type="button"
            onClick={() => setShipping({ kind: "address" })}
            className="w-full rounded-full border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {shipping.kind === "none" ? (
        <p className="mt-2 text-center text-[11px] text-slate-500">
          WhatsApp · te confirmamos en chat · pagás al recibir. PedidosYa · envío motorizado · cotización al instante.
        </p>
      ) : null}
    </footer>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-2xl">
        🛶
      </div>
      <p className="text-sm text-slate-300">Tu canoa está vacía.</p>
      <p className="text-[12px] text-slate-500">
        Toca el <strong className="text-cyan-300">cofre</strong> en la isla
        para reclamar tu descuento, luego explorá el menú.
      </p>
    </div>
  )
}

/* R96.15 · TipChips · 4 chips (0 · 1 · 2 · custom) · custom abre input
   inline. Mismo border-radius que botones del cart para coherencia
   visual. Pattern Domino's tip selection en checkout. */
const TIP_PRESETS = [0, 1, 2] as const

function TipChips({
  value,
  onChange,
}: {
  value: number
  onChange: (usd: number) => void
}) {
  const isPreset = TIP_PRESETS.some((p) => Math.abs(p - value) < 0.005)
  const [customOpen, setCustomOpen] = useState(!isPreset && value > 0)
  const [customStr, setCustomStr] = useState(
    !isPreset && value > 0 ? value.toFixed(2) : "",
  )

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Propina motorizado
        </span>
        {value > 0 ? (
          <span className="text-[10px] text-slate-500">opcional</span>
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {TIP_PRESETS.map((preset) => {
          const active =
            !customOpen && Math.abs(preset - value) < 0.005
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setCustomOpen(false)
                setCustomStr("")
                onChange(preset)
              }}
              className={[
                "rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
            >
              {preset === 0 ? "Sin propina" : `$${preset}`}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={[
            "rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
            customOpen
              ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
              : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800",
          ].join(" ")}
        >
          Otro
        </button>
      </div>
      {customOpen ? (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-mono text-sm text-slate-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={customStr}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, "")
              setCustomStr(raw)
              const n = parseFloat(raw)
              onChange(Number.isFinite(n) ? n : 0)
            }}
            placeholder="0.00"
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500"
          />
        </div>
      ) : null}
    </div>
  )
}

function DiscountCodeRow() {
  const cart = useCart()
  const [code, setCode] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [whatsappRequired, setWhatsappRequired] = useState(false)
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // R96.105 · cache del whatsapp en localStorage para no pedirlo cada
  // vez al mismo cliente · se rehidrata al montar.
  useEffect(() => {
    try {
      const cached = window.localStorage.getItem("naufrago_customer_whatsapp")
      if (cached) setWhatsapp(cached)
    } catch {
      // ignore
    }
  }, [])

  if (cart.discount) {
    return (
      <div
        className="mb-2 flex items-center justify-between rounded-xl border px-3 py-1.5"
        style={{
          borderColor: "rgba(77,212,216,0.5)",
          background: "rgba(76,29,149,0.18)",
        }}
      >
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "#4DD4D8" }}
          >
            Código aplicado
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {cart.discount.code}{" "}
            <span className="font-normal text-slate-400">
              · {cart.discount.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => cart.removeDiscount()}
          aria-label="Quitar código"
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  async function handleSubmit() {
    if (!code.trim() || submitting) return
    setSubmitting(true)
    setError(false)
    setErrorMsg(null)

    const result = await cart.applyCode(code, whatsapp || undefined)
    setSubmitting(false)

    if (result.ok) {
      setCode("")
      setWhatsappRequired(false)
      try {
        if (whatsapp) {
          window.localStorage.setItem("naufrago_customer_whatsapp", whatsapp)
        }
      } catch {
        // ignore
      }
      return
    }

    setError(true)
    setTimeout(() => setError(false), 1400)

    if (result.needsWhatsapp) {
      setWhatsappRequired(true)
      setErrorMsg("Ingresá tu WhatsApp para validar el código")
      return
    }
    if (result.reason === "cooldown") {
      setErrorMsg(
        `Espera ${result.hoursLeft}h más para volver a usarlo`,
      )
      return
    }
    if (result.reason === "need_spend") {
      setErrorMsg(
        `Necesitas $${result.spendNeededUsd?.toFixed(2)} más en consumo para volverlo a usar`,
      )
      return
    }
    if (result.reason === "invalid_whatsapp") {
      setErrorMsg("WhatsApp inválido · revisá el número")
      return
    }
    if (result.reason === "unknown_code") {
      setErrorMsg("Código no encontrado")
      return
    }
    setErrorMsg("No se pudo validar · intenta de nuevo")
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
      className="mb-2 space-y-1.5"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="¿Tenés un código?"
          className={[
            "flex-1 rounded-md border bg-slate-950 px-3 py-2 text-sm uppercase tracking-[0.1em] text-slate-100 placeholder:text-slate-500 transition-all",
            error
              ? "border-rose-500 ring-1 ring-rose-500/40"
              : "border-slate-700 focus:border-cyan-500",
          ].join(" ")}
          maxLength={20}
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={!code.trim() || submitting}
          className="rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitting ? "..." : "Aplicar"}
        </button>
      </div>
      {whatsappRequired && (
        <input
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Tu WhatsApp · ej. 0997123456"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500"
          maxLength={20}
        />
      )}
      {errorMsg && (
        <p className="text-xs text-rose-400">{errorMsg}</p>
      )}
    </form>
  )
}
