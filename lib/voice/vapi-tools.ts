import "server-only"
import { getSupabaseAdmin } from "@/lib/supabase"
import { generateOrderCode } from "@/lib/checkout/order-code"
import {
  searchMenu,
  getMenuItemById,
  summarizeMenu,
} from "@/lib/voice/menu-search"

/**
 * Implementación de los 4 function tools que el assistant Vapi puede llamar
 * durante una llamada de voz · R97.3 Fase 2.
 *
 * Patrón · cada tool recibe el voiceCallId (que viene en el metadata Vapi)
 * + sus parámetros propios · devuelve un objeto serializable que el LLM
 * lee para decidir qué decirle al cliente.
 *
 * Estado · el "carrito en curso" vive en la columna voice_calls.cart_lines_
 * extracted (jsonb) · cada add_to_cart lo lee + lo muta + lo escribe de
 * vuelta. confirm_order toma ese cart y crea la fila naufrago.orders.
 */

interface VoiceCartLine {
  id: string
  name: string
  qty: number
  priceUsd: number
  notes?: string
  customizations?: Array<{ id: string; label: string; priceDelta: number }>
}

interface VoiceCart {
  lines: VoiceCartLine[]
  subtotalUsd: number
}

const EMPTY_CART: VoiceCart = { lines: [], subtotalUsd: 0 }

function computeSubtotal(lines: VoiceCartLine[]): number {
  return Math.round(
    lines.reduce((s, l) => s + l.priceUsd * l.qty, 0) * 100,
  ) / 100
}

async function readCart(voiceCallId: string): Promise<VoiceCart> {
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("voice_calls")
    .select("cart_lines_extracted")
    .eq("id", voiceCallId)
    .maybeSingle()
  const raw = data?.cart_lines_extracted as VoiceCart | null | undefined
  if (!raw || !Array.isArray(raw.lines)) return { ...EMPTY_CART }
  return raw
}

async function writeCart(voiceCallId: string, cart: VoiceCart): Promise<void> {
  const supa = getSupabaseAdmin()
  cart.subtotalUsd = computeSubtotal(cart.lines)
  await supa
    .from("voice_calls")
    .update({
      cart_lines_extracted: cart,
      subtotal_usd_extracted: cart.subtotalUsd,
    })
    .eq("id", voiceCallId)
}

// ────────────────────────────────────────────────────────────────────
// 1) search_menu · LLM consulta el menú para responder al cliente
// ────────────────────────────────────────────────────────────────────

export interface SearchMenuParams {
  query?: string
  /** Si query vacío · devuelve summary de todo el menú por categoría. */
  fullMenu?: boolean
}

export interface SearchMenuResult {
  ok: true
  query?: string
  results?: ReturnType<typeof searchMenu>
  fullMenu?: ReturnType<typeof summarizeMenu>
  todaysJuices?: Array<{ id: string; label: string }>
  hint?: string
}

export async function handleSearchMenu(
  params: SearchMenuParams,
): Promise<SearchMenuResult> {
  // Si pide fullMenu O query vacío · devolvemos el resumen completo.
  if (params.fullMenu || !params.query || params.query.trim().length === 0) {
    const todaysJuices = await fetchTodaysJuices()
    return {
      ok: true,
      fullMenu: summarizeMenu(),
      todaysJuices,
      hint: "Si el cliente pregunta por jugos · usá la lista de todaysJuices · son los sabores del día.",
    }
  }
  const results = searchMenu(params.query, 5)
  if (results.length === 0) {
    return {
      ok: true,
      query: params.query,
      results: [],
      hint:
        "Ningún ítem matcheó · sugerile al cliente las opciones más populares (Encebollado Náufrago $4 · Ceviche Náufrago $7) o pedile que reformule.",
    }
  }
  // Si el top hit usa dynamicVariantsKey · poblamos todaysJuices.
  const needsDynamic = results.some((r) => r.dynamicVariantsKey)
  const todaysJuices = needsDynamic ? await fetchTodaysJuices() : undefined
  return { ok: true, query: params.query, results, todaysJuices }
}

async function fetchTodaysJuices(): Promise<Array<{ id: string; label: string }>> {
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("dynamic_options")
    .select("options")
    .eq("key", "juice_flavors")
    .maybeSingle()
  const opts = data?.options as Array<{ id: string; label: string }> | undefined
  return Array.isArray(opts) ? opts : []
}

