import type { NextRequest } from "next/server"
import { cabecerasInternas } from "@/lib/llave-interna"
import { origenPropio } from "@/lib/origen"
import { getSupabaseAdmin } from "@/lib/supabase"
import { firmaValida, direccionVerificada } from "@/lib/whatsapp/firma"

/**
 * POST /api/whatsapp/incoming · R96.139 + R96.156
 *
 * Webhook Twilio · enrutamiento por (sender, estado) ·
 *
 *   1) Admin (Emilio) → flow jugos del día · parsea sabores + update
 *      naufrago_dynamic_options.juice_flavors.
 *
 *   2) Cliente con order en PENDING_LOCATION → recibir pin (Twilio envía
 *      Latitude + Longitude fields) → persistir dropoff_lat/lng → pedir
 *      detalle extra → transition PENDING_LOCATION_DETAIL.
 *
 *   3) Cliente con order en PENDING_LOCATION_DETAIL → recibir texto →
 *      persistir como dropoff_detail → transition CONFIRMED · cotizar
 *      PedidosYa (downstream · webhook futuro).
 *
 *   4) Inbound desconocido (sin order pending) → respuesta default.
 *
 * Twilio envía form-urlencoded · NO json · campos · From · To · Body ·
 * Latitude · Longitude · etc. Auto-respuesta vía TwiML XML.
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const ADMIN_WA = process.env.NAUFRAGO_ADMIN_WHATSAPP ?? "593997744288"

const SABORES_CATALOG = [
  { id: "naranja", label: "Naranja", aliases: ["naranja", "naranjas"] },
  { id: "limon", label: "Limón", aliases: ["limon", "limón", "limones"] },
  { id: "maracuya", label: "Maracuyá", aliases: ["maracuya", "maracuyá"] },
  { id: "mora", label: "Mora", aliases: ["mora", "moras"] },
  { id: "tamarindo", label: "Tamarindo", aliases: ["tamarindo"] },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
}

function parseSabores(body: string): string[] {
  const norm = normalize(body)
  const found: string[] = []
  for (const sabor of SABORES_CATALOG) {
    const aliases = sabor.aliases.map(normalize)
    if (aliases.some((a) => norm.includes(a)) && !found.includes(sabor.id)) {
      found.push(sabor.id)
    }
  }
  return found
}

function twimlResponse(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message.replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c,
  )}</Message></Response>`
  return new Response(xml, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  })
}

export async function POST(req: NextRequest) {
  const formText = await req.text()

  // R166 · ¿esto lo mandó el proveedor de verdad?
  //
  // Sin esta puerta, cualquiera que supiera la dirección podía decir
  // "soy el dueño" y cambiar los jugos del día, o decir "soy este
  // cliente" y cambiarle la dirección de entrega a su pedido. El campo
  // del remitente lo escribe quien llama · no prueba nada por sí solo.
  //
  // Se contesta 404 y no 401 a propósito: a quien no corresponde no se
  // le confirma que acá hay algo.
  if (!firmaValida(req, formText)) {
    // Se dice CONTRA QUÉ dirección se verificó. Si el proveedor tiene
    // configurada otra, todos los avisos rebotan y el WhatsApp queda
    // mudo · sin esta línea, esa caída sería imposible de diagnosticar.
    console.warn(
      `[whatsapp] aviso sin firma válida · descartado · verificado contra ${direccionVerificada(req)} · traía sello: ${Boolean(req.headers.get("x-twilio-signature"))} · hay clave: ${Boolean(process.env.TWILIO_AUTH_TOKEN)}`,
    )
    return new Response("Not found", { status: 404 })
  }

  const form = new URLSearchParams(formText)
  const fromRaw = form.get("From") ?? ""
  const body = form.get("Body") ?? ""
  const lat = form.get("Latitude")
  const lng = form.get("Longitude")
  const fromClean = fromRaw.replace(/^whatsapp:\+/, "")

  // ─── 1) ADMIN · flow jugos del día ──────────────────────────────────
  if (fromClean === ADMIN_WA) {
    return handleAdminJuices(body, fromClean)
  }

  // ─── 2 + 3) CLIENTE · order pending location/detail ────────────────
  const supa = getSupabaseAdmin()
  const { data: pendingOrder } = await supa
    .from("orders")
    .select("id, order_code, status")
    .eq("client_slug", CLIENT_SLUG)
    .eq("customer_phone", fromClean)
    .in("status", ["PENDING_LOCATION", "PENDING_LOCATION_DETAIL"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingOrder?.status === "PENDING_LOCATION") {
    return handleLocationShare(pendingOrder.order_code, lat, lng)
  }
  if (pendingOrder?.status === "PENDING_LOCATION_DETAIL") {
    return handleDetailShare(pendingOrder.order_code, body)
  }

  // ─── 4) Inbound sin order pending · default ────────────────────────
  return twimlResponse(
    // R123 - este mensaje tenia tres cosas mal a la vez:
    //   1. mandaba a naufrago.delivery, que NO RESPONDE (verificado: la
    //      conexion ni siquiera se establece). El dominio vivo es naufrago.ec.
    //   2. le decia "escribenos a +593997744288" a alguien que ya estaba
    //      escribiendo, sin darle una salida distinta.
    //   3. "entra" seguia en argentino.
    // R169 · la frase anterior prometía "cuéntanos aquí mismo y te
    // atendemos". No hay nadie del otro lado y no lo va a haber: este
    // número responde solo. Prometer atención humana deja al cliente
    // esperando una respuesta que nunca llega · es peor que no
    // contestar nada, porque encima parece que lo ignoraron.
    //
    // Se le dice la verdad y se le da una salida que SÍ funciona.
    "Hola · este número responde automáticamente, no lo lee una persona. Para hacer tu pedido entra a naufrago.ec · si ya tienes uno en curso, sigue su estado en el enlace que te enviamos al confirmarlo.",
  )
}

async function handleAdminJuices(body: string, fromClean: string) {
  const parsed = parseSabores(body)
  const supa = getSupabaseAdmin()
  try {
    await supa.from("juice_admin_log").insert({
      client_slug: CLIENT_SLUG,
      inbound_text: body.slice(0, 500),
      parsed_juices: parsed,
      parse_ok: parsed.length > 0,
      from_number: fromClean,
      source: "whatsapp",
    })
  } catch {
    // best-effort
  }

  if (parsed.length === 0) {
    return twimlResponse(
      "❓ No entendí qué jugos · respondé ejemplo · 'naranja y limón' · sabores válidos · naranja · limón · maracuyá · mora · tamarindo",
    )
  }
  if (parsed.length > 5) {
    return twimlResponse(
      "Solo 5 sabores posibles · revisá tu mensaje y volvé a enviar",
    )
  }
  const optionsToSave = SABORES_CATALOG.filter((s) =>
    parsed.includes(s.id),
  ).map((s) => ({ id: s.id, label: s.label }))
  const { error } = await supa
    .from("dynamic_options")
    .update({ options: optionsToSave, updated_at: new Date().toISOString() })
    .eq("client_slug", CLIENT_SLUG)
    .eq("key", "juice_flavors")
  if (error) {
    return twimlResponse(`⚠ Error guardando · intentá de nuevo`)
  }
  const labelList = optionsToSave.map((o) => o.label).join(" · ")
  return twimlResponse(
    `✅ Listo · jugos disponibles · ${labelList}\n\nClientes lo van a ver actualizado en el menú.`,
  )
}

async function handleLocationShare(
  orderCode: string,
  lat: string | null,
  lng: string | null,
) {
  // Twilio WhatsApp manda Latitude + Longitude como form fields cuando
  // el cliente comparte una ubicación nativa. Si vienen vacíos · cliente
  // mandó texto · pedir el pin explícito.
  if (!lat || !lng) {
    return twimlResponse(
      "📍 Necesito el pin del mapa · NO texto · presioná 📎 (clip) → Ubicación → Enviar tu ubicación actual",
    )
  }
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return twimlResponse(
      "⚠ Ubicación inválida · reintentá compartiendo el pin del mapa",
    )
  }
  const supa = getSupabaseAdmin()
  await supa
    .from("orders")
    .update({
      dropoff_lat: latNum,
      dropoff_lng: lngNum,
      status: "PENDING_LOCATION_DETAIL",
    })
    .eq("order_code", orderCode)

  return twimlResponse(
    `📍 Ubicación recibida · pedido ${orderCode}\n\nAhora un detalle extra de la entrega · ejemplo ·\n  "entrar por la peatonal · timbre azul · 2do piso"\n  "casa esquina · portón verde"\n  "depto 3B · pedir al vigilante"\n\n(Si no hay nada especial · respondé "ok" o "sin detalle")`,
  )
}

async function handleDetailShare(orderCode: string, body: string) {
  const detail = body.trim().slice(0, 300)
  if (!detail) {
    return twimlResponse(
      "Si no hay detalle especial · respondé 'ok' o 'sin detalle' para finalizar el pedido",
    )
  }
  const supa = getSupabaseAdmin()
  // Detalle opcional · si dice "ok" / "sin detalle" / "ninguno" persistimos null
  const isEmpty = /^(ok|sin detalle|ninguno|nada|na|no)$/i.test(detail)
  await supa
    .from("orders")
    .update({
      dropoff_detail: isEmpty ? null : detail,
      status: "CONFIRMED",
    })
    .eq("order_code", orderCode)

  // Dispatch flow downstream · cotizar PedidosYa + dispatch motorizado.
  // Llamado fire-and-forget al endpoint courier/order que ya existe ·
  // este se encarga de pedir cotización y disparar el delivery.
  const origin = origenPropio()
  void fetch(`${origin}/api/courier/order-from-confirmed`, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecerasInternas() },
    body: JSON.stringify({ orderCode }),
    keepalive: true,
  }).catch(() => {})

  return twimlResponse(
    `✅ Pedido ${orderCode} confirmado\n\nEstamos cotizando el envío · te confirmamos en segundos · gracias por elegir Náufrago 🌊`,
  )
}
