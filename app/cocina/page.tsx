"use client"
/**
 * Pantalla de cocina · R132.
 *
 * POR QUÉ EXISTE
 * Loyverse no tiene forma de recibir un pedido pendiente: su conexión
 * técnica sólo acepta ventas YA CERRADAS, y su pantalla de cocina
 * únicamente escucha a su propio punto de venta (comprobado · /orders,
 * /tickets y /kds no existen). O sea que el pedido que entra por
 * naufrago.ec no puede aparecer en la pantalla que ya está colgada en la
 * cocina. Esta es esa pantalla, pero nuestra.
 *
 * LA CONDICIÓN DE EMILIO · "no pueden ser dos sistemas"
 * Y no lo son. Acá se COCINA; la plata se cuenta en UN solo lado, que
 * sigue siendo Loyverse: al tocar "entregado y cobrado" la venta se
 * manda al punto de venta. Cada tarjeta muestra si esa venta ya entró a
 * la contabilidad, así que si alguna queda afuera se ve acá y no tres
 * días después cuadrando caja.
 *
 * CÓMO SE ABRE
 * Una vez, con la llave en la dirección · `/cocina?llave=...`. Queda
 * guardada en la tablet y no se pregunta más. Sin llave no se ve nada.
 */
import { useCallback, useEffect, useState } from "react"

interface Linea {
  id?: string
  name?: string
  qty?: number
  priceUsd?: number
  notes?: string
}

interface Pedido {
  id: string
  order_code: string
  status: string
  created_at: string
  customer_name: string
  customer_phone: string
  dropoff_address: string
  dropoff_detail: string | null
  cart_lines: Linea[]
  customer_notes: string | null
  total_usd: number
  delivery_fee_usd: number
  payment_method: string
  vivo: boolean
  contabilidad: "ok" | "falló" | null
}

const LLAVE_GUARDADA = "naufrago_cocina_llave"

/** El botón que corresponde según dónde está el pedido. */
function siguientePaso(estado: string): { paso: string; texto: string } | null {
  switch (estado) {
    case "PENDING":
      return { paso: "aceptar", texto: "Aceptar pedido" }
    case "ACCEPTED":
      return { paso: "preparar", texto: "Empezar a cocinar" }
    case "PREPARING":
      return { paso: "listo", texto: "Listo para salir" }
    case "READY":
    case "RIDER_PICKED_UP":
    case "IN_TRANSIT":
      return { paso: "entregado", texto: "Entregado y cobrado" }
    default:
      return null
  }
}

const NOMBRE_ESTADO: Record<string, string> = {
  PENDING: "nuevo",
  ACCEPTED: "aceptado",
  PREPARING: "en la cocina",
  READY: "listo",
  RIDER_PICKED_UP: "lo llevan",
  IN_TRANSIT: "en camino",
  DELIVERED: "entregado",
  CANCELLED: "cancelado",
}

function minutosDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

