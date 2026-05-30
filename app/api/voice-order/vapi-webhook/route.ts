import type { NextRequest } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase"
import {
  handleSearchMenu,
  handleAddToCart,
  handleConfirmOrder,
  handleCancelOrder,
} from "@/lib/voice/vapi-tools"

/**
 * POST /api/voice-order/vapi-webhook · R97.3 · Fase 2
 *
 * Receiver de eventos Vapi durante una llamada de voz IA. Vapi POSTea
 * mensajes con shape { message: { type, ...payload } } · enrutamos por
 * message.type ·
 *
 *   - "status-update"      → update voice_calls timestamps + status
 *   - "transcript"         → append a voice_calls.transcript (jsonb)
 *   - "function-call"      → ejecutar function tool + devolver result
 *                            (legacy Vapi format · 1 function por request)
 *   - "tool-calls"         → idem · pero formato nuevo Vapi · array de
 *                            toolCalls · respondemos con results array
 *   - "end-of-call-report" → cierre · transcript final + cost + duration
 *
 * Signature validation · si VAPI_WEBHOOK_SECRET está seteado · validamos
 * el header X-Vapi-Signature (HMAC-SHA256 del body). Sin secret · skip
 * verification (dev mode).
 *
 * Idempotency · Vapi puede retry eventos · usamos vapi_call_id +
 * timestamp para dedup en el log de transcripts.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface VapiMessage {
  type?: string
  call?: {
    id?: string
    metadata?: { voiceCallId?: string; clientSlug?: string }
  }
  // function-call (legacy)
  functionCall?: {
    name?: string
    parameters?: unknown
  }
  // tool-calls (current)
  toolCalls?: Array<{
    id?: string
    function?: { name?: string; arguments?: string }
  }>
  // status-update
  status?: string
  // transcript
  transcript?: string
  role?: "user" | "assistant" | "system"
  // end-of-call-report
  endedReason?: string
  cost?: number
  durationSeconds?: number
  recordingUrl?: string
}

interface VapiWebhookBody {
  message?: VapiMessage
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET
  if (!secret) return true // dev mode · skip
  if (!signatureHeader) return false
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  try {
    const a = Buffer.from(expected, "hex")
    const b = Buffer.from(signatureHeader.replace(/^sha256=/, ""), "hex")
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get("x-vapi-signature")

  if (!verifySignature(rawBody, sig)) {
    return Response.json(
      { ok: false, error: "invalid_signature" },
      { status: 401 },
    )
  }

  let body: VapiWebhookBody
  try {
    body = JSON.parse(rawBody) as VapiWebhookBody
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const msg = body.message
  if (!msg) {
    return Response.json({ ok: true, ignored: "no_message" })
  }

  const voiceCallId = msg.call?.metadata?.voiceCallId

  // Sin voiceCallId no podemos asociar el evento a la fila correcta.
  // Aún así · respondemos 200 · evitar que Vapi haga retry exponencial.
  if (!voiceCallId) {
    return Response.json({ ok: true, ignored: "no_voiceCallId_in_metadata" })
  }

  switch (msg.type) {
    case "status-update":
      return handleStatusUpdate(voiceCallId, msg)
    case "transcript":
      return handleTranscript(voiceCallId, msg)
    case "function-call":
      return handleLegacyFunctionCall(voiceCallId, msg)
    case "tool-calls":
      return handleToolCalls(voiceCallId, msg)
    case "end-of-call-report":
      return handleEndOfCall(voiceCallId, msg, rawBody)
    default:
      return Response.json({ ok: true, ignored: msg.type ?? "unknown_type" })
  }
}

// ────────────────────────────────────────────────────────────────────
// status-update handler
// ────────────────────────────────────────────────────────────────────
async function handleStatusUpdate(
  voiceCallId: string,
  msg: VapiMessage,
): Promise<Response> {
  const supa = getSupabaseAdmin()
  const patch: Record<string, unknown> = {}
  switch (msg.status) {
    case "in-progress":
      patch.status = "IN_PROGRESS"
      patch.answered_at = new Date().toISOString()
      break
    case "ended":
      patch.ended_at = new Date().toISOString()
      break
    case "ringing":
      patch.status = "DIALING"
      break
    default:
      // status no relevante · no-op
      return Response.json({ ok: true, ignored_status: msg.status })
  }
  await supa.from("voice_calls").update(patch).eq("id", voiceCallId)
  return Response.json({ ok: true })
}

// ────────────────────────────────────────────────────────────────────
// transcript handler · append al jsonb · NO upsert (acumulamos)
// ────────────────────────────────────────────────────────────────────
async function handleTranscript(
  voiceCallId: string,
  msg: VapiMessage,
): Promise<Response> {
  if (!msg.transcript || !msg.role) {
    return Response.json({ ok: true, ignored: "transcript_missing_fields" })
  }
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("voice_calls")
    .select("transcript")
    .eq("id", voiceCallId)
    .maybeSingle()
  const existing =
    Array.isArray(data?.transcript)
      ? (data.transcript as Array<{ role: string; text: string; at: string }>)
      : []
  existing.push({
    role: msg.role,
    text: msg.transcript,
    at: new Date().toISOString(),
  })
  await supa
    .from("voice_calls")
    .update({ transcript: existing })
    .eq("id", voiceCallId)
  return Response.json({ ok: true })
}

// ────────────────────────────────────────────────────────────────────
// function-call (legacy Vapi format) handler
// ────────────────────────────────────────────────────────────────────
async function handleLegacyFunctionCall(
  voiceCallId: string,
  msg: VapiMessage,
): Promise<Response> {
  const fc = msg.functionCall
  if (!fc?.name) {
    return Response.json(
      { ok: false, error: "no_function_name" },
      { status: 400 },
    )
  }
  const result = await runTool(
    voiceCallId,
    fc.name,
    (fc.parameters ?? {}) as Record<string, unknown>,
  )
  return Response.json({ result })
}

// ────────────────────────────────────────────────────────────────────
// tool-calls (current Vapi format) handler · responde con results array
// ────────────────────────────────────────────────────────────────────
async function handleToolCalls(
  voiceCallId: string,
  msg: VapiMessage,
): Promise<Response> {
  const calls = msg.toolCalls ?? []
  const results = []
  for (const call of calls) {
    const name = call.function?.name
    if (!name) {
      results.push({
        toolCallId: call.id,
        result: { ok: false, error: "no_function_name" },
      })
      continue
    }
    let args: Record<string, unknown> = {}
    try {
      args = call.function?.arguments
        ? (JSON.parse(call.function.arguments) as Record<string, unknown>)
        : {}
    } catch {
      // ignore parse error · pass empty args
    }
    const result = await runTool(voiceCallId, name, args)
    results.push({ toolCallId: call.id, result })
  }
  return Response.json({ results })
}

// ────────────────────────────────────────────────────────────────────
// Dispatcher único de los 4 tools
// ────────────────────────────────────────────────────────────────────
async function runTool(
  voiceCallId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_menu":
      return handleSearchMenu(args as unknown as Parameters<typeof handleSearchMenu>[0])
    case "add_to_cart":
      return handleAddToCart(
        voiceCallId,
        args as unknown as Parameters<typeof handleAddToCart>[1],
      )
    case "confirm_order":
      return handleConfirmOrder(voiceCallId)
    case "cancel_order":
      return handleCancelOrder(
        voiceCallId,
        args as unknown as Parameters<typeof handleCancelOrder>[1],
      )
    default:
      return { ok: false, error: "unknown_tool", tool: name }
  }
}

// ────────────────────────────────────────────────────────────────────
// end-of-call-report handler · persistir duration + cost + raw payload
// ────────────────────────────────────────────────────────────────────
async function handleEndOfCall(
  voiceCallId: string,
  msg: VapiMessage,
  rawBody: string,
): Promise<Response> {
  const supa = getSupabaseAdmin()
  const patch: Record<string, unknown> = {
    ended_at: new Date().toISOString(),
  }
  if (typeof msg.cost === "number") patch.cost_usd = msg.cost
  if (typeof msg.durationSeconds === "number")
    patch.duration_seconds = Math.round(msg.durationSeconds)

  // status final · si hay order_id linkeado · COMPLETED · sino derivar
  // del endedReason
  const { data: voiceCall } = await supa
    .from("voice_calls")
    .select("order_id, status")
    .eq("id", voiceCallId)
    .maybeSingle()

  if (voiceCall?.order_id) {
    patch.status = "COMPLETED"
  } else if (msg.endedReason === "customer-ended-call") {
    patch.status = "CUSTOMER_HANGUP"
  } else if (msg.endedReason === "silence-timed-out") {
    patch.status = "NO_ANSWER"
  } else if (voiceCall?.status !== "COMPLETED") {
    patch.status = "FAILED"
  }

  patch.raw_end_payload = safeJsonParse(rawBody)
  await supa.from("voice_calls").update(patch).eq("id", voiceCallId)
  return Response.json({ ok: true })
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return { raw: s.slice(0, 2000) }
  }
}
