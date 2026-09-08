import type { NextRequest } from "next/server"
import { llamadaInterna } from "@/lib/llave-interna"
import { origenPublico } from "@/lib/origen"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cliente } from "@/cliente.config"

/**
 * El primer aviso al cliente · "tu pedido está confirmado".
 *
 * R170 · REESCRITO PORQUE ERA UN MEGÁFONO ABIERTO.
 *
 * Cómo estaba: la pantalla del cliente le pasaba a esta dirección el
 * teléfono, el monto, la cantidad de platos y el enlace de seguimiento,
 * y esta dirección mandaba un WhatsApp con todo eso desde la cuenta del
 * local. Sin comprobar nada.
 *
 * Es decir · cualquiera podía mandarle un WhatsApp a CUALQUIER número,
 * que llegaba desde el número del local, con el texto y el ENLACE que
 * quisiera. Eso es el molde exacto de una estafa por mensaje: "tu
 * pedido está confirmado, seguilo acá" apuntando a donde el estafador
 * quiera. Y de paso gasta el saldo de mensajería del local.
 *
 * Cómo quedó · dos cerrojos:
 *
 *   1 · Sólo la llama el propio sistema (llave interna). Antes la
 *       llamaba el navegador; ahora la llama el servidor después de
 *       despachar de verdad, que es el único momento en que el aviso
 *       corresponde.
 *
 *   2 · No se cree NADA de lo que le manden salvo el código del pedido.
 *       El teléfono, el monto, los platos y el enlace salen de la ficha
 *       guardada. Aunque alguien consiguiera la llave, no puede elegir
 *       ni a quién le llega ni a dónde apunta el enlace.
 *
 * Se manda UNA sola vez por pedido · si se reintenta, se ignora.
 */

export const runtime = "nodejs"

interface Linea {
  qty?: number
}

function armarMensaje(p: {
  orderCode: string
  trackingUrl: string
  totalUsd: number
  itemCount: number
}): string {
  return [
    `¡Hola! Tu pedido en Náufrago está confirmado.`,
    ``,
    `Código · ${p.orderCode}`,
    `${p.itemCount} ${p.itemCount === 1 ? "plato" : "platos"} · $${p.totalUsd.toFixed(2)}`,
    ``,
    `Síguelo en vivo · ${p.trackingUrl}`,
  ].join("\n")
}

export async function POST(req: NextRequest) {
  // Cerrojo 1 · esto no lo llama un navegador. 404 y no 401: a quien no
  // corresponde no se le confirma que acá hay algo.
  if (!llamadaInterna(req)) {
    return new Response("Not found", { status: 404 })
  }

  let body: { orderCode?: unknown }
  try {
    body = (await req.json()) as { orderCode?: unknown }
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const orderCode = typeof body.orderCode === "string" ? body.orderCode : ""
  if (!orderCode) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const supa = getSupabaseAdmin()

  // Cerrojo 2 · todo sale de la ficha, no del que llama.
  const { data } = await supa
    .from("orders")
    .select("id, order_code, customer_phone, total_usd, cart_lines")
    .eq("client_slug", cliente.slug)
    .eq("order_code", orderCode)
    .maybeSingle()
  const pedido = data as {
    id: string
    order_code: string
    customer_phone: string | null
    total_usd: number | null
    cart_lines: Linea[] | null
  } | null

  if (!pedido) {
    return Response.json({ ok: false, error: "pedido_no_encontrado" }, { status: 404 })
  }
  if (!pedido.customer_phone) {
    return Response.json({ ok: true, sent: false, reason: "sin_telefono" })
  }

  // Una sola vez por pedido.
  const { data: previos } = await supa
    .from("order_events")
    .select("id")
    .eq("order_id", pedido.id)
    .eq("event_type", "WHATSAPP_CONFIRM_SENT")
    .limit(1)
  if (Array.isArray(previos) && previos.length > 0) {
    return Response.json({ ok: true, sent: false, reason: "ya_enviado" })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !fromWa) {
    return Response.json({ ok: true, sent: false, reason: "twilio_not_configured" })
  }

  const itemCount = (pedido.cart_lines ?? []).reduce(
    (n, l) => n + Number(l?.qty ?? 0),
    0,
  )
  const mensaje = armarMensaje({
    orderCode: pedido.order_code,
    // El enlace lo arma el servidor con el dominio de la marca · nunca
    // llega de afuera. Acá vivía el agujero de la estafa por mensaje.
    trackingUrl: `${origenPublico()}/order/${encodeURIComponent(pedido.order_code)}`,
    totalUsd: Number(pedido.total_usd ?? 0),
    itemCount,
  })

  try {
    const params = new URLSearchParams({
      To: `whatsapp:+${pedido.customer_phone}`,
      From: fromWa,
      Body: mensaje,
    })
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return Response.json(
        { ok: false, error: "twilio_error", status: res.status, detail: detail.slice(0, 300) },
        { status: 502 },
      )
    }
    const enviado = (await res.json()) as { sid?: string }

    await supa
      .from("order_events")
      .insert({
        order_id: pedido.id,
        event_type: "WHATSAPP_CONFIRM_SENT",
        actor: "system",
        payload: { sid: enviado.sid ?? null },
      })
      .then(
        () => {},
        () => {},
      )

    return Response.json({ ok: true, sent: true, sid: enviado.sid ?? null })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown_error" },
      { status: 500 },
    )
  }
}