export default function PantallaCocina() {
  const [llave, setLlave] = useState<string | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ultima, setUltima] = useState<Date | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)

  // La llave entra una vez por la dirección y se queda en el aparato.
  useEffect(() => {
    const enUrl = new URLSearchParams(window.location.search).get("llave")
    if (enUrl) {
      try {
        localStorage.setItem(LLAVE_GUARDADA, enUrl)
      } catch {}
      setLlave(enUrl)
      window.history.replaceState({}, "", "/cocina")
      return
    }
    try {
      setLlave(localStorage.getItem(LLAVE_GUARDADA))
    } catch {
      setLlave(null)
    }
  }, [])

  const traer = useCallback(async () => {
    if (!llave) return
    try {
      const res = await fetch("/api/cocina/pedidos", {
        headers: { "x-cocina-llave": llave },
        cache: "no-store",
      })
      if (res.status === 401) {
        setError("La llave no sirve · pedí la dirección completa de nuevo.")
        return
      }
      const data = await res.json()
      if (!data.ok) {
        setError("No se pudieron traer los pedidos.")
        return
      }
      setPedidos(data.pedidos ?? [])
      setUltima(new Date())
      setError(null)
    } catch {
      setError("Sin conexión · reintentando.")
    }
  }, [llave])

  useEffect(() => {
    if (!llave) return
    traer()
    const t = setInterval(traer, 8000)
    return () => clearInterval(t)
  }, [llave, traer])

  // Un reloj propio · los minutos de espera tienen que correr solos
  // aunque no llegue ningún pedido nuevo.
  const [, redibujar] = useState(0)
  useEffect(() => {
    const t = setInterval(() => redibujar((n) => n + 1), 20000)
    return () => clearInterval(t)
  }, [])

  async function avanzar(pedido: Pedido, paso: string) {
    if (!llave) return
    setOcupado(pedido.id)
    try {
      const res = await fetch("/api/cocina/avanzar", {
        method: "POST",
        headers: { "content-type": "application/json", "x-cocina-llave": llave },
        body: JSON.stringify({ orderId: pedido.id, paso }),
      })
      const data = await res.json()
      if (!data.ok) setError(`No se pudo mover el pedido · ${data.error ?? ""}`)
      else if (paso === "entregado" && data.contabilidad === "falló") {
        setError(
          `El pedido ${pedido.order_code} se entregó, pero NO entró a la contabilidad. Queda anotado.`,
        )
      }
      await traer()
    } catch {
      setError("Sin conexión · el pedido no se movió.")
    } finally {
      setOcupado(null)
    }
  }

  if (llave === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-slate-300">
        <div>
          <h1 className="mb-2 text-2xl font-bold text-white">Pantalla de cocina</h1>
          <p className="text-sm">
            Esta pantalla se abre con su llave · pedila y entrá con la dirección
            completa.
          </p>
        </div>
      </main>
    )
  }

  const vivos = pedidos.filter((p) => p.vivo)
  const salidos = pedidos.filter((p) => !p.vivo)

  return (
    <main className="min-h-screen bg-slate-950 p-3 text-slate-100">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-2">
        <h1 className="text-xl font-black tracking-wide">
          COCINA · <span className="text-cyan-400">naufrago.ec</span>
        </h1>
        <span className="text-xs text-slate-400">
          {vivos.length} en curso · actualizado{" "}
          {ultima ? ultima.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "…"}
        </span>
      </header>

      {error ? (
        <p className="mb-3 rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>
      ) : null}

      {vivos.length === 0 ? (
        <p className="py-16 text-center text-slate-500">
          No hay pedidos de la web esperando.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {vivos.map((p) => {
          const min = minutosDesde(p.created_at)
          const paso = siguientePaso(p.status)
          const urgente = min >= 20
          return (
            <article
              key={p.id}
              className={`rounded-xl border-2 p-3 ${
                urgente ? "border-red-500 bg-red-950/30" : "border-slate-700 bg-slate-900"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="font-mono text-sm text-cyan-300">{p.order_code}</span>
                <span className={`text-sm font-bold ${urgente ? "text-red-300" : "text-slate-400"}`}>
                  {min} min · {NOMBRE_ESTADO[p.status] ?? p.status}
                </span>
              </div>

              <ul className="mb-2 space-y-1">
                {(p.cart_lines ?? []).map((l, i) => (
                  <li key={i} className="text-lg font-bold leading-tight">
                    <span className="text-cyan-400">{l.qty ?? 1}×</span> {l.name}
                    {l.notes ? (
                      <span className="block text-sm font-normal text-amber-300">↳ {l.notes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>

              {p.customer_notes ? (
                <p className="mb-2 rounded bg-amber-950/60 px-2 py-1 text-sm text-amber-200">
                  Nota · {p.customer_notes}
                </p>
              ) : null}

              <p className="mb-1 text-sm text-slate-300">
                {p.customer_name} · {p.customer_phone}
              </p>
              <p className="mb-2 text-xs text-slate-400">
                {p.dropoff_address}
                {p.dropoff_detail ? ` · ${p.dropoff_detail}` : ""}
              </p>

              <p className="mb-3 text-base">
                <span className="font-black text-emerald-400">
                  COBRAR ${Number(p.total_usd).toFixed(2)}
                </span>
                {Number(p.delivery_fee_usd) > 0 ? (
                  <span className="text-xs text-slate-400">
                    {" "}
                    (incluye ${Number(p.delivery_fee_usd).toFixed(2)} de envío)
                  </span>
                ) : null}
              </p>

              {paso ? (
                <button
                  type="button"
                  disabled={ocupado === p.id}
                  onClick={() => avanzar(p, paso.paso)}
                  className="w-full rounded-lg bg-cyan-500 px-3 py-3 text-base font-bold text-slate-950 disabled:opacity-50"
                >
                  {ocupado === p.id ? "…" : paso.texto}
                </button>
              ) : null}
            </article>
          )
        })}
      </div>

      {salidos.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-500">
            Ya salieron · últimas 24 horas
          </h2>
          <ul className="space-y-1">
            {salidos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-mono text-slate-400">{p.order_code}</span>
                <span className="text-slate-500">{NOMBRE_ESTADO[p.status] ?? p.status}</span>
                <span className="text-slate-400">${Number(p.total_usd).toFixed(2)}</span>
                <span
                  className={
                    p.contabilidad === "ok"
                      ? "text-emerald-400"
                      : p.contabilidad === "falló"
                        ? "text-red-400"
                        : "text-slate-600"
                  }
                >
                  {p.contabilidad === "ok"
                    ? "en contabilidad ✓"
                    : p.contabilidad === "falló"
                      ? "NO entró a contabilidad"
                      : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
