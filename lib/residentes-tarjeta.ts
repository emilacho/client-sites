import "server-only"
import QRCode from "qrcode"
import { esFicha, numeroVisible } from "@/lib/residentes"
import { DOMINIO_RESIDENTES } from "@/lib/residentes-dominio"

/**
 * La base: getSupabaseAdmin() en el sitio, una base falsa en las pruebas.
 * Tipo suelto a propósito: comparar la forma completa del cliente de Supabase revienta a TypeScript (TS2589).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Base = { from(tabla: string): any }

export type Tarjeta =
  | { estado: "activa"; nombre: string; numero: string; desde: string }
  | { estado: "baja" }
  | { estado: "no_existe" }

/**
 * Lee la tarjeta por su ficha. Una ficha mal formada o desconocida → «no_existe».
 * Un ERROR de la base no se disfraza de «no existe»: se lanza (la página muestra su error).
 */
export async function leerTarjeta(base: Base, ficha: string): Promise<Tarjeta> {
  if (!esFicha(ficha)) return { estado: "no_existe" }
  const { data, error } = await base
    .from("residentes")
    .select("nombre, numero, creado_en, baja_en")
    .eq("ficha", ficha)
    .maybeSingle()
  if (error) throw new Error(`no se pudo leer la tarjeta: ${JSON.stringify(error)}`)
  const fila = data as { nombre: string; numero: number; creado_en: string; baja_en: string | null } | null
  if (!fila) return { estado: "no_existe" }
  if (fila.baja_en) return { estado: "baja" }
  return { estado: "activa", nombre: fila.nombre, numero: numeroVisible(fila.numero), desde: mesEcuador(fila.creado_en) }
}

/** «NOV 2026», en el calendario de Ecuador. */
export function mesEcuador(iso: string): string {
  const partes = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(iso))
  const mes = (partes.find((p) => p.type === "month")?.value ?? "").replace(".", "").toUpperCase()
  const anio = partes.find((p) => p.type === "year")?.value ?? ""
  return `${mes} ${anio}`.trim()
}

/**
 * Dirección que lleva el QR: la página de la caja. SIEMPRE en `www` (ver `lib/residentes-dominio.ts`):
 * si apuntara a `naufrago.ec`, la galleta de la caja guardada en `www` no viajaría.
 */
export function urlValidacion(ficha: string): string {
  return `${DOMINIO_RESIDENTES}/residentes/v/${ficha}`
}

/** El QR en SVG, hecho aquí mismo (sin servicios de terceros). */
export function qrSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#1F1138", light: "#F5E9D2" },
  })
}
