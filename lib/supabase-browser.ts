"use client"
/**
 * Browser-side Supabase client · R96.113. Para auth flows email magic
 * link + Google OAuth. NO usa service role key · solo anon key (público).
 * Singleton lazy · evita re-instanciar entre renders.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// R97.2 · type generic refleja schema naufrago (default db schema).
// `any` para Database porque no generamos types desde la base ·
// PostgrestVersion constraint no se satisface con unknown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NaufragoBrowserClient = SupabaseClient<any, "naufrago">

let cached: NaufragoBrowserClient | null = null

export function getSupabaseBrowser(): NaufragoBrowserClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    )
  }
  // R97.2 · default schema = 'naufrago' (schema isolation migration).
  // Las queries cliente-side del landing solo tocan tablas del cliente
  // piloto · auth flow vive en el namespace dedicado de Supabase Auth
  // (supabase.auth.*) y no requiere schema config.
  cached = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: { schema: "naufrago" },
  })
  return cached
}
