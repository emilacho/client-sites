import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/voice-order/initiate · R97.1 · Fase 1
 *
 * Inicia una llamada de voz IA hacia el cliente vía Vapi. Crea fila
 * en naufrago_voice_calls antes de llamar al API externo · si Vapi
 * no está configurado · degrada gracefully a PENDING_OPERATOR (un
 * humano hará follow-up · sin romper la UX del cliente).
 *
 * Body · { phone, name, authUserId?, source? }
 * Response · { ok, voiceCallId, willCallBack, reason? }
 *
 * Env vars opcionales (sin estas · fallback graceful) ·
 *  - VAPI_API_KEY · server key del proyecto Vapi
 *  - VAPI_ASSISTANT_ID · assistant pre-configurado con prompt Náufrago
 *  - VAPI_PHONE_NUMBER_ID · número Twilio outbound conectado a Vapi
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"

interface Body {
  phone?: unknown
  name?: unknown
  authUserId?: unknown
  source?: unknown
}

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const rawName = typeof body.name === "string" ? body.name.trim() : ""
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : ""
  const authUserId = typeof body.authUserId === "string" ? body.authUserId : null
  const source = typeof body.source === "string" ? body.source : "landing_button"

  if (!rawName || rawName.length < 2) {
    return Response.json(
      { ok: false, error: "invalid_name" },
      { status: 400 },
    )
  }
  const phone = normalizeE164(rawPhone)
  if (!phone) {
    return Response.json(
      { ok: false, error: "invalid_phone" },
      { status: 400 },
    )
  }

  const supa = getSupabaseAdmin()

  // Insert primero · status INITIATING · para tener row aunque Vapi falle.
  const { data: inserted, error: insertErr } = await supa
    .from("naufrago_voice_calls")
    .insert({
      client_slug: CLIENT_SLUG,
      customer_name: rawName.slice(0, 100),
      customer_phone: phone,
      auth_user_id: authUserId,
      status: "INITIATING",
    })
    .select("id")
    .single()

  if (insertErr || !inserted) {
    return Response.json(
      { ok: false, error: "db_insert_failed", detail: insertErr?.message },
      { status: 500 },
    )
  }
  const voiceCallId = inserted.id as string

  const vapiApiKey = process.env.VAPI_API_KEY
  const vapiAssistantId = process.env.VAPI_ASSISTANT_ID
  const vapiPhoneNumberId = process.env.VAPI_PHONE_NUMBER_ID

  // ─── Graceful fallback · si Vapi no está configurado · marca
  // PENDING_OPERATOR · operación manual del staff. Cliente recibe
  // confirmación de que lo van a llamar (UX no se rompe).
  if (!vapiApiKey || !vapiAssistantId || !vapiPhoneNumberId) {
    await supa
      .from("naufrago_voice_calls")
      .update({ status: "PENDING_OPERATOR" })
      .eq("id", voiceCallId)
    return Response.json({
      ok: true,
      voiceCallId,
      willCallBack: true,
      reason: "vapi_not_configured",
      message: "Te llamamos en minutos · estamos coordinando",
    })
  }

  // ─── Vapi call API · POST /call con assistantId + customer phone.
  try {
    const vapiRes = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId: vapiAssistantId,
        phoneNumberId: vapiPhoneNumberId,
        customer: {
          number: `+${phone}`,
          name: rawName.slice(0, 100),
        },
        // Pasamos metadata para que el webhook Vapi sepa qué row actualizar.
        metadata: {
          voiceCallId,
          source,
          clientSlug: CLIENT_SLUG,
        },
      }),
    })

    const vapiData = (await vapiRes.json().catch(() => ({}))) as {
      id?: string
      status?: string
      message?: string
    }

    if (!vapiRes.ok) {
      await supa
        .from("naufrago_voice_calls")
        .update({
          status: "FAILED",
          raw_initiate_response: vapiData,
        })
        .eq("id", voiceCallId)
      return Response.json(
        {
          ok: false,
          voiceCallId,
          error: "vapi_error",
          status: vapiRes.status,
          detail: vapiData.message ?? "vapi rejected the call",
        },
        { status: 502 },
      )
    }

    await supa
      .from("naufrago_voice_calls")
      .update({
        status: "DIALING",
        vapi_call_id: vapiData.id ?? null,
        vapi_assistant_id: vapiAssistantId,
        vapi_phone_number_id: vapiPhoneNumberId,
        dialing_at: new Date().toISOString(),
        raw_initiate_response: vapiData,
      })
      .eq("id", voiceCallId)

    return Response.json({
      ok: true,
      voiceCallId,
      vapiCallId: vapiData.id ?? null,
      willCallBack: true,
      message: "Te llamamos en segundos · contestá cuando suene",
    })
  } catch (err) {
    await supa
      .from("naufrago_voice_calls")
      .update({
        status: "FAILED",
        raw_initiate_response: {
          error: err instanceof Error ? err.message : "unknown",
        },
      })
      .eq("id", voiceCallId)
    return Response.json(
      {
        ok: false,
        voiceCallId,
        error: "vapi_network_error",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    )
  }
}