// ────────────────────────────────────────────────────────────────────
// 2) add_to_cart · LLM agrega items confirmados al carrito en curso
// ────────────────────────────────────────────────────────────────────

export interface AddToCartParams {
  items: Array<{
    menuItemId: string
    qty?: number
    variantId?: string
    /** Modificaciones dichas oralmente · "sin cebolla" · "extra camarón".
     *  Cada uno · {toggleId, action: "remove" | "extra"}. */
    customizations?: Array<{
      toggleId: string
      action: "remove" | "extra"
    }>
    notes?: string
  }>
}

export interface AddToCartResult {
  ok: boolean
  cart: VoiceCart
  added: Array<{ id: string; name: string; qty: number; priceUsd: number }>
  rejected: Array<{ menuItemId: string; reason: string }>
}

export async function handleAddToCart(
  voiceCallId: string,
  params: AddToCartParams,
): Promise<AddToCartResult> {
  const cart = await readCart(voiceCallId)
  const added: AddToCartResult["added"] = []
  const rejected: AddToCartResult["rejected"] = []

  for (const item of params.items) {
    const menu = getMenuItemById(item.menuItemId)
    if (!menu) {
      rejected.push({
        menuItemId: item.menuItemId,
        reason: "menu_item_not_found",
      })
      continue
    }
    const qty = Math.max(1, Math.min(99, item.qty ?? 1))

    // Variant resolution · si el ítem tiene variants estáticos
    // o dynamicVariantsKey · el LLM debió pasarnos variantId.
    let variantSuffix = ""
    let priceDelta = 0
    if (menu.variants && menu.variants.length > 0) {
      const v = menu.variants.find((x) => x.id === item.variantId)
      if (!v) {
        rejected.push({
          menuItemId: item.menuItemId,
          reason: "variant_required",
        })
        continue
      }
      variantSuffix = ` · ${v.label}`
      priceDelta += v.priceDelta
    }
    // Para dynamicVariantsKey (jugos sabor del día) la validación se
    // delega al LLM · solo persistimos el variantId que nos pase
    // como una customization libre.
    if (menu.dynamicVariantsKey && item.variantId) {
      variantSuffix = ` · ${item.variantId}`
    }

    // Customizations (toggles · sin X · extra X)
    const customizations: VoiceCartLine["customizations"] = []
    if (item.customizations && menu.toggles) {
      for (const c of item.customizations) {
        const toggle = menu.toggles.find((t) => t.id === c.toggleId)
        if (!toggle) continue
        if (c.action === "remove" && toggle.canRemove) {
          customizations.push({
            id: toggle.id,
            label: `Sin ${toggle.label.toLowerCase()}`,
            priceDelta: 0,
          })
        } else if (c.action === "extra") {
          customizations.push({
            id: toggle.id,
            label: `Extra ${toggle.label.toLowerCase()}`,
            priceDelta: toggle.extraPriceDelta,
          })
          priceDelta += toggle.extraPriceDelta
        }
      }
    }

    const linePrice =
      Math.round((menu.priceUsd + priceDelta) * 100) / 100
    const line: VoiceCartLine = {
      id: menu.id,
      name: `${menu.name}${variantSuffix}`,
      qty,
      priceUsd: linePrice,
      notes: item.notes,
      customizations: customizations.length > 0 ? customizations : undefined,
    }
    cart.lines.push(line)
    added.push({
      id: line.id,
      name: line.name,
      qty: line.qty,
      priceUsd: line.priceUsd,
    })
  }

  cart.subtotalUsd = computeSubtotal(cart.lines)
  await writeCart(voiceCallId, cart)
  return { ok: true, cart, added, rejected }
}

// ────────────────────────────────────────────────────────────────────
// 3) confirm_order · LLM cierra el pedido · crea naufrago.orders ·
//     transición a PENDING_LOCATION · dispara WhatsApp pidiendo
//     ubicación nativa al cliente
// ────────────────────────────────────────────────────────────────────

export interface ConfirmOrderResult {
  ok: boolean
  orderCode?: string
  orderId?: string
  totalUsd?: number
  status?: string
  message?: string
  error?: string
}

