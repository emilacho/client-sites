/**
 * Rate limiting · R96.132 · Wave 2 Item #4 · in-memory fallback +
 * Upstash Redis si está configurado (UPSTASH_REDIS_REST_URL +
 * UPSTASH_REDIS_REST_TOKEN). In-memory funciona solo dentro del
 * mismo Vercel function instance · suficiente para abuse casual.
 * Upstash distribuido es más robusto · scale horizontal.
 *
 * Sin deps externas (no @upstash/ratelimit por ahora · zero install).
 * Algoritmo · fixed window counter por IP.
 */
import { createHash } from "node:crypto"

interface RateLimitConfig {
  /** Max requests per window */
  limit: number
  /** Window size in seconds */
  windowSec: number
  /** Identifier (endpoint name) */
  bucket: string
}

// In-memory store · key=ipHash|bucket · value={ count, resetAt }
const memStore = new Map<string, { count: number; resetAt: number }>()

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`naufrago-rl-salt|${ip}`)
    .digest("hex")
    .slice(0, 16)
}

async function upstashIncr(
  key: string,
  ttlSec: number,
): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    // Pipeline · INCR + EXPIRE en una sola request.
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(ttlSec), "NX"],
      ]),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ result: number }>
    return data?.[0]?.result ?? null
  } catch {
    return null
  }
}

export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig,
): Promise<{ ok: boolean; remaining: number; resetIn: number }> {
  const ipHash = hashIp(ip)
  const key = `rl:${config.bucket}:${ipHash}`
  const ttl = config.windowSec

  // Try Upstash first (distributed · más correcto)
  const upstashCount = await upstashIncr(key, ttl)
  if (upstashCount !== null) {
    const remaining = Math.max(0, config.limit - upstashCount)
    return {
      ok: upstashCount <= config.limit,
      remaining,
      resetIn: ttl,
    }
  }

  // Fallback in-memory.
  const now = Date.now()
  const entry = memStore.get(key)
  if (!entry || entry.resetAt < now) {
    memStore.set(key, { count: 1, resetAt: now + ttl * 1000 })
    return { ok: true, remaining: config.limit - 1, resetIn: ttl }
  }
  entry.count += 1
  const remaining = Math.max(0, config.limit - entry.count)
  return {
    ok: entry.count <= config.limit,
    remaining,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  }
}

export function getClientIp(req: Request | { headers: Headers }): string {
  const headers = "headers" in req ? req.headers : new Headers()
  const fwd = headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}
