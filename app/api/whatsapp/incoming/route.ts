import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/whatsapp/incoming · R96.139
 *
 * Webhook Twilio · recibe mensaje inbound desde el WhatsApp del admin.
 * Parsea con regex flexible (substring match · sin tildes · case-insensitive)
 * los 5 sabores conocidos · actualiza naufrago_dynamic_options.juice_flavors
 * con SOLO los sabores disponibles · audit log a naufrago_juice_admin_log.
 *
 * Twilio envía form-urlencoded · NO json · campos · From · To · Body · etc.
 * Auto-respuesta · TwiML XML con `<Response><Message>...</Message></Response>`.
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
    .replace(/[̀-ͯ]/g, "") // remove tildes
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
  const form = new URLSearchParams(formText)
  const fromRaw = form.get("From") ?? ""
  const body = form.get("Body") ?? ""

  // Strip "whatsapp:+" prefix · get plain E.164 digits
  const fromClean = fromRaw.replace(/^whatsapp:\+/, "")

  // Solo aceptar inbound del admin · ignorar resto (silent · no reply)
  if (fromClean !== ADMIN_WA) {
    return twimlResponse(
      "Hola · este número es interno · escribinos a +" + "593997744288" + " para pedidos.",
    )
  }

  const parsed = parseSabores(body)
  const supa = getSupabaseAdmin()

  // Audit log siempre · parsed_juices vacío si parser falla.
  // Wrap en try porque la query builder no acepta .catch() directo.
  try {
    await supa.from("naufrago_juice_admin_log").insert({
      client_slug: CLIENT_SLUG,
      inbound_text: body.slice(0, 500),
      parsed_juices: parsed,
      parse_ok: parsed.length > 0,
      from_number: fromClean,
      source: "whatsapp",
    })
  } catch {
    // best-effort log · no romper flow
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

  // Update naufrago_dynamic_options.juice_flavors con solo los parseados
  const optionsToSave = SABORES_CATALOG.filter((s) =>
    parsed.includes(s.id),
  ).map((s) => ({ id: s.id, label: s.label }))

  const { error } = await supa
    .from("naufrago_dynamic_options")
    .update({
      options: optionsToSave,
      updated_at: new Date().toISOString(),
    })
    .eq("client_slug", CLIENT_SLUG)
    .eq("key", "juice_flavors")

  if (error) {
    return twimlResponse(
      `⚠ Error guardando · ${error.message.slice(0, 100)} · intentá de nuevo`,
    )
  }

  const labelList = optionsToSave.map((o) => o.label).join(" · ")
  return twimlResponse(
    `✅ Listo · jugos disponibles · ${labelList}\n\nClientes lo van a ver actualizado en el menú.`,
  )
}
