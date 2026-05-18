"use client"
/**
 * CourierQuoteFlow · Round 74 · PedidosYa Courier customer step.
 *
 * Drop-in component meant to live inside CartDrawer (below the line
 * items, above the WhatsApp checkout button). Self-contained · only
 * talks to /api/courier/quote and /api/courier/order. No global
 * state, no external hooks beyond useCart.
 *
 *  Steps the customer walks through:
 *    idle    · "Solicitar envío con PedidosYa" CTA
 *    address · street + apt/detail + name + phone form
 *    quoting · spinner while POST /api/courier/quote
 *    quoted  · price + ETA + "Confirmar envío" CTA
 *    ordering · spinner while POST /api/courier/order
 *    success · tracking URL + thank you
 *    error   · error message + "Reintentar" button
 *
 * The component is intentionally framework-agnostic on style ·
 * Tailwind utility classes follow the rest of the v2 palette
 * (slate body + cyan/violet brand accents). Plug as a child of any
 * existing client component.
 */
import { useState } from "react"
import { useCart } from "@/lib/v2/cart-context"

type FlowState =
  | { kind: "idle" }
  | { kind: "address" }
  | { kind: "quoting" }
  | {
      kind: "quoted"
      quoteToken: string
      priceUsd: number
      etaMinutes: number
      expiresAt: string
    }
  | { kind: "ordering" }
  | {
      kind: "success"
      orderId: string
      trackingUrl?: string
      status: string
    }
  | { kind: "error"; message: string; retryTo: FlowState["kind"] }

export function CourierQuoteFlow() {
  const cart = useCart()
  const [state, setState] = useState<FlowState>({ kind: "idle" })
  const [form, setForm] = useState({
    street: "",
    detail: "",
    name: "",
    phone: "",
    email: "",
    notes: "",
  })

  const cartReady = cart.lines.length > 0

  async function requestQuote() {
    setState({ kind: "quoting" })
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
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "quote_failed")
      }
      setState({
        kind: "quoted",
        quoteToken: json.quoteToken,
        priceUsd: json.priceUsd,
        etaMinutes: json.etaMinutes,
        expiresAt: json.expiresAt,
      })
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        retryTo: "address",
      })
    }
  }

  async function confirmOrder() {
    if (state.kind !== "quoted") return
    const quoteToken = state.quoteToken
    setState({ kind: "ordering" })
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
          })),
          notes: form.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.detail || json.error || "order_failed")
      }
      setState({
        kind: "success",
        orderId: json.orderId,
        trackingUrl: json.trackingUrl,
        status: json.status,
      })
      cart.clear()
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
        retryTo: "quoted",
      })
    }
  }

  if (!cartReady && state.kind !== "success") {
    return null
  }

  const reset = () => setState({ kind: "idle" })

  return (
    <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-900/50 p-4 text-sm text-slate-200">
      {state.kind === "idle" && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-cyan-200">Envío PedidosYa</div>
            <div className="mt-0.5 text-xs text-slate-400">
              Cotiza el envío con la dirección a la que querés recibir.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setState({ kind: "address" })}
            className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Cotizar
          </button>
        </div>
      )}

      {state.kind === "address" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            requestQuote()
          }}
          className="space-y-2"
        >
          <div className="font-semibold text-cyan-200">Datos de entrega</div>
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
          <input
            required
            placeholder="Tu nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <input
            required
            type="tel"
            placeholder="Teléfono"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ml-auto rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Pedir cotización
            </button>
          </div>
        </form>
      )}

      {state.kind === "quoting" && (
        <div className="text-cyan-200">Cotizando…</div>
      )}

      {state.kind === "quoted" && (
        <div className="space-y-3">
          <div className="font-semibold text-cyan-200">Cotización lista</div>
          <div className="flex items-baseline justify-between">
            <span className="text-slate-300">Costo de envío</span>
            <span className="text-lg font-semibold text-white">
              ${state.priceUsd.toFixed(2)}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-xs text-slate-400">
            <span>ETA</span>
            <span>{state.etaMinutes} min</span>
          </div>
          <textarea
            placeholder="Notas para el rider (opcional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmOrder}
              className="ml-auto rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Confirmar envío
            </button>
          </div>
        </div>
      )}

      {state.kind === "ordering" && (
        <div className="text-cyan-200">Confirmando envío…</div>
      )}

      {state.kind === "success" && (
        <div className="space-y-2">
          <div className="font-semibold text-cyan-200">¡Envío confirmado!</div>
          <div className="text-xs text-slate-300">
            ID · <code>{state.orderId}</code>
          </div>
          <div className="text-xs text-slate-400">Estado · {state.status}</div>
          {state.trackingUrl && (
            <a
              href={state.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white"
            >
              Seguir el envío
            </a>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-2">
          <div className="font-semibold text-rose-300">No pudimos completar</div>
          <div className="text-xs text-slate-300">{state.message}</div>
          <button
            type="button"
            onClick={() =>
              setState({
                kind: state.retryTo === "quoted" ? "address" : "address",
              })
            }
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
