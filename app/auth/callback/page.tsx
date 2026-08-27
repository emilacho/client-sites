"use client"
/**
 * /auth/callback · R96.113 · landing post-OAuth/magic link. Supabase-js
 * detecta el hash `#access_token=...` automáticamente y setea la
 * sesión · luego redirigimos a la home (o `next` query param si vino).
 *
 * R96.114 · useSearchParams wrapped in Suspense per Next 15 SSG requirement.
 */
import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

function CallbackInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const supa = getSupabaseBrowser()
    const { data: sub } = supa.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        const next = params.get("next") || "/"
        sub.subscription.unsubscribe()
        router.replace(next)
      }
    })
    const timeout = window.setTimeout(() => {
      router.replace("/")
    }, 4000)
    return () => {
      sub.subscription.unsubscribe()
      window.clearTimeout(timeout)
    }
  }, [router, params])

  return <p className="text-sm">Entrando a tu cuenta…</p>
}

export default function AuthCallback() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-slate-950 text-slate-400">
      <Suspense fallback={<p className="text-sm">Entrando a tu cuenta…</p>}>
        <CallbackInner />
      </Suspense>
    </main>
  )
}
