import "server-only"
/**
 * Aviso a la cocina · R110.
 *
 * Hasta hoy, un pedido que entraba por la página se guardaba en la base y
 * NADIE en el local se enteraba. El único aviso por WhatsApp del recorrido
 * era para el CLIENTE. Con el reparto conectado eso significa un motorizado
 * real llegando por un pedido que nadie vio. Era el último eslabón suelto
 * para poder lanzar.
 *
 * Esto NO es el bot de conversación que quedó para más adelante · es un
 * aviso de UNA sola vía al WhatsApp del local, con el proveedor de
 * mensajería que ya está conectado y pago. No hay nada que contratar.
 *
 * Regla de oro · esto NUNCA puede tumbar un pedido. Si el aviso falla, el
 * pedido ya está guardado y el cliente ya recibió su confirmación. Por eso
 * todo está envuelto y devuelve un resultado en vez de tirar excepción, y
 * por eso se llama sin esperar respuesta desde la ruta.
 */

export interface PedidoParaCocina {
  orderCode: string
  customerName: string
  customerPhone: string
  dropoffAddress: string
  dropoffDetail?: string | null
  lines: Array<{ name: string; qty: number; priceUsd: number }>
  subtotalUsd: number
  deliveryFeeUsd: number
  totalUsd: number
  notes?: string | null
  /** Minutos que informó el repartidor · ausente si no lo dio. */
  etaMinutes?: number | null
  paymentMethod: string
}

const PAGOS: Record<string, string> = {
  CASH_ON_DELIVERY: "EFECTIVO contra entrega · COBRAR AL CLIENTE",
  WHATSAPP_MANUAL: "a coordinar por WhatsApp",
  CARD_CREDIT: "tarjeta de crédito (ya cobrado)",
  CARD_DEBIT: "tarjeta de débito (ya cobrado)",
  PAYPHONE: "PayPhone (ya cobrado)",
  GOOGLE_PAY: "Google Pay (ya cobrado)",
  APPLE_PAY: "Apple Pay (ya cobrado)",
}

/** Número del local · sin el "+", como lo quiere el proveedor. */
function numeroDelLocal(): string | null {
  const n =
    process.env.NAUFRAGO_ADMIN_WHATSAPP ??
    process.env.NAUFRAGO_KITCHEN_WHATSAPP ??
    null
  if (!n) return null
  const limpio = n.replace(/\D/g, "")
  return limpio.length >= 8 ? limpio : null
}

/**
 * El mensaje está pensado para leerse de un vistazo en el teléfono de la
 * cocina, con lo primero que hace falta arriba: qué cocinar. La plata y la
 * dirección van después · el motorizado las necesita, la cocina no.
 */
export function armarMensaje(p: PedidoParaCocina): string {
  const platos = p.lines
    .map((l) => `• ${l.qty}x ${l.name}`)
    .join("\n")
  const cobro = PAGOS[p.paymentMethod] ?? p.paymentMethod
  const partes = [
    `🛶 PEDIDO NUEVO · ${p.orderCode}`,
    "",
    platos,
  ]
  if (p.notes) partes.push("", `📝 Nota: ${p.notes}`)
  partes.push(
    "",
    `Cliente: ${p.customerName} · ${p.customerPhone}`,
    `Entrega: ${p.dropoffAddress}${p.dropoffDetail ? ` (${p.dropoffDetail})` : ""}`,
  )
  if (p.etaMinutes && p.etaMinutes > 0) {
    partes.push(`Motorizado: llega en ~${p.etaMinutes} min`)
  }
  partes.push(
    "",
    `Comida $${p.subtotalUsd.toFixed(2)} + envío $${p.deliveryFeeUsd.toFixed(2)} = TOTAL $${p.totalUsd.toFixed(2)}`,
    `Pago: ${cobro}`,
  )
  return partes.join("\n")
}

export type ResultadoAviso =
  | { ok: true; sid: string }
  | { ok: false; motivo: string }

/**
 * Manda el aviso. NUNCA tira excepción · devuelve el motivo y la ruta que
 * lo llama decide si lo registra. Un pedido no se cae porque un mensaje no
 * salga.
 */
export async function avisarACocina(
  p: PedidoParaCocina,
): Promise<ResultadoAviso> {
  const destino = numeroDelLocal()
  if (!destino) return { ok: false, motivo: "sin_numero_de_cocina" }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const desde = process.env.TWILIO_WHATSAPP_FROM
  if (!sid || !token || !desde) {
    return { ok: false, motivo: "mensajeria_sin_configurar" }
  }

  try {
    const params = new URLSearchParams({
      To: `whatsapp:+${destino}`,
      From: desde,
      Body: armarMensaje(p),
    })
    const auth = Buffer.from(`${sid}:${token}`).toString("base64")
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
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
      const detalle = await res.text().catch(() => "")
      return { ok: false, motivo: `mensajeria_${res.status}:${detalle.slice(0, 200)}` }
    }
    const data = (await res.json()) as { sid?: string }
    return { ok: true, sid: data.sid ?? "" }
  } catch (err) {
    return {
      ok: false,
      motivo: err instanceof Error ? err.message : String(err),
    }
  }
}
