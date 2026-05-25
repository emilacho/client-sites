"use client"
/**
 * Browser-side Supabase client · R96.113. Para auth flows email magic
 * link + Google OAuth. NO usa service role key · solo anon key (público).
 * Singleton lazy · evita re-instanciar entre renders.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cached: SupabaseClient | null = null

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set",
    )
  }
  cached = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return cached
}
