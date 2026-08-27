import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// R97.2 · type generic refleja schema naufrago (default db schema).
// `any` para Database porque no generamos types desde la base ·
// PostgrestVersion constraint no se satisface con unknown.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NaufragoSupabaseClient = SupabaseClient<any, "naufrago">

let cached: NaufragoSupabaseClient | null = null

/**
 * Server-side Supabase client using the service role key. NEVER expose this
 * to the browser · routes that need write access should import it directly.
 *
 * R97.2 · default schema = 'naufrago' (schema isolation migration). Todas
 * las queries del landing usan tablas de ese namespace · cross-schema
 * access requiere `.schema("public")` explícito (auth/storage/etc).
 */
export function getSupabaseAdmin(): NaufragoSupabaseClient {
  if (cached) return cached
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
  }
  cached = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "naufrago" },
  })
  return cached
}
