import "server-only"
/**
 * Courier provider registry · Round 97.
 *
 * Single entry point for routes that need to talk to a courier ·
 * keep `getCourierProvider(id)` as the only import surface so
 * adding a new provider is two lines (implementation + register).
 *
 * Active list controlled by env · operators can disable a provider
 * without code change by removing it from
 * `NAUFRAGO_ACTIVE_COURIERS` (comma-separated DeliveryProvider ids).
 * Defaults to `PEDIDOSYA_COURIER` when the env is unset.
 */
import type { DeliveryProvider } from "@/lib/schemas"
import type { CourierProvider } from "./provider"
import { pedidosYaCourier } from "./pedidosya-courier"

/** All implementations · add a row when a new provider lands. */
const ALL_PROVIDERS: Record<DeliveryProvider, CourierProvider | null> = {
  PEDIDOSYA_COURIER: pedidosYaCourier,
  RAPPI_COURIER: null,
  UBER_EATS_COURIER: null,
  NAUFRAGO_OWN_DELIVERY: null,
  PICKUP: null,
}

/**
 * Returns the provider for an id, or null when it's not yet
 * implemented · the API route returns 501 in that case with the
 * provider name so the operator knows what to wire up.
 */
export function getCourierProvider(
  id: DeliveryProvider,
): CourierProvider | null {
  return ALL_PROVIDERS[id] ?? null
}

/**
 * Returns every provider currently listed in
 * NAUFRAGO_ACTIVE_COURIERS · used by /api/checkout/quote to
 * iterate the active set and surface a quote per provider.
 */
export function getActiveCourierProviders(): CourierProvider[] {
  const env = process.env.NAUFRAGO_ACTIVE_COURIERS
  const ids: DeliveryProvider[] = env
    ? (env
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(
          (s): s is DeliveryProvider =>
            s in ALL_PROVIDERS,
        ) as DeliveryProvider[])
    : ["PEDIDOSYA_COURIER"]
  return ids
    .map((id) => ALL_PROVIDERS[id])
    .filter((p): p is CourierProvider => p !== null)
}

export type { CourierProvider } from "./provider"
export {
  CourierEnvError,
  CourierShapeError,
} from "./provider"
