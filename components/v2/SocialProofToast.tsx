"use client"
/**
 * SocialProofToast · R96.23 · pattern Amazon "recently purchased"
 * adaptado Náufrago. Toast bottom-center cada ~10s rotando entre
 * orders recientes anonymizados.
 *
 * UX ·
 *  - Aparece después de 8s del mount (no spam al landing inicial)
 *  - 1 toast a la vez · 5s visible + fade out + delay 4s · next
 *  - Auto-pausa si usuario abre menu o cart (no compite con focus)
 *  - Dismissible · click × esconde permanente para la sesión
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ShoppingBag, X } from "lucide-react"

interface RecentOrder {
  initials: string
  firstItem: string
  city: string | null
  createdAt: string
  minutesAgo: number
}

const INITIAL_DELAY_MS = 8_000
const VISIBLE_MS = 5_000
const GAP_MS = 4_000

export function SocialProofToast({ paused = false }: { paused?: boolean }) {
  const [orders, setOrders] = useState<RecentOrder[]>([])
  const [index, setIndex] = useState(0)
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionStorage.getItem("nf:proof-dismissed") === "1") {
      setDismissed(true)
      return
    }
    fetch("/api/orders/recent")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.orders) && data.orders.length > 0) {
          setOrders(data.orders)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (orders.length === 0 || dismissed || paused) {
      setShow(false)
      return
    }
    let visibleTimer: number | null = null
    let gapTimer: number | null = null
    const startTimer = window.setTimeout(() => {
      const cycle = () => {
        setShow(true)
        visibleTimer = window.setTimeout(() => {
          setShow(false)
          gapTimer = window.setTimeout(() => {
            setIndex((i) => (i + 1) % orders.length)
            cycle()
          }, GAP_MS)
        }, VISIBLE_MS)
      }
      cycle()
    }, INITIAL_DELAY_MS)
    return () => {
      window.clearTimeout(startTimer)
      if (visibleTimer) window.clearTimeout(visibleTimer)
      if (gapTimer) window.clearTimeout(gapTimer)
    }
  }, [orders, dismissed, paused])

  const current = orders[index]
  if (dismissed || !current) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem("nf:proof-dismissed", "1")
    } catch {}
  }

  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          key={`${current.initials}-${index}`}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-auto fixed bottom-4 left-1/2 z-30 flex max-w-[92vw] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur-md sm:max-w-md"
          role="status"
          aria-live="polite"
        >
          <span
            aria-hidden
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1 text-[12px]">
            <p className="leading-snug text-slate-100">
              <strong className="text-emerald-200">{current.initials}</strong>{" "}
              acaba de pedir <strong>{current.firstItem}</strong>
            </p>
            <p className="font-mono text-[10px] text-slate-400">
              hace {current.minutesAgo} min
              {current.city ? ` · 📍 ${current.city}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
