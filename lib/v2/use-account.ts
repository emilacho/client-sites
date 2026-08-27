"use client"
/**
 * useAccount · R96.113 · client hook · usa Supabase Auth (email magic
 * link / Google OAuth). Si hay session · pasa el access_token a
 * /api/account/me que resuelve el perfil del cliente (linked o nuevo).
 */
import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabase-browser"
import { identify, track } from "@/lib/v2/posthog-track"

export interface AccountAddress {
  street?: string
  detail?: string | null
  lat?: number | null
  lng?: number | null
  country?: string | null
}

export interface AccountProfile {
  authenticated: true
  authUserId: string
  email: string | null
  whatsapp: string | null
  name: string | null
  addresses: AccountAddress[]
  preferences: string | null
  totalOrders: number
  totalSpendUsd: number
  firstOrderAt: string | null
  lastOrderAt: string | null
  perlas: number
  earnedTotal: number
  spentTotal: number
}

export function useAccount(): {
  account: AccountProfile | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  logoutAllDevices: () => Promise<void>
} {
  const [account, setAccount] = useState<AccountProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const supa = getSupabaseBrowser()
      const { data: { session } } = await supa.auth.getSession()
      if (!session?.access_token) {
        setAccount(null)
        return
      }
      const res = await fetch("/api/account/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data?.ok && data.authenticated) {
        const next = data as AccountProfile
        setAccount(next)
        // R96.134 · identify post-login para attribution funnel.
        identify(next.authUserId, {
          email: next.email,
          whatsapp_set: !!next.whatsapp,
          total_orders: next.totalOrders,
        })
        track("login_completed", {
          method: next.email ? "email_or_google" : "unknown",
          has_whatsapp: !!next.whatsapp,
        })
      } else {
        setAccount(null)
      }
    } catch (err) {
      console.error("[useAccount] refresh error", err)
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const supa = getSupabaseBrowser()
      await supa.auth.signOut()
    } catch {
      // ignore
    }
    setAccount(null)
  }, [])

  // R96.119 · Cerrar sesión en TODOS los devices · scope global invalida
  // todos los refresh_tokens del user · útil si perdió un device.
  const logoutAllDevices = useCallback(async () => {
    try {
      const supa = getSupabaseBrowser()
      await supa.auth.signOut({ scope: "global" })
    } catch (err) {
      console.error("[useAccount] logoutAll error", err)
    }
    setAccount(null)
  }, [])

  useEffect(() => {
    void refresh()
    const supa = getSupabaseBrowser()
    const { data: sub } = supa.auth.onAuthStateChange(() => {
      void refresh()
    })
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => {
      sub.subscription.unsubscribe()
      window.removeEventListener("focus", onFocus)
    }
  }, [refresh])

  // R96.119 + R97.2 · realtime sub al balance de perlas · si el cliente
  // tiene whatsapp_e164 · subscribe a UPDATE en naufrago.loyalty_balance
  // filtered por phone · al recibir un cambio · refresh el account.
  // Útil para que el chip perlas se actualice al instante post-DELIVERED.
  useEffect(() => {
    if (!account?.whatsapp) return
    const supa = getSupabaseBrowser()
    const channel = supa
      .channel(`loyalty-${account.whatsapp}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "naufrago",
          table: "loyalty_balance",
          filter: `phone=eq.${account.whatsapp}`,
        },
        () => {
          void refresh()
        },
      )
      .subscribe()
    return () => {
      void supa.removeChannel(channel)
    }
  }, [account?.whatsapp, refresh])

  return { account, loading, refresh, logout, logoutAllDevices }
}
