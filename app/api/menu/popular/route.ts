import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { MENU_ITEMS, type MenuItem } from "@/lib/v2/naufrago-content"

/**
 * GET /api/menu/popular · R96.22 · top items últimos 30d.
 *
 * Aggregate from naufrago_orders.cart_lines · order qty desc · pick
 * top 3 distinct items con metadata enrichment (emoji + gradient).
 *
 * Fallback · si no hay data suficiente (cliente nuevo · <5 orders)
 * devolvemos pinned ranking · Encebollado Náufrago · Ceviche
 * Náufrago · Patacones Náufrago (los 3 platos signature).
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 300

const FALLBACK_IDS = [
  "encebollado-naufrago",
  "ceviche-naufrago",
  "patacones-naufrago",
]

interface CartLineLite {
  id: string
  qty: number
}

interface PopularItem {
  id: string
  name: string
  priceUsd: number
  emoji: string
  gradient: string
  totalQty: number
  category: string
}

function pickById(id: string): MenuItem | undefined {
  return MENU_ITEMS.find((m) => m.id === id)
}

function lineToPopular(
  id: string,
  totalQty: number,
): PopularItem | null {
  const item = pickById(id)
  if (!item) return null
  if (item.type === "service_fee") return null
  return {
    id: item.id,
    name: item.name,
    priceUsd: item.priceUsd,
    emoji: item.emoji,
    gradient: item.gradient,
    totalQty,
    category: item.category,
  }
}

export async function GET() {
  try {
    const supa = getSupabaseAdmin()
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data: rows, error } = await supa
      .from("orders")
      .select("cart_lines, created_at")
      .gte("created_at", since)
      .neq("status", "CANCELLED")
      .limit(500)

    if (error || !rows) {
      // DB unreachable · graceful fallback
      const fallback = FALLBACK_IDS.map((id) => lineToPopular(id, 0)).filter(
        (x): x is PopularItem => x !== null,
      )
      return NextResponse.json({ ok: true, items: fallback, source: "fallback" })
    }

    const tallies = new Map<string, number>()
    for (const r of rows) {
      const lines = (r.cart_lines ?? []) as CartLineLite[]
      for (const l of lines) {
        if (typeof l?.id !== "string") continue
        tallies.set(l.id, (tallies.get(l.id) ?? 0) + (l.qty ?? 1))
      }
    }

    const ranked = Array.from(tallies.entries())
      .map(([id, qty]) => lineToPopular(id, qty))
      .filter((x): x is PopularItem => x !== null)
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 3)

    if (ranked.length < 3) {
      // Pad with fallback to always return 3
      const have = new Set(ranked.map((r) => r.id))
      for (const id of FALLBACK_IDS) {
        if (ranked.length >= 3) break
        if (have.has(id)) continue
        const item = lineToPopular(id, 0)
        if (item) ranked.push(item)
      }
    }

    return NextResponse.json({
      ok: true,
      items: ranked,
      source: rows.length >= 5 ? "live" : "fallback",
      windowDays: 30,
    })
  } catch (err) {
    const fallback = FALLBACK_IDS.map((id) => lineToPopular(id, 0)).filter(
      (x): x is PopularItem => x !== null,
    )
    return NextResponse.json({
      ok: true,
      items: fallback,
      source: "error",
      error: err instanceof Error ? err.message : "unknown",
    })
  }
}
