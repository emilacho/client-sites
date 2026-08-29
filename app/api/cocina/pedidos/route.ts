import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cocinaAutorizada } from "@/lib/cocina-llave"

/**
 * GET /api/cocina/pedidos · R132
 *
 * Lo que la cocina necesita ver de los pedidos de la web, y nada más.
 *
 * Devuelve tambien si la venta YA ENTRÓ a la contabilidad del local
 * (Loyverse). Esa columna es el punto de todo esto: la pantalla es
 * nuestra, pero la plata se cuenta en UN solo lado. Si un pedido queda
 * fuera, se ve acá y no dentro de tres días cuadrando caja.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"

/**
 * Los que siguen EN LA COCINA · los únicos que ocupan el tablero.
 *
 * READY queda AFUERA a propósito: en el KDS de Loyverse, cuando se toca
 * la cabecera el ticket desaparece del tablero. Acá igual · pasa a la
 * lista de terminados, que es donde se cobra. Si READY siguiera acá, el
 * ticket se quedaría pegado en pantalla después de darlo por listo, que
 * es justo lo que pasó la primera vez que lo probé.
 */
const VIVOS = ["PENDING", "ACCEPTED", "PREPARING"]

export async function GET(req: NextRequest) {
  if (!(await cocinaAutorizada(req.headers.get("x-cocina-llave")))) {
    return Response.json({ ok: false, error: "no_autorizado" }, { status: 401 })
  }

  const supa = getSupabaseAdmin()
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supa
    .from("orders")
    .select(
      "id, order_code, status, created_at, accepted_at, ready_at, delivered_at, customer_name, customer_phone, dropoff_address, dropoff_detail, cart_lines, customer_notes, subtotal_usd, discount_usd, delivery_fee_usd, total_usd, payment_method",
    )
    .eq("client_slug", CLIENT_SLUG)
    .gte("created_at", desde)
    .order("created_at", { ascending: true })
    .limit(60)

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const pedidos = data ?? []
  const ids = pedidos.map((p) => p.id)

  // ¿Cuáles ya llegaron a la contabilidad? · una sola consulta para todos.
  const contabilidad = new Map<string, "ok" | "falló">()
  if (ids.length > 0) {
    const { data: eventos } = await supa
      .from("order_events")
      .select("order_id, event_type")
      .in("order_id", ids)
      .in("event_type", ["ACCOUNTING_SYNCED", "ACCOUNTING_SYNC_FAILED"])
    for (const e of eventos ?? []) {
      const fila = e as { order_id: string; event_type: string }
      // Un ÉXITO posterior pisa a un fallo anterior · el reintento cuenta.
      if (fila.event_type === "ACCOUNTING_SYNCED") contabilidad.set(fila.order_id, "ok")
      else if (!contabilidad.has(fila.order_id)) contabilidad.set(fila.order_id, "falló")
    }
  }

  return Response.json({
    ok: true,
    ahora: new Date().toISOString(),
    pedidos: pedidos.map((p) => ({
      ...p,
      vivo: VIVOS.includes(String(p.status)),
      contabilidad: contabilidad.get(p.id) ?? null,
    })),
  })
}
