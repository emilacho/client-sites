import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { OrderTracker, type OrderSnapshot } from "./OrderTracker"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface Props {
  params: Promise<{ order_code: string }>
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

export default async function OrderTrackerPage({ params }: Props) {
  const { order_code } = await params
  const snapshot = await fetchSnapshot(order_code)
  if (!snapshot || !snapshot.ok) {
    notFound()
  }
  return <OrderTracker initial={snapshot} orderCode={order_code} />
}
