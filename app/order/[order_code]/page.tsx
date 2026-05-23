import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { OrderTracker, type OrderSnapshot } from "./OrderTracker"
import { buildDemoSnapshot } from "@/lib/tracker/demo-fixture"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface Props {
  params: Promise<{ order_code: string }>
  searchParams: Promise<{ demo?: string }>
}

async function fetchSnapshot(orderCode: string): Promise<OrderSnapshot | null> {
  try {
    const h = await headers()
    const host = h.get("host") ?? "localhost:3000"
    const protocol = host.startsWith("localhost") ? "http" : "https"
    const res = await fetch(
      `${protocol}://${host}/api/orders/${encodeURIComponent(orderCode)}`,
      { cache: "no-store" },
    )
    if (!res.ok) return null
    return (await res.json()) as OrderSnapshot
  } catch {
    return null
  }
}

export default async function OrderTrackerPage({ params, searchParams }: Props) {
  const { order_code } = await params
  const { demo } = await searchParams

  // Demo mode · `/order/DEMO?demo=1|2|3|4|cancelled` · bypasea Supabase
  // y renderiza con fixture sintético. Útil para validar visual sin
  // crear órdenes reales. Only triggers when order_code = "DEMO".
  if (order_code.toUpperCase() === "DEMO" && demo) {
    const snapshot = buildDemoSnapshot(demo) as unknown as OrderSnapshot
    return <OrderTracker initial={snapshot} orderCode="DEMO-2026-PREVIEW" />
  }

  const snapshot = await fetchSnapshot(order_code)
  if (!snapshot || !snapshot.ok) {
    notFound()
  }
  return <OrderTracker initial={snapshot} orderCode={order_code} />
}
