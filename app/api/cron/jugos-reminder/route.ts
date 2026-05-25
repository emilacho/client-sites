import type { NextRequest } from "next/server"
import { cliente } from "@/cliente.config"

/**
 * GET /api/cron/jugos-reminder · R96.139
 *
 * Vercel Cron · lunes 7am ECT = 12:00 UTC · weekly schedule en vercel.json.
 * Envía template WhatsApp a Emilio pidiendo los jugos disponibles.
 * Emilio responde con texto libre · el webhook /api/whatsapp/incoming parsea.
 *
 * Auth · Vercel Cron envía header `Authorization: Bearer ${CRON_SECRET}`.
 * Si no matchea · 401 (protección contra trigger externo).
 */

export const runtime = "nodejs"

const REMINDER_TEMPLATE = (
  weekday: string,
  date: string,
) => `🌊 Buen lunes Náufrago · ${weekday} ${date}

¿Qué jugos naturales tenés esta semana?

Respondé con los sabores · ejemplo ·
  "naranja y limón"
  "maracuyá, mora"
  "tamarindo + naranja"

Sabores disponibles · naranja · limón · maracuyá · mora · tamarindo`

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  const adminWa = process.env.NAUFRAGO_ADMIN_WHATSAPP ?? cliente.whatsappE164

  if (!accountSid || !authToken || !fromWa) {
    return Response.json({
      ok: true,
      sent: false,
      reason: "twilio_not_configured",
    })
  }

  const now = new Date()
  const weekday = now.toLocaleDateString("es-EC", {
    weekday: "long",
    timeZone: "America/Guayaquil",
  })
  const date = now.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Guayaquil",
  })

  try {
    const params = new URLSearchParams({
      To: `whatsapp:+${adminWa}`,
      From: fromWa,
      Body: REMINDER_TEMPLATE(weekday, date),
    })
    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
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
    return Response.json({ ok: true, sent: true, sid: data.sid })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
