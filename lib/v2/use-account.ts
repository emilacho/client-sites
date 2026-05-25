"use client"
/**
 * useAccount · R96.112 · client hook · GET /api/account/me al mount.
 * Devuelve { account, loading, refresh, logout }. Sin auth context global ·
 * componentes que necesiten esto lo importan directo.
 */
import { useCallback, useEffect, useState } from "react"

export interface AccountAddress {
  street?: string
  detail?: string | null
  lat?: number | null
  lng?: number | null
  country?: string | null
}

export interface AccountProfile {
  authenticated: true
  whatsapp: string
  name: string | null
  email: string | null
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
      const res = await fetch("/api/account/me", { credentials: "include" })
      const data = await res.json()
      if (data?.ok && data.authenticated) {
        setAccount(data as AccountProfile)
      } else {
        setAccount(null)
      }
    } catch {
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch("/api/account/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
    setAccount(null)
  }, [])

  useEffect(() => {
    void refresh()
    // R96.112 Fase B · refresh on tab focus · captura updates de
    // balance post-DELIVERED sin necesidad de realtime ws. Simple,
    // robusto, sin nueva infra.
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [refresh])

  return { account, loading, refresh, logout }
}
