import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/orders/recent · R96.23 · social proof toasts data source.
 *
 * Devuelve últimos N orders (default 8) no-cancelled · anonymized ·
 * name → "Diego R." (first name + last initial) · cart_lines → first
 * item name. NO incluye phone/address/payment data.
 *
 * Si no hay orders reales · fallback con orders sintéticos
 * realistas para que la landing no se vea vacía pre-launch.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 60

interface CartLineLite {
  name?: string
  qty?: number
}

interface RecentOrder {
  initials: string  // "Diego R."
  firstItem: string
  city: string | null
  createdAt: string
  minutesAgo: number
}

const FALLBACK: RecentOrder[] = [
  { initials: "Diego R.", firstItem: "Ceviche Náufrago", city: "Manglaralto", createdAt: new Date(Date.now() - 12 * 60_000).toISOString(), minutesAgo: 12 },
  { initials: "María C.", firstItem: "Encebollado Náufrago", city: "Olón", createdAt: new Date(Date.now() - 26 * 60_000).toISOString(), minutesAgo: 26 },
  { initials: "Andrea P.", firstItem: "Patacones Náufrago", city: "Punta Blanca", createdAt: new Date(Date.now() - 43 * 60_000).toISOString(), minutesAgo: 43 },
  { initials: "Carlos M.", firstItem: "Ceviche Mixto", city: "Olón", createdAt: new Date(Date.now() - 58 * 60_000).toISOString(), minutesAgo: 58 },
  { initials: "Pablo G.", firstItem: "Encebollado Mixto", city: "Olón", createdAt: new Date(Date.now() - 71 * 60_000).toISOString(), minutesAgo: 71 },
]

function anonymizeName(full: string): string {
  if (!full) return "Un cliente"
  const parts = full.trim().split(/\s+/)
  const first = parts[0]
  const lastInitial = parts.length > 1 ? `${parts[1].charAt(0).toUpperCase()}.` : ""
  return `${first} ${lastInitial}`.trim()
}

export async function GET() {
  try {
    const supa = getSupabaseAdmin()
    const since = new Date(Date.now() - 4 * 3600_000).toISOString() // 4h window
    const { data: rows, error } = await supa
      .from("naufrago_orders")
      .select("customer_name, cart_lines, created_at, dropoff_address")
      .gte("created_at", since)
      .neq("status", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(8)

    if (error || !rows || rows.length === 0) {
      return NextResponse.json({ ok: true, orders: FALLBACK, source: "fallback" })
    }

    const now = Date.now()
    const orders: RecentOrder[] = rows
      .map((r) => {
        const createdMs = new Date(r.created_at).getTime()
        const minutesAgo = Math.max(1, Math.floor((now - createdMs) / 60_000))
        const lines = (r.cart_lines ?? []) as CartLineLite[]
        const firstItem = lines[0]?.name ?? "su pedido"
        // Try extract city from dropoff_address text
        const addr = (r.dropoff_address as string) ?? ""
        const cityMatch = addr.match(/(Olón|Manglaralto|Punta Blanca|Ayangue|Curía|Montañita|La Entrada|Salinas|Libertad)/i)
        return {
          initials: anonymizeName(r.customer_name ?? ""),
          firstItem,
          city: cityMatch?.[1] ?? null,
          createdAt: r.created_at,
          minutesAgo,
        }
      })
      .filter((o) => o.initials !== "Un cliente")

    if (orders.length === 0) {
      return NextResponse.json({ ok: true, orders: FALLBACK, source: "fallback" })
    }

    return NextResponse.json({ ok: true, orders, source: "live" })
  } catch {
    return NextResponse.json({ ok: true, orders: FALLBACK, source: "error" })
  }
}
