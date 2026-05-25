/**
 * Account session · R96.112 · cookie HTTP-only firmada HMAC-SHA256
 * con payload mínimo `{ whatsapp, iat }`. Sin JWT estándar para evitar
 * deps · LATAM WhatsApp-shops pattern.
 *
 * - 90 días TTL · refresh on each /me hit (no-op por ahora).
 * - Compromiso secret rotation · ACCOUNT_SESSION_SECRET env.
 * - Sin JWT lib · base64url + HMAC bastante para nuestro threat model.
 */
import { createHmac, timingSafeEqual } from "node:crypto"

const SECRET = process.env.ACCOUNT_SESSION_SECRET ?? "naufrago-dev-secret-rotate"
const TTL_MS = 90 * 24 * 3600_000
export const COOKIE_NAME = "naufrago_session"

function b64url(buf: Buffer | string): string {
  return (typeof buf === "string" ? Buffer.from(buf) : buf)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function unb64url(s: string): Buffer {
  const pad = "=".repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/") + pad,
    "base64",
  )
}

export interface AccountSession {
  whatsapp: string
  iat: number
}

export function signSession(payload: { whatsapp: string }): string {
  const json = JSON.stringify({ whatsapp: payload.whatsapp, iat: Date.now() })
  const data = b64url(json)
  const sig = b64url(createHmac("sha256", SECRET).update(data).digest())
  return `${data}.${sig}`
}

export function verifySession(token: string | undefined | null): AccountSession | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [data, sig] = parts
  const expectedSig = b64url(createHmac("sha256", SECRET).update(data).digest())
  if (sig.length !== expectedSig.length) return null
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(unb64url(data).toString()) as AccountSession
    if (typeof parsed.whatsapp !== "string" || typeof parsed.iat !== "number") {
      return null
    }
    if (Date.now() - parsed.iat > TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

export function buildCookieValue(token: string): string {
  const maxAge = Math.floor(TTL_MS / 1000)
  return [
    `${COOKIE_NAME}=${token}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ")
}

export function clearCookieValue(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`
}
