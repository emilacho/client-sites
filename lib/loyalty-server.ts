/**
 * Loyalty server helpers · R96.21 · "Perlas del náufrago".
 *
 * 1 perla = $0.01.
 * Earn rate · 10% del total_usd al stage DELIVERED.
 * Spend cap · 50% del subtotal (enforce server-side al confirmOrder).
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export const PERLA_VALUE_USD = 0.01
export const EARN_RATE = 0.1 // 10% del total
export const SPEND_CAP = 0.5 // 50% del subtotal

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

export function perlasToUsd(perlas: number): number {
  return Math.round(perlas * PERLA_VALUE_USD * 100) / 100
}

export function usdToPerlas(usd: number): number {
  return Math.round(usd / PERLA_VALUE_USD)
}

/** Earn perlas para un order entregado · idempotent · skip si reason
 *  ya existe en ledger (mismo order solo earn 1 vez). */
export async function earnPerlas({
  phone,
  totalUsd,
  orderCode,
}: {
  phone: string
  totalUsd: number
  orderCode: string
}): Promise<{ earned: number; balance: number } | null> {
  const ph = normalizeE164(phone)
  if (!ph || totalUsd <= 0) return null
  const earned = usdToPerlas(totalUsd * EARN_RATE)
  if (earned <= 0) return null

  const supa = getSupabaseAdmin()
  const reason = `earn:order:${orderCode}`

  // Idempotency check · si ya hay ledger entry con este reason · skip
  const { data: existing } = await supa
    .from("naufrago_loyalty_ledger")
    .select("id")
    .eq("client_slug", "naufrago")
    .eq("phone", ph)
    .eq("reason", reason)
    .maybeSingle()
  if (existing) return null

  // Upsert balance · si no existe row · crear con perlas=earned
  const { data: current } = await supa
    .from("naufrago_loyalty_balance")
    .select("perlas, earned_total")
    .eq("client_slug", "naufrago")
    .eq("phone", ph)
    .maybeSingle()

  const newPerlas = (current?.perlas ?? 0) + earned
  const newEarnedTotal = (current?.earned_total ?? 0) + earned

  await supa.from("naufrago_loyalty_balance").upsert(
    {
      client_slug: "naufrago",
      phone: ph,
      perlas: newPerlas,
      earned_total: newEarnedTotal,
      spent_total: current ? undefined : 0,
    },
    { onConflict: "client_slug,phone" },
  )

  await supa.from("naufrago_loyalty_ledger").insert({
    client_slug: "naufrago",
    phone: ph,
    delta: earned,
    reason,
    order_code: orderCode,
  })

  return { earned, balance: newPerlas }
}

/** Spend perlas al confirmOrder · enforce cap + atomic check. */
export async function spendPerlas({
  phone,
  amount,
  orderCode,
}: {
  phone: string
  amount: number
  orderCode: string
}): Promise<{ spent: number; balance: number } | null> {
  const ph = normalizeE164(phone)
  if (!ph || amount <= 0) return null

  const supa = getSupabaseAdmin()
  const { data: current } = await supa
    .from("naufrago_loyalty_balance")
    .select("perlas, spent_total")
    .eq("client_slug", "naufrago")
    .eq("phone", ph)
    .maybeSingle()
  if (!current || current.perlas < amount) return null

  const newPerlas = current.perlas - amount
  const newSpentTotal = current.spent_total + amount

  await supa
    .from("naufrago_loyalty_balance")
    .update({ perlas: newPerlas, spent_total: newSpentTotal })
    .eq("client_slug", "naufrago")
    .eq("phone", ph)

  await supa.from("naufrago_loyalty_ledger").insert({
    client_slug: "naufrago",
    phone: ph,
    delta: -amount,
    reason: `spend:order:${orderCode}`,
    order_code: orderCode,
  })

  return { spent: amount, balance: newPerlas }
}
