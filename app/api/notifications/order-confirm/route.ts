import type { NextRequest } from "next/server"

/**
 * POST /api/notifications/order-confirm · R96.14 · WhatsApp confirm
 * post-PedidosYa-order. Twilio WhatsApp API (env vars TWILIO_*).
 *
 * Gracefully degrades · si las env vars no están set · devuelve OK
 * con `sent:false` sin crash · permite landing en preview sin keys
 * (CLAUDE.md stack canon · Twilio wrapper merged · keys pending
 * populate por Emilio).
 *
 * Body · { orderCode, customerPhone, trackingUrl, totalUsd, itemCount }
 *
 * Output cliente · texto WhatsApp ·
 *   "¡Hola! Tu pedido NF-2026-XXXXXX está confirmado · X platos ·
 *   $YY.YY. Seguilo en vivo aquí · <trackingUrl>"
 */

export const runtime = "nodejs"

interface Body {
  orderCode?: unknown
  customerPhone?: unknown
  trackingUrl?: unknown
  totalUsd?: unknown
  itemCount?: unknown
}

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

function buildMessage(p: {
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
    `Seguilo en vivo · ${p.trackingUrl}`,
  ].join("\n")
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const orderCode = typeof body.orderCode === "string" ? body.orderCode : ""
  const customerPhoneRaw =
    typeof body.customerPhone === "string" ? body.customerPhone : ""
  const trackingUrl =
    typeof body.trackingUrl === "string" ? body.trackingUrl : ""
  const totalUsd = typeof body.totalUsd === "number" ? body.totalUsd : 0
  const itemCount = typeof body.itemCount === "number" ? body.itemCount : 0

  if (!orderCode || !customerPhoneRaw || !trackingUrl) {
    return Response.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    )
  }

  const customerPhone = normalizeE164(customerPhoneRaw)
  if (!customerPhone) {
    return Response.json(
      { ok: false, error: "invalid_phone" },
      { status: 400 },
    )
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM // e.g. "whatsapp:+14155238886"

  if (!accountSid || !authToken || !fromWa) {
    // Gracefully degrade · log + return success-not-sent · UI doesn't
    // need to error out · just no message goes out.
    return Response.json({
      ok: true,
      sent: false,
      reason: "twilio_not_configured",
    })
  }

  const message = buildMessage({ orderCode, trackingUrl, totalUsd, itemCount })

  try {
    const params = new URLSearchParams({
      To: `whatsapp:+${customerPhone}`,
      From: fromWa,
      Body: message,
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
        {
          ok: false,
          error: "twilio_error",
          status: res.status,
          detail: detail.slice(0, 300),
        },
        { status: 502 },
      )
    }
    const data = (await res.json()) as { sid?: string }
    return Response.json({ ok: true, sent: true, sid: data.sid ?? null })
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    )
  }
}
