import { clearCookieValue } from "@/lib/account-session"

/**
 * POST /api/account/logout · R96.112 · clear cookie. Sin server-side
 * session table · cookie es la única fuente · clear = end.
 */
export const runtime = "nodejs"

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearCookieValue() } },
  )
}
