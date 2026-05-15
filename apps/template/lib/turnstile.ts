/**
 * Cloudflare Turnstile token verification.
 *
 * Anti-spam on the contact form. Token comes from the client-side widget
 * (the form posts it as `turnstile_token`). We POST to Turnstile's siteverify
 * endpoint server-side · returning success means the token was valid AND
 * issued for the configured site key AND not previously seen.
 *
 * `CLOUDFLARE_TURNSTILE_SECRET_KEY` must be set in env. If absent, this
 * function returns `{ valid: false, reason: "no_secret_configured" }` so
 * local dev can choose to skip the check or fail closed depending on the
 * route's policy.
 */
export interface TurnstileResult {
  valid: boolean
  reason?: string
  hostname?: string
}

export async function verifyTurnstile(
  token: string,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
  if (!secret) {
    return { valid: false, reason: "no_secret_configured" }
  }
  if (!token || token.length < 10) {
    return { valid: false, reason: "missing_token" }
  }

  try {
    const body = new URLSearchParams({ secret, response: token })
    if (remoteIp) body.append("remoteip", remoteIp)

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    )
    const data = (await res.json()) as {
      success: boolean
      "error-codes"?: string[]
      hostname?: string
    }
    if (!data.success) {
      return {
        valid: false,
        reason: data["error-codes"]?.join(",") ?? "siteverify_failed",
      }
    }
    return { valid: true, hostname: data.hostname }
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : "siteverify_fetch_error",
    }
  }
}
