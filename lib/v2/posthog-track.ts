/**
 * PostHog track helper · R96.134 · #7 funnel events canónicos.
 * Sin deps externas · POST directo al endpoint /capture de PostHog.
 * No-op si NEXT_PUBLIC_POSTHOG_KEY no está configurado.
 *
 * Distinct_id persistente en localStorage · anonymous user tracking
 * cross-session. Cuando el cliente se autentica · usa el auth_user_id
 * como distinct_id (más estable que el anonymous).
 */

const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
const DISTINCT_ID_KEY = "naufrago_ph_distinct_id"

function getDistinctId(): string {
  if (typeof window === "undefined") return "ssr"
  try {
    const cached = window.localStorage.getItem(DISTINCT_ID_KEY)
    if (cached) return cached
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `anon_${crypto.randomUUID()}`
        : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(DISTINCT_ID_KEY, id)
    return id
  } catch {
    return "no_storage"
  }
}

export type FunnelEvent =
  | "$pageview"
  | "menu_viewed"
  | "item_added_to_cart"
  | "cart_opened"
  | "checkout_started"
  | "otp_requested"
  | "order_submitted"
  | "order_delivered"
  | "loyalty_redeemed"
  | "review_submitted"
  | "push_subscribed"
  | "ruleta_spun"
  | "login_completed"
  // R97.1 · Voice AI + Kushki Hybrid · funnel del botón Llamame
  | "voice_order_initiate_submit"
  | "voice_order_initiate_success"

/** Pageview event · R96.135 · llamado por PageViewTracker en cada
 *  navegación · usePathname() watcher. PostHog canonical event name
 *  $pageview · habilita funnel step 1 standard. */
export function pageview(properties: Record<string, unknown> = {}): void {
  track("$pageview", {
    ...properties,
    $pathname:
      typeof window !== "undefined" ? window.location.pathname : undefined,
    $host: typeof window !== "undefined" ? window.location.host : undefined,
  })
}

/** Track event · fire-and-forget · safe contra missing key + offline. */
export function track(
  event: FunnelEvent,
  properties: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return

  const distinctId = getDistinctId()
  const payload = {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties: {
      ...properties,
      $current_url:
        typeof window !== "undefined" ? window.location.href : undefined,
      $referrer: typeof document !== "undefined" ? document.referrer : undefined,
    },
    timestamp: new Date().toISOString(),
  }

  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // ignore network errors · funnel events son best-effort
  })
}

/** Identify · vincula el distinct_id anonymous con user_id real
 *  post-login para que el funnel cross-session se atribuya al mismo
 *  user. Llamado por useAccount cuando aparece sesión Supabase Auth. */
export function identify(authUserId: string, traits: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return
  const anonId = getDistinctId()
  void fetch(`${POSTHOG_HOST}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event: "$identify",
      distinct_id: authUserId,
      properties: { $anon_distinct_id: anonId, ...traits },
      timestamp: new Date().toISOString(),
    }),
    keepalive: true,
  }).catch(() => {})
  try {
    window.localStorage.setItem(DISTINCT_ID_KEY, authUserId)
  } catch {
    // ignore
  }
}
