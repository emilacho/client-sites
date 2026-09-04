/**
 * Loyalty server helpers · R96.21 · "Perlas del náufrago".
 *
 * 1 perla = $0.01.
 * La TASA no vive aca · vive en lib/perlas.ts, que es el unico lugar donde
 * esta escrita (R120). El servidor, el carrito y las preguntas frecuentes
 * leen de ahi para que no puedan decir numeros distintos.
 * Spend cap - 50% del subtotal (enforce server-side al confirmOrder).
 */
import { getSupabaseAdmin } from "@/lib/supabase"

export {
  PERLA_VALUE_USD,
  EARN_RATE,
  SPEND_CAP,
  PORCENTAJE_GANANCIA,
  perlasQueGana,
} from "@/lib/perlas"
import { EARN_RATE, PERLA_VALUE_USD } from "@/lib/perlas"
import { telefonoCanonico } from "@/lib/telefono"

/** R96.24 · multi-tier redemption catalog · pattern Domino's
 *  20/40/60 tiers · 3 rewards mixed (% off + free item). Cliente
 *  elige 1 reward por order · mutually exclusive con el spend
 *  directo. Backend debita perlas + persist reward_id en order. */
export type LoyaltyRewardType = "percent_off" | "free_item"

export interface LoyaltyReward {
  id: string
  cost: number  // en perlas
  type: LoyaltyRewardType
  label: string
  description: string
  /** percent_off · valor 0-100. free_item · undefined. */
  percentOff?: number
  /** free_item · item_id del MENU_ITEMS a agregar gratis. */
  freeItemId?: string
}

// R157 · el premio vive en `lib/perlas.ts` · un solo lugar para los dos
// lados. Acá sólo se re-exporta para no romper a quien ya lo importaba.
export { PERLAS_PARA_EL_PREMIO, PREMIOS_DEL_TESORO } from "@/lib/perlas"


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
  const ph = telefonoCanonico(phone)
  if (!ph || totalUsd <= 0) return null
  const earned = usdToPerlas(totalUsd * EARN_RATE)
  if (earned <= 0) return null

  const supa = getSupabaseAdmin()
  const reason = `earn:order:${orderCode}`

  // Idempotency check · si ya hay ledger entry con este reason · skip
  const { data: existing } = await supa
    .from("loyalty_ledger")
    .select("id")
    .eq("client_slug", "naufrago")
    .eq("phone", ph)
    .eq("reason", reason)
    .maybeSingle()
  if (existing) return null

  // Upsert balance · si no existe row · crear con perlas=earned
  const { data: current } = await supa
    .from("loyalty_balance")
    .select("perlas, earned_total")
    .eq("client_slug", "naufrago")
    .eq("phone", ph)
    .maybeSingle()

  const newPerlas = (current?.perlas ?? 0) + earned
  const newEarnedTotal = (current?.earned_total ?? 0) + earned

  await supa.from("loyalty_balance").upsert(
    {
      client_slug: "naufrago",
      phone: ph,
      perlas: newPerlas,
      earned_total: newEarnedTotal,
      spent_total: current ? undefined : 0,
    },
    { onConflict: "client_slug,phone" },
  )

  await supa.from("loyalty_ledger").insert({
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
  const ph = telefonoCanonico(phone)
  if (!ph || amount <= 0) return null

  const supa = getSupabaseAdmin()
  const { data: current } = await supa
    .from("loyalty_balance")
    .select("perlas, spent_total")
    .eq("client_slug", "naufrago")
    .eq("phone", ph)
    .maybeSingle()
  if (!current || current.perlas < amount) return null

  const newPerlas = current.perlas - amount
  const newSpentTotal = current.spent_total + amount

  await supa
    .from("loyalty_balance")
    .update({ perlas: newPerlas, spent_total: newSpentTotal })
    .eq("client_slug", "naufrago")
    .eq("phone", ph)

  await supa.from("loyalty_ledger").insert({
    client_slug: "naufrago",
    phone: ph,
    delta: -amount,
    reason: `spend:order:${orderCode}`,
    order_code: orderCode,
  })

  return { spent: amount, balance: newPerlas }
}