export async function handleConfirmOrder(
  voiceCallId: string,
): Promise<ConfirmOrderResult> {
  const supa = getSupabaseAdmin()
  const cart = await readCart(voiceCallId)
  if (cart.lines.length === 0) {
    return {
      ok: false,
      error: "cart_empty",
      message:
        "El carrito está vacío · no puedo confirmar el pedido. Pedile al cliente que diga al menos un ítem.",
    }
  }

  // Recupero datos del cliente del voice_call
  const { data: voiceCall } = await supa
    .from("voice_calls")
    .select("customer_name, customer_phone, auth_user_id, order_id")
    .eq("id", voiceCallId)
    .maybeSingle()

  if (!voiceCall) {
    return { ok: false, error: "voice_call_not_found" }
  }
  // Idempotency · si ya existe order_id · devolver el existente
  if (voiceCall.order_id) {
    const { data: existing } = await supa
      .from("orders")
      .select("order_code, total_usd, status")
      .eq("id", voiceCall.order_id)
      .maybeSingle()
    if (existing) {
      return {
        ok: true,
        orderId: voiceCall.order_id,
        orderCode: existing.order_code,
        totalUsd: existing.total_usd,
        status: existing.status,
        message: "Pedido ya confirmado · esperando ubicación por WhatsApp.",
      }
    }
  }

  const orderCode = generateOrderCode()
  const subtotalUsd = computeSubtotal(cart.lines)

  const { data: order, error: insertErr } = await supa
    .from("orders")
    .insert({
      order_code: orderCode,
      status: "PENDING_LOCATION",
      customer_name: voiceCall.customer_name,
      customer_phone: voiceCall.customer_phone,
      // dropoff_address obligatorio en schema · placeholder mientras
      // esperamos la ubicación real por WhatsApp · el courier no lo usa.
      dropoff_address: "PENDING_WHATSAPP_LOCATION_SHARE",
      cart_lines: cart.lines,
      subtotal_usd: subtotalUsd,
      delivery_fee_usd: 0,
      total_usd: subtotalUsd,
      payment_method: "CASH_ON_DELIVERY",
      payment_status: "PENDING",
      voice_call_id: voiceCallId,
    })
    .select("id, order_code, total_usd, status")
    .single()

  if (insertErr || !order) {
    return {
      ok: false,
      error: "order_insert_failed",
      message: insertErr?.message,
    }
  }

  // Link voice_call al order
  await supa
    .from("voice_calls")
    .update({ order_id: order.id })
    .eq("id", voiceCallId)

  // Disparo WhatsApp pidiendo ubicación nativa (fire-and-forget · NO
  // bloquea la respuesta al LLM para que cierre la llamada rápido)
  void dispatchLocationAsk(voiceCall.customer_phone, order.order_code).catch(
    () => {},
  )

  return {
    ok: true,
    orderId: order.id,
    orderCode: order.order_code,
    totalUsd: order.total_usd,
    status: order.status,
    message:
      "Pedido confirmado · le mandamos WhatsApp al cliente pidiendo que comparta su ubicación + un detalle de la entrega.",
  }
}

async function dispatchLocationAsk(
  customerPhone: string,
  orderCode: string,
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !fromWa) return

  const phone = customerPhone.replace(/^\+/, "")
  const message = [
    `Hola 🌊 tu pedido Náufrago ${orderCode} está confirmado.`,
    ``,
    `Ahora necesito 2 cosas para enviar el motorizado ·`,
    ``,
    `1) Compartí tu ubicación nativa · presioná 📎 (clip) → Ubicación → Enviar tu ubicación actual`,
    ``,
    `2) Después del pin · escribime un detalle extra · "entrando por la peatonal · timbre azul · etc"`,
    ``,
    `Si no hay detalle especial · respondé "ok".`,
  ].join("\n")

  const params = new URLSearchParams({
    To: `whatsapp:+${phone}`,
    From: fromWa,
    Body: message,
  })
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  await fetch(
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
}

// ────────────────────────────────────────────────────────────────────
// 4) cancel_order · cliente decide no pedir nada · cerrar el voice_call
//     como CUSTOMER_HANGUP sin crear order
// ────────────────────────────────────────────────────────────────────

export interface CancelOrderParams {
  reason?: string
}

export interface CancelOrderResult {
  ok: boolean
  message: string
}

export async function handleCancelOrder(
  voiceCallId: string,
  params: CancelOrderParams,
): Promise<CancelOrderResult> {
  const supa = getSupabaseAdmin()
  await supa
    .from("voice_calls")
    .update({
      status: "CUSTOMER_HANGUP",
      ended_at: new Date().toISOString(),
      cart_lines_extracted: { lines: [], subtotalUsd: 0 },
    })
    .eq("id", voiceCallId)
  return {
    ok: true,
    message:
      params.reason ?? "Cliente canceló · llamada cerrada sin pedido.",
  }
}
