"use client"
/**
 * useAccount · R96.113 · client hook · usa Supabase Auth (email magic
 * link / Google OAuth). Si hay session · pasa el access_token a
 * /api/account/me que resuelve el perfil del cliente (linked o nuevo).
 */
import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

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
        setAccount(data as AccountProfile)
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

  return { account, loading, refresh, logout }
}
