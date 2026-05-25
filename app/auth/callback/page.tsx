"use client"
/**
 * /auth/callback · R96.113 · landing post-OAuth/magic link. Supabase-js
 * detecta el hash `#access_token=...` automáticamente y setea la
 * sesión · luego redirigimos a la home (o `next` query param si vino).
 */
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

export default function AuthCallback() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const supa = getSupabaseBrowser()
    // detectSessionInUrl=true se encarga de parsear el hash · solo
    // esperamos 1 tick a que la sesión quede persistida en storage.
    const { data: sub } = supa.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        const next = params.get("next") || "/"
        sub.subscription.unsubscribe()
        router.replace(next)
      }
    })
    // Fallback timeout · si nada pasa en 4s · redirige a home anyway.
    const timeout = window.setTimeout(() => {
      router.replace("/")
    }, 4000)
    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timeout)
    }
  }, [router, params])

  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-slate-950 text-slate-400">
      <p className="text-sm">Entrando a tu cuenta…</p>
    </main>
  )
}
