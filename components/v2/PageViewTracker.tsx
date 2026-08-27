"use client"
/**
 * PageViewTracker · R96.135 · dispara $pageview en cada navegación.
 * Mount-once en el root layout client side. Watch usePathname + useSearchParams
 * para capturar SPA navigations · no solo el primer paint.
 */
import { useEffect, Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { pageview } from "@/lib/v2/posthog-track"

function Tracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname) return
    const search = searchParams.toString()
    pageview({
      $pathname: pathname,
      $search: search ? `?${search}` : undefined,
    })
  }, [pathname, searchParams])

  return null
}

export default function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  )
}
