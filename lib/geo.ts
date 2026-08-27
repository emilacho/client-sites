/**
 * Geo utilities · R96.155 · Haversine distance + geofencing helpers
 * para el tracker WhatsApp en tiempo real.
 */

const EARTH_RADIUS_METERS = 6_371_000

/**
 * Distancia entre 2 coords en METROS usando Haversine formula.
 * lat/lng en grados decimales.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/**
 * Determina el status del pedido según distancia rider → dropoff.
 * Thresholds · 50m AT_DESTINATION · 500m NEARING_DESTINATION · sino OUT_FOR_DELIVERY.
 * One-way transition · NO revierte si rider se aleja.
 */
export type DeliveryStatus =
  | "OUT_FOR_DELIVERY"
  | "NEARING_DESTINATION"
  | "AT_DESTINATION"

export function deriveDeliveryStatus(
  distanceMeters: number,
  currentStatus: DeliveryStatus,
): DeliveryStatus {
  // AT_DESTINATION es terminal de la cadena · no revierte
  if (currentStatus === "AT_DESTINATION") return "AT_DESTINATION"
  if (distanceMeters < 50) return "AT_DESTINATION"
  // NEARING_DESTINATION · revierte solo si ya estamos ahí y subimos a > 500m
  // (NO revertimos · porque cliente puede haber ya respondido al "casi llega")
  if (currentStatus === "NEARING_DESTINATION") {
    return distanceMeters < 50 ? "AT_DESTINATION" : "NEARING_DESTINATION"
  }
  if (distanceMeters < 500) return "NEARING_DESTINATION"
  return "OUT_FOR_DELIVERY"
}
